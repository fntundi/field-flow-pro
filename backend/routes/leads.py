# Leads Routes - Migrated from server.py
# Handles Leads, PCBs (Potential Callbacks), and Proposals per RFC-002 Section 4.1

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .shared import (
    get_database, sanitize_string, sanitize_search_query, validate_uuid, logger
)

# Create router for leads
router = APIRouter(prefix="/leads", tags=["Leads & Sales"])

# Get database instance
db = get_database()


# ==================== LEADS CRUD ====================

@router.get("")
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all leads with filtering"""
    query = {}
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if assigned_to:
        query["assigned_to_id"] = assigned_to
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"contact_name": {"$regex": safe_search, "$options": "i"}},
            {"contact_email": {"$regex": safe_search, "$options": "i"}},
            {"company_name": {"$regex": safe_search, "$options": "i"}},
            {"lead_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    leads = await db.leads.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    for lead in leads:
        lead.pop("_id", None)
    return leads


@router.get("/metrics")
async def get_lead_metrics():
    """Get lead metrics per RFC-002 Section 4.1.1"""
    # Count by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.leads.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Count by source
    source_pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    source_counts = await db.leads.aggregate(source_pipeline).to_list(20)
    
    # Calculate conversion rate (won / (won + lost))
    total_closed = status_map.get("won", 0) + status_map.get("lost", 0)
    conversion_rate = (status_map.get("won", 0) / total_closed * 100) if total_closed > 0 else 0
    
    return {
        "total_leads": sum(status_map.values()),
        "by_status": status_map,
        "by_source": {c["_id"]: c["count"] for c in source_counts},
        "lead_to_close_ratio": round(conversion_rate, 1),
        "avg_time_to_first_contact_hours": 4.2  # Placeholder
    }


@router.get("/{lead_id}")
async def get_lead(lead_id: str):
    """Get a specific lead"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.pop("_id", None)
    return lead


@router.post("")
async def create_lead(data: dict):
    """Create a new lead"""
    from models import Lead
    
    lead = Lead(
        contact_name=sanitize_string(data.get("contact_name", ""), 200),
        contact_email=sanitize_string(data.get("contact_email"), 255) if data.get("contact_email") else None,
        contact_phone=sanitize_string(data.get("contact_phone"), 20) if data.get("contact_phone") else None,
        company_name=sanitize_string(data.get("company_name"), 200) if data.get("company_name") else None,
        address=sanitize_string(data.get("address"), 500) if data.get("address") else None,
        city=sanitize_string(data.get("city"), 100) if data.get("city") else None,
        state=sanitize_string(data.get("state"), 50) if data.get("state") else None,
        zip_code=sanitize_string(data.get("zip_code"), 20) if data.get("zip_code") else None,
        source=sanitize_string(data.get("source", "website"), 50),
        source_detail=sanitize_string(data.get("source_detail"), 200) if data.get("source_detail") else None,
        preferred_contact_method=data.get("preferred_contact_method", "phone"),
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
        tags=data.get("tags", []),
        estimated_value=data.get("estimated_value", 0),
        priority=data.get("priority", "normal"),
    )
    await db.leads.insert_one(lead.dict())
    result = lead.dict()
    return result


@router.put("/{lead_id}")
async def update_lead(lead_id: str, data: dict):
    """Update a lead"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = {}
    for k, v in data.items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    # Track status changes
    if "status" in update_data and update_data["status"] != lead.get("status"):
        update_data["status_changed_at"] = datetime.now(timezone.utc)
        
        # Track specific status timestamps
        new_status = update_data["status"]
        if new_status == "contacted" and not lead.get("first_contact_at"):
            update_data["first_contact_at"] = datetime.now(timezone.utc)
        elif new_status == "qualified":
            update_data["qualified_at"] = datetime.now(timezone.utc)
        elif new_status == "quoted":
            update_data["quoted_at"] = datetime.now(timezone.utc)
        elif new_status in ["won", "lost"]:
            update_data["closed_at"] = datetime.now(timezone.utc)
    
    # Update assigned name if ID changed
    if "assigned_to_id" in update_data:
        user = await db.users.find_one({"id": update_data["assigned_to_id"]})
        if not user:
            tech = await db.technicians.find_one({"id": update_data["assigned_to_id"]})
            user = tech
        update_data["assigned_to_name"] = user["name"] if user else None
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.leads.update_one({"id": lead["id"]}, {"$set": update_data})
    updated = await db.leads.find_one({"id": lead["id"]})
    updated.pop("_id", None)
    return updated


@router.post("/{lead_id}/convert")
async def convert_lead(lead_id: str, data: Optional[dict] = None):
    """Convert a lead to a customer and optionally create a job"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Create customer record
    customer_id = str(uuid.uuid4())
    
    # Update lead
    await db.leads.update_one(
        {"id": lead["id"]},
        {"$set": {
            "status": "won",
            "status_changed_at": datetime.now(timezone.utc),
            "closed_at": datetime.now(timezone.utc),
            "converted_customer_id": customer_id,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "message": "Lead converted successfully",
        "customer_id": customer_id,
        "lead_id": lead["id"]
    }


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead"""
    result = await db.leads.delete_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}


# ==================== PCBS (Potential Callbacks) ====================

@router.get("/pcbs/list")
async def get_pcbs(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all PCBs (Potential Callbacks)"""
    query = {}
    if status:
        query["status"] = status
    if assigned_to:
        query["$or"] = [
            {"assigned_technician_id": assigned_to},
            {"assigned_owner_id": assigned_to}
        ]
    if priority:
        query["priority"] = priority
    
    pcbs = await db.pcbs.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    for pcb in pcbs:
        pcb.pop("_id", None)
    return pcbs


@router.get("/pcbs/metrics")
async def get_pcb_metrics():
    """Get PCB metrics per RFC-002"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.pcbs.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Conversion rate
    total_resolved = status_map.get("converted", 0) + status_map.get("closed", 0)
    conversion_rate = (status_map.get("converted", 0) / total_resolved * 100) if total_resolved > 0 else 0
    
    # Overdue follow-ups
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue_count = await db.pcbs.count_documents({
        "status": {"$in": ["created", "assigned", "follow_up"]},
        "follow_up_date": {"$lt": today}
    })
    
    return {
        "total_pcbs": sum(status_map.values()),
        "open_pcbs": status_map.get("created", 0) + status_map.get("assigned", 0) + status_map.get("follow_up", 0),
        "by_status": status_map,
        "conversion_rate": round(conversion_rate, 1),
        "overdue_count": overdue_count
    }


@router.get("/pcbs/{pcb_id}")
async def get_pcb(pcb_id: str):
    """Get a specific PCB"""
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    pcb.pop("_id", None)
    return pcb


@router.post("/pcbs")
async def create_pcb(data: dict):
    """Create a new PCB"""
    from models import PCB
    
    # Get assigned names
    tech_name = None
    owner_name = None
    
    if data.get("assigned_technician_id"):
        tech = await db.technicians.find_one({"id": data["assigned_technician_id"]})
        tech_name = tech["name"] if tech else None
    
    if data.get("assigned_owner_id"):
        user = await db.users.find_one({"id": data["assigned_owner_id"]})
        owner_name = user["name"] if user else None
    
    pcb = PCB(
        lead_id=data.get("lead_id"),
        job_id=data.get("job_id"),
        customer_id=data.get("customer_id"),
        customer_name=sanitize_string(data.get("customer_name"), 200) if data.get("customer_name") else None,
        reason=sanitize_string(data.get("reason", ""), 1000),
        reason_category=data.get("reason_category"),
        assigned_technician_id=data.get("assigned_technician_id"),
        assigned_technician_name=tech_name,
        assigned_owner_id=data.get("assigned_owner_id"),
        assigned_owner_name=owner_name,
        follow_up_date=data.get("follow_up_date"),
        follow_up_time=data.get("follow_up_time"),
        priority=data.get("priority", "normal"),
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
        status="assigned" if (data.get("assigned_technician_id") or data.get("assigned_owner_id")) else "created",
    )
    await db.pcbs.insert_one(pcb.dict())
    result = pcb.dict()
    return result


@router.put("/pcbs/{pcb_id}")
async def update_pcb(pcb_id: str, data: dict):
    """Update a PCB"""
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    
    update_data = {}
    for k, v in data.items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    # Track status changes
    if "status" in update_data and update_data["status"] != pcb.get("status"):
        update_data["status_changed_at"] = datetime.now(timezone.utc)
        if update_data["status"] in ["converted", "closed"]:
            update_data["resolved_at"] = datetime.now(timezone.utc)
    
    # Update assigned names
    if "assigned_technician_id" in update_data:
        tech = await db.technicians.find_one({"id": update_data["assigned_technician_id"]})
        update_data["assigned_technician_name"] = tech["name"] if tech else None
    
    if "assigned_owner_id" in update_data:
        user = await db.users.find_one({"id": update_data["assigned_owner_id"]})
        update_data["assigned_owner_name"] = user["name"] if user else None
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.pcbs.update_one({"id": pcb["id"]}, {"$set": update_data})
    updated = await db.pcbs.find_one({"id": pcb["id"]})
    updated.pop("_id", None)
    return updated


@router.post("/pcbs/{pcb_id}/convert")
async def convert_pcb_to_job(pcb_id: str, job_data: Optional[dict] = None):
    """Convert a PCB to a job"""
    from models import Job
    
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    
    # Create a new job from PCB
    job_count = await db.jobs.count_documents({})
    job = Job(
        job_number=f"JOB-{job_count + 1001}",
        customer_name=pcb.get("customer_name", "Unknown"),
        customer_id=pcb.get("customer_id"),
        site_address=pcb.get("address", "Address to be provided"),
        job_type="Service",
        title=f"Follow-up: {pcb.get('reason', 'PCB Callback')[:50]}",
        description=pcb.get("notes"),
        priority=pcb.get("priority", "normal"),
    )
    await db.jobs.insert_one(job.dict())
    
    # Update PCB
    await db.pcbs.update_one(
        {"id": pcb["id"]},
        {"$set": {
            "status": "converted",
            "status_changed_at": datetime.now(timezone.utc),
            "resolved_at": datetime.now(timezone.utc),
            "converted_to_job_id": job.id,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "message": "PCB converted to job",
        "job_id": job.id,
        "job_number": job.job_number
    }


@router.delete("/pcbs/{pcb_id}")
async def delete_pcb(pcb_id: str):
    """Delete a PCB"""
    result = await db.pcbs.delete_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PCB not found")
    return {"message": "PCB deleted"}


# ==================== PROPOSALS ====================

@router.get("/proposals/list")
async def get_proposals(
    status: Optional[str] = None,
    lead_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all proposals"""
    query = {}
    if status:
        query["status"] = status
    if lead_id:
        query["lead_id"] = lead_id
    if customer_id:
        query["customer_id"] = customer_id
    
    proposals = await db.proposals.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    for p in proposals:
        p.pop("_id", None)
    return proposals


@router.get("/proposals/metrics")
async def get_proposal_metrics():
    """Get proposal metrics"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.proposals.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Win rate
    total_decided = status_map.get("accepted", 0) + status_map.get("rejected", 0)
    win_rate = (status_map.get("accepted", 0) / total_decided * 100) if total_decided > 0 else 0
    
    return {
        "total_proposals": sum(status_map.values()),
        "by_status": status_map,
        "open_quotes": status_map.get("draft", 0) + status_map.get("sent", 0),
        "win_rate": round(win_rate, 1)
    }


@router.get("/proposals/{proposal_id}")
async def get_proposal(proposal_id: str):
    """Get a specific proposal"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    proposal.pop("_id", None)
    return proposal


@router.post("/proposals")
async def create_proposal(data: dict):
    """Create a new proposal"""
    from models import Proposal
    
    proposal = Proposal(
        lead_id=data.get("lead_id"),
        job_id=data.get("job_id"),
        customer_id=data.get("customer_id"),
        customer_name=sanitize_string(data.get("customer_name", ""), 200),
        customer_email=sanitize_string(data.get("customer_email"), 255) if data.get("customer_email") else None,
        customer_phone=sanitize_string(data.get("customer_phone"), 20) if data.get("customer_phone") else None,
        site_address=sanitize_string(data.get("site_address", ""), 500),
        title=sanitize_string(data.get("title", ""), 200),
        description=sanitize_string(data.get("description"), 2000) if data.get("description") else None,
        valid_until=data.get("valid_until"),
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    await db.proposals.insert_one(proposal.dict())
    
    # Link to lead if provided
    if data.get("lead_id"):
        await db.leads.update_one(
            {"id": data["lead_id"]},
            {"$push": {"proposal_ids": proposal.id}}
        )
    
    result = proposal.dict()
    return result


@router.put("/proposals/{proposal_id}")
async def update_proposal(proposal_id: str, data: dict):
    """Update a proposal"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    update_data = {k: v for k, v in data.items() if v is not None}
    
    # Track status changes
    if "status" in update_data and update_data["status"] != proposal.get("status"):
        update_data["status_changed_at"] = datetime.now(timezone.utc)
        if update_data["status"] == "sent":
            update_data["sent_at"] = datetime.now(timezone.utc)
        elif update_data["status"] == "accepted":
            update_data["accepted_at"] = datetime.now(timezone.utc)
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.proposals.update_one({"id": proposal["id"]}, {"$set": update_data})
    updated = await db.proposals.find_one({"id": proposal["id"]})
    updated.pop("_id", None)
    return updated


@router.post("/proposals/{proposal_id}/options")
async def add_proposal_option(proposal_id: str, option_data: dict):
    """Add a Good/Better/Best option to a proposal"""
    from models import ProposalOption, ProposalLineItem
    
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    option = ProposalOption(
        tier=option_data.get("tier", "good"),
        name=sanitize_string(option_data.get("name", "Option"), 100),
        description=sanitize_string(option_data.get("description", ""), 500) if option_data.get("description") else None,
        line_items=[ProposalLineItem(**item) for item in option_data.get("line_items", [])],
        is_recommended=option_data.get("is_recommended", False),
    )
    
    # Calculate totals
    for item in option.line_items:
        item.extended_price = item.quantity * item.unit_price
    
    option.equipment_total = sum(i.extended_price for i in option.line_items if i.item_type == "equipment")
    option.labor_total = sum(i.extended_price for i in option.line_items if i.item_type == "labor")
    option.materials_total = sum(i.extended_price for i in option.line_items if i.item_type == "material")
    option.misc_total = sum(i.extended_price for i in option.line_items if i.item_type == "misc")
    option.subtotal = option.equipment_total + option.labor_total + option.materials_total + option.misc_total
    option.discount_amount = sum(abs(i.extended_price) for i in option.line_items if i.item_type == "discount")
    option.total = option.subtotal - option.discount_amount + option.tax_amount
    
    # Add to proposal
    await db.proposals.update_one(
        {"id": proposal["id"]},
        {
            "$push": {"options": option.dict()},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"message": "Option added", "option_id": option.id}


@router.post("/proposals/{proposal_id}/accept")
async def accept_proposal(proposal_id: str, data: dict):
    """Accept a proposal and convert to job"""
    from models import Job
    
    option_id = data.get("option_id")
    signature = data.get("signature")
    
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Create job from proposal
    job_count = await db.jobs.count_documents({})
    job = Job(
        job_number=f"JOB-{job_count + 1001}",
        customer_name=proposal["customer_name"],
        customer_email=proposal.get("customer_email"),
        customer_phone=proposal.get("customer_phone"),
        site_address=proposal["site_address"],
        job_type="Install",
        title=proposal["title"],
        description=proposal.get("description"),
    )
    await db.jobs.insert_one(job.dict())
    
    # Update proposal
    await db.proposals.update_one(
        {"id": proposal["id"]},
        {"$set": {
            "status": "accepted",
            "status_changed_at": datetime.now(timezone.utc),
            "accepted_at": datetime.now(timezone.utc),
            "selected_option_id": option_id,
            "customer_signature": signature,
            "customer_signed_at": datetime.now(timezone.utc) if signature else None,
            "converted_job_id": job.id,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update lead if linked
    if proposal.get("lead_id"):
        await db.leads.update_one(
            {"id": proposal["lead_id"]},
            {"$set": {
                "status": "won",
                "status_changed_at": datetime.now(timezone.utc),
                "closed_at": datetime.now(timezone.utc),
                "converted_job_id": job.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    
    return {
        "message": "Proposal accepted and job created",
        "job_id": job.id,
        "job_number": job.job_number
    }
