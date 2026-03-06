# Jobs Routes - Migrated from server.py
# Handles all job-related CRUD operations, checklists, equipment usage, and chat

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timezone
import re

from .shared import (
    get_database, sanitize_string, sanitize_search_query, validate_uuid,
    get_current_user, require_auth, require_role, logger
)

# Create router for jobs
router = APIRouter(prefix="/jobs", tags=["Jobs"])

# Get database instance
db = get_database()


# ==================== JOBS CRUD ====================

@router.post("", response_model=dict)
async def create_job(job_data: dict):
    """Create a new job"""
    from models import Job, JobCreate
    
    count = await db.jobs.count_documents({})
    
    job = Job(
        job_number=f"JOB-{count + 1001}",
        customer_name=sanitize_string(job_data.get("customer_name", ""), 200),
        customer_id=job_data.get("customer_id"),
        customer_phone=sanitize_string(job_data.get("customer_phone"), 20) if job_data.get("customer_phone") else None,
        customer_email=sanitize_string(job_data.get("customer_email"), 255) if job_data.get("customer_email") else None,
        site_address=sanitize_string(job_data.get("site_address", ""), 500),
        site_city=sanitize_string(job_data.get("site_city"), 100) if job_data.get("site_city") else None,
        site_state=sanitize_string(job_data.get("site_state"), 50) if job_data.get("site_state") else None,
        site_zip=sanitize_string(job_data.get("site_zip"), 20) if job_data.get("site_zip") else None,
        job_type=sanitize_string(job_data.get("job_type", ""), 100),
        title=sanitize_string(job_data.get("title", ""), 200),
        description=sanitize_string(job_data.get("description"), 2000) if job_data.get("description") else None,
        priority=job_data.get("priority", "medium"),
        scheduled_date=job_data.get("scheduled_date"),
        estimated_hours=job_data.get("estimated_hours"),
    )
    await db.jobs.insert_one(job.dict())
    return job.dict()


@router.get("", response_model=List[dict])
async def get_jobs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """Get all jobs with optional filters"""
    query = {}
    if status:
        if status == "active":
            query["status"] = {"$in": ["open", "in_progress", "urgent"]}
        else:
            query["status"] = sanitize_string(status, 50)
    if priority:
        query["priority"] = sanitize_string(priority, 50)
    if customer_id:
        query["customer_id"] = sanitize_string(customer_id, 100)
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"job_number": {"$regex": safe_search, "$options": "i"}},
            {"customer_name": {"$regex": safe_search, "$options": "i"}},
            {"site_address": {"$regex": safe_search, "$options": "i"}},
            {"title": {"$regex": safe_search, "$options": "i"}},
        ]
    
    jobs = await db.jobs.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    # Remove _id from each job
    for job in jobs:
        job.pop("_id", None)
    return jobs


@router.get("/{job_id}", response_model=dict)
async def get_job(job_id: str):
    """Get a single job by ID or job number"""
    safe_id = sanitize_string(job_id, 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.pop("_id", None)
    return job


@router.put("/{job_id}", response_model=dict)
async def update_job(job_id: str, job_data: dict):
    """Update a job"""
    safe_id = sanitize_string(job_id, 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {}
    for k, v in job_data.items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.jobs.update_one({"id": job["id"]}, {"$set": update_data})
    updated = await db.jobs.find_one({"id": job["id"]})
    updated.pop("_id", None)
    return updated


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated tasks"""
    safe_id = sanitize_string(job_id, 100)
    result = await db.jobs.delete_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    # Also delete associated tasks
    await db.tasks.delete_many({"job_id": safe_id})
    return {"message": "Job deleted successfully"}


# ==================== JOB CHECKLISTS ====================

@router.get("/{job_id}/checklist")
async def get_job_checklist(job_id: str):
    """Get checklist for a job"""
    checklist = await db.job_checklists.find_one({"job_id": job_id})
    if not checklist:
        return {"checklist": None, "message": "No checklist assigned to this job"}
    checklist.pop("_id", None)
    return checklist


@router.post("/{job_id}/checklist")
async def create_job_checklist(job_id: str, template_id: Optional[str] = None):
    """Create a checklist for a job from a template"""
    from models import JobChecklist, JobChecklistItem
    
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if checklist already exists
    existing = await db.job_checklists.find_one({"job_id": job["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Checklist already exists for this job")
    
    # Get template
    items = []
    template_name = None
    
    if template_id:
        template = await db.job_type_templates.find_one({"id": template_id})
        if template:
            template_name = template["name"]
            for item in template.get("checklist_items", []):
                checklist_item = JobChecklistItem(
                    template_item_id=item.get("id"),
                    order=item.get("order", 0),
                    description=item.get("description", ""),
                    requires_before_photo=item.get("requires_before_photo", False),
                    requires_after_photo=item.get("requires_after_photo", False),
                    requires_note=item.get("requires_note", False),
                    requires_measurement=item.get("requires_measurement", False),
                    requires_signature=item.get("requires_signature", False),
                    is_required=item.get("is_required", True),
                )
                items.append(checklist_item)
    
    checklist = JobChecklist(
        job_id=job["id"],
        template_id=template_id,
        template_name=template_name,
        items=[item.dict() for item in items],
        total_items=len(items),
    )
    
    await db.job_checklists.insert_one(checklist.dict())
    result = checklist.dict()
    return result


@router.put("/{job_id}/checklist/items/{item_id}")
async def update_checklist_item(job_id: str, item_id: str, data: dict):
    """Update a checklist item (add evidence, mark complete, etc.)"""
    from models import ChecklistItemEvidence
    
    checklist = await db.job_checklists.find_one({"job_id": job_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    # Find and update the item
    items = checklist.get("items", [])
    item_index = None
    for i, item in enumerate(items):
        if item["id"] == item_id:
            item_index = i
            break
    
    if item_index is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    # Update item
    item = items[item_index]
    
    if "status" in data:
        item["status"] = data["status"]
        if data["status"] == "completed":
            item["completed_at"] = datetime.now(timezone.utc).isoformat()
            item["completed_by_id"] = data.get("completed_by_id")
            item["completed_by_name"] = data.get("completed_by_name")
    
    if "evidence" in data:
        # Add new evidence
        evidence = ChecklistItemEvidence(**data["evidence"])
        if "evidence" not in item:
            item["evidence"] = []
        item["evidence"].append(evidence.dict())
    
    if "has_exception" in data:
        item["has_exception"] = data["has_exception"]
        item["exception_reason"] = data.get("exception_reason")
        item["status"] = "exception"
    
    items[item_index] = item
    
    # Recalculate progress
    completed_count = sum(1 for i in items if i["status"] in ["completed", "exception"])
    exception_count = sum(1 for i in items if i["status"] == "exception")
    
    # Check if job can be completed (all required items done)
    blocking_items = []
    for i in items:
        if i.get("is_required") and i["status"] not in ["completed", "exception"]:
            blocking_items.append(i["id"])
    
    can_complete = len(blocking_items) == 0
    
    await db.job_checklists.update_one(
        {"job_id": job_id},
        {"$set": {
            "items": items,
            "completed_items": completed_count,
            "exception_items": exception_count,
            "percent_complete": int((completed_count / len(items)) * 100) if items else 0,
            "can_complete_job": can_complete,
            "blocking_items": blocking_items,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    updated = await db.job_checklists.find_one({"job_id": job_id})
    updated.pop("_id", None)
    return updated


# ==================== JOB EQUIPMENT USAGE ====================

@router.post("/{job_id}/equipment-usage")
async def record_equipment_usage(job_id: str, usage_data: dict):
    """Record equipment usage for a job"""
    from models import JobEquipmentUsage
    
    # Verify job exists
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    usage = JobEquipmentUsage(
        job_id=job["id"],
        item_id=usage_data["item_id"],
        truck_id=usage_data.get("truck_id"),
        technician_id=usage_data["technician_id"],
        quantity_used=usage_data["quantity_used"],
        unit_cost=usage_data.get("unit_cost", 0),
    )
    
    await db.job_equipment_usage.insert_one(usage.dict())
    result = usage.dict()
    return result


@router.get("/{job_id}/equipment-usage")
async def get_job_equipment_usage(job_id: str):
    """Get all equipment usage records for a job"""
    usage_records = await db.job_equipment_usage.find({"job_id": job_id}).to_list(100)
    for record in usage_records:
        record.pop("_id", None)
    return usage_records


@router.post("/{job_id}/equipment-usage/approve")
async def approve_equipment_usage(job_id: str, approval_data: dict):
    """Approve or reject equipment usage and update inventory"""
    from models import JobEquipmentApproval, InventoryAuditLog
    
    usage_id = approval_data.get("usage_id")
    approved = approval_data.get("approved", False)
    approved_by_id = approval_data.get("approved_by_id")
    notes = approval_data.get("notes", "")
    
    # Get the usage record
    usage = await db.job_equipment_usage.find_one({"id": usage_id})
    if not usage:
        raise HTTPException(status_code=404, detail="Usage record not found")
    
    # Create approval record
    approval = JobEquipmentApproval(
        usage_id=usage_id,
        approved=approved,
        approved_by_id=approved_by_id,
        notes=sanitize_string(notes, 500),
    )
    
    # Update usage record
    update_data = {
        "approval_status": "approved" if approved else "rejected",
        "approved_by_id": approved_by_id,
        "approved_at": datetime.now(timezone.utc),
    }
    
    # If approved, update inventory
    if approved and usage.get("truck_id"):
        truck_inv = await db.truck_inventory.find_one({"truck_id": usage["truck_id"]})
        if truck_inv:
            # Find and update the item quantity
            items = truck_inv.get("items", [])
            for item in items:
                if item["item_id"] == usage["item_id"]:
                    item["quantity_on_truck"] = max(0, item.get("quantity_on_truck", 0) - usage["quantity_used"])
                    break
            
            await db.truck_inventory.update_one(
                {"truck_id": usage["truck_id"]},
                {"$set": {"items": items, "updated_at": datetime.now(timezone.utc)}}
            )
            
            # Create audit log
            audit = InventoryAuditLog(
                item_id=usage["item_id"],
                location_type="truck",
                location_id=usage["truck_id"],
                action="job_usage",
                quantity_change=-usage["quantity_used"],
                reference_type="job",
                reference_id=job_id,
                performed_by_id=approved_by_id,
            )
            await db.inventory_audit_log.insert_one(audit.dict())
    
    await db.job_equipment_usage.update_one(
        {"id": usage_id},
        {"$set": update_data}
    )
    
    return {"message": "Equipment usage " + ("approved" if approved else "rejected"), "approval": approval.dict()}


# ==================== JOB CHAT ====================

@router.get("/{job_id}/chat/{channel}/messages")
async def get_chat_messages(job_id: str, channel: str, limit: int = 50, before: Optional[str] = None):
    """Get chat messages for a job channel"""
    query = {"job_id": job_id, "channel": channel}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.job_chat_messages.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for msg in messages:
        msg.pop("_id", None)
    
    # Return in chronological order
    return list(reversed(messages))


@router.get("/{job_id}/chat/threads")
async def get_chat_threads(job_id: str):
    """Get chat thread summary for a job"""
    internal_count = await db.job_chat_messages.count_documents({"job_id": job_id, "channel": "internal"})
    customer_count = await db.job_chat_messages.count_documents({"job_id": job_id, "channel": "customer"})
    
    return {
        "job_id": job_id,
        "threads": [
            {"channel": "internal", "message_count": internal_count},
            {"channel": "customer", "message_count": customer_count}
        ]
    }


@router.post("/{job_id}/chat/{channel}/message")
async def post_chat_message(job_id: str, channel: str, message_data: dict):
    """Post a new chat message to a job channel"""
    import uuid
    
    # Verify job exists
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    message = {
        "id": str(uuid.uuid4()),
        "job_id": job["id"],
        "channel": channel,
        "sender_id": message_data.get("sender_id"),
        "sender_name": sanitize_string(message_data.get("sender_name", "Unknown"), 100),
        "sender_role": message_data.get("sender_role", "user"),
        "message_type": message_data.get("message_type", "text"),
        "content": sanitize_string(message_data.get("content", ""), 5000),
        "attachments": message_data.get("attachments", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_by": []
    }
    
    await db.job_chat_messages.insert_one(message)
    message.pop("_id", None)
    return message
