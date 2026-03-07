# Reports Routes - Migrated from server.py
# Handles Reporting & Analytics per RFC-002 Section 4.8

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for reports
router = APIRouter(prefix="/reports", tags=["Reports"])

# Get database instance
db = get_database()


@router.get("/summary")
async def get_report_summary():
    """Get overall business summary metrics"""
    # Jobs metrics
    total_jobs = await db.jobs.count_documents({})
    active_jobs = await db.jobs.count_documents({"status": {"$in": ["open", "in_progress", "urgent"]}})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    
    # Leads metrics
    total_leads = await db.leads.count_documents({})
    active_leads = await db.leads.count_documents({"status": {"$nin": ["won", "lost"]}})
    
    # Invoice metrics
    total_invoices = await db.invoices.count_documents({})
    paid_invoices = await db.invoices.count_documents({"status": "paid"})
    
    # Revenue calculation
    revenue_pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.invoices.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Outstanding balance
    outstanding_pipeline = [
        {"$match": {"status": {"$in": ["sent", "overdue", "partially_paid"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance_due"}}}
    ]
    outstanding_result = await db.invoices.aggregate(outstanding_pipeline).to_list(1)
    outstanding_balance = outstanding_result[0]["total"] if outstanding_result else 0
    
    # Technician count
    tech_count = await db.technicians.count_documents({"status": {"$ne": "inactive"}})
    
    # Customer count
    customer_count = await db.customers.count_documents({"is_active": True})
    
    return {
        "jobs": {
            "total": total_jobs,
            "active": active_jobs,
            "completed": completed_jobs
        },
        "leads": {
            "total": total_leads,
            "active": active_leads
        },
        "invoices": {
            "total": total_invoices,
            "paid": paid_invoices
        },
        "revenue": {
            "total": total_revenue,
            "outstanding": outstanding_balance
        },
        "technicians": tech_count,
        "customers": customer_count
    }


@router.post("/query")
async def run_report_query(data: dict):
    """Run a custom report query"""
    collection_name = data.get("collection", "jobs")
    filters = data.get("filters", {})
    group_by = data.get("group_by")
    aggregate = data.get("aggregate")  # sum, count, avg
    aggregate_field = data.get("aggregate_field")
    date_range = data.get("date_range")  # { start: str, end: str }
    limit = min(data.get("limit", 1000), 5000)
    
    # Validate collection
    allowed_collections = ["jobs", "invoices", "leads", "customers", "technicians", "proposals", "pcbs"]
    if collection_name not in allowed_collections:
        raise HTTPException(status_code=400, detail=f"Collection must be one of: {allowed_collections}")
    
    collection = db[collection_name]
    
    # Build query
    query = {}
    for key, value in filters.items():
        if isinstance(value, str):
            query[key] = sanitize_string(value, 200)
        else:
            query[key] = value
    
    # Add date range filter
    if date_range:
        date_field = "created_at"
        if date_range.get("start"):
            query[date_field] = {"$gte": datetime.fromisoformat(date_range["start"].replace("Z", "+00:00"))}
        if date_range.get("end"):
            if date_field in query:
                query[date_field]["$lte"] = datetime.fromisoformat(date_range["end"].replace("Z", "+00:00"))
            else:
                query[date_field] = {"$lte": datetime.fromisoformat(date_range["end"].replace("Z", "+00:00"))}
    
    # Build pipeline
    if group_by or aggregate:
        pipeline = [{"$match": query}]
        
        group_stage = {"_id": f"${group_by}" if group_by else None}
        
        if aggregate == "count":
            group_stage["value"] = {"$sum": 1}
        elif aggregate == "sum" and aggregate_field:
            group_stage["value"] = {"$sum": f"${aggregate_field}"}
        elif aggregate == "avg" and aggregate_field:
            group_stage["value"] = {"$avg": f"${aggregate_field}"}
        else:
            group_stage["count"] = {"$sum": 1}
        
        pipeline.append({"$group": group_stage})
        pipeline.append({"$sort": {"_id": 1}})
        pipeline.append({"$limit": limit})
        
        results = await collection.aggregate(pipeline).to_list(limit)
        
        return {
            "type": "aggregation",
            "data": [{"label": r["_id"], "value": r.get("value", r.get("count"))} for r in results],
            "total_groups": len(results)
        }
    else:
        # Simple query
        results = await collection.find(query).limit(limit).to_list(limit)
        for r in results:
            r.pop("_id", None)
        
        return {
            "type": "list",
            "data": results,
            "count": len(results)
        }


@router.get("/jobs/by-status")
async def get_jobs_by_status():
    """Get job counts grouped by status"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    results = await db.jobs.aggregate(pipeline).to_list(20)
    return {"data": [{"status": r["_id"], "count": r["count"]} for r in results]}


@router.get("/jobs/by-type")
async def get_jobs_by_type():
    """Get job counts grouped by job type"""
    pipeline = [
        {"$group": {"_id": "$job_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    results = await db.jobs.aggregate(pipeline).to_list(20)
    return {"data": [{"job_type": r["_id"], "count": r["count"]} for r in results]}


@router.get("/revenue/by-month")
async def get_revenue_by_month(months: int = 12):
    """Get revenue breakdown by month"""
    pipeline = [
        {"$match": {"status": "paid", "paid_date": {"$exists": True}}},
        {"$addFields": {
            "month": {"$substr": ["$paid_date", 0, 7]}
        }},
        {"$group": {
            "_id": "$month",
            "revenue": {"$sum": "$total"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": months}
    ]
    
    results = await db.invoices.aggregate(pipeline).to_list(months)
    return {"data": [{"month": r["_id"], "revenue": r["revenue"], "invoice_count": r["count"]} for r in results]}


@router.get("/technicians/performance")
async def get_technician_performance(days: int = 30):
    """Get technician performance metrics"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get all active technicians
    technicians = await db.technicians.find({"status": {"$ne": "inactive"}}).to_list(100)
    
    results = []
    for tech in technicians:
        # Jobs completed
        jobs_completed = await db.jobs.count_documents({
            "assigned_technician_id": tech["id"],
            "status": "completed",
            "updated_at": {"$gte": cutoff}
        })
        
        # Tasks completed
        tasks_completed = await db.tasks.count_documents({
            "assigned_technician_id": tech["id"],
            "status": "completed",
            "updated_at": {"$gte": cutoff}
        })
        
        results.append({
            "technician_id": tech["id"],
            "name": tech["name"],
            "specialty": tech.get("specialty"),
            "jobs_completed": jobs_completed,
            "tasks_completed": tasks_completed
        })
    
    return {"period_days": days, "data": results}


@router.get("/leads/conversion")
async def get_lead_conversion_metrics():
    """Get lead conversion funnel metrics"""
    total = await db.leads.count_documents({})
    contacted = await db.leads.count_documents({"status": {"$in": ["contacted", "qualified", "quoted", "won"]}})
    qualified = await db.leads.count_documents({"status": {"$in": ["qualified", "quoted", "won"]}})
    quoted = await db.leads.count_documents({"status": {"$in": ["quoted", "won"]}})
    won = await db.leads.count_documents({"status": "won"})
    lost = await db.leads.count_documents({"status": "lost"})
    
    return {
        "funnel": [
            {"stage": "Total Leads", "count": total},
            {"stage": "Contacted", "count": contacted},
            {"stage": "Qualified", "count": qualified},
            {"stage": "Quoted", "count": quoted},
            {"stage": "Won", "count": won}
        ],
        "lost": lost,
        "conversion_rate": round((won / (won + lost) * 100), 1) if (won + lost) > 0 else 0
    }
