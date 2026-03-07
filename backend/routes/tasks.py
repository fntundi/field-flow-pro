# Tasks Routes - Migrated from server.py
# Handles Tasks CRUD and reordering within Jobs

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for tasks
router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Get database instance
db = get_database()


@router.post("")
async def create_task(task_data: dict):
    """Create a new task for a job"""
    from models import Task
    
    safe_job_id = sanitize_string(task_data.get("job_id", ""), 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_job_id}, {"job_number": safe_job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    tech_name = None
    if task_data.get("assigned_technician_id"):
        if not validate_uuid(task_data["assigned_technician_id"]):
            raise HTTPException(status_code=400, detail="Invalid technician ID format")
        tech = await db.technicians.find_one({"id": task_data["assigned_technician_id"]})
        if tech:
            tech_name = tech["name"]
    
    status = sanitize_string(task_data.get("status", "pending"), 50)
    max_order = await db.tasks.find(
        {"job_id": job["id"], "status": status}
    ).sort("order", -1).limit(1).to_list(1)
    order = (max_order[0]["order"] + 1) if max_order else 0
    
    count = await db.tasks.count_documents({})
    task = Task(
        task_number=f"TASK-{count + 1001}",
        job_id=job["id"],
        title=sanitize_string(task_data.get("title", ""), 200),
        description=sanitize_string(task_data.get("description"), 2000) if task_data.get("description") else None,
        task_type=task_data.get("task_type", "general"),
        status=status,
        priority=task_data.get("priority", "medium"),
        assigned_technician_id=task_data.get("assigned_technician_id"),
        assigned_technician_name=tech_name,
        scheduled_date=task_data.get("scheduled_date"),
        scheduled_time=task_data.get("scheduled_time"),
        estimated_duration=sanitize_string(task_data.get("estimated_duration"), 50) if task_data.get("estimated_duration") else None,
        notes=sanitize_string(task_data.get("notes"), 2000) if task_data.get("notes") else None,
        order=order,
    )
    await db.tasks.insert_one(task.dict())
    result = task.dict()
    return result


@router.get("")
async def get_tasks(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    technician_id: Optional[str] = None,
    task_type: Optional[str] = None
):
    """Get all tasks with optional filters"""
    query = {}
    if job_id:
        safe_job_id = sanitize_string(job_id, 100)
        job = await db.jobs.find_one({"$or": [{"id": safe_job_id}, {"job_number": safe_job_id}]})
        if job:
            query["job_id"] = job["id"]
        else:
            query["job_id"] = safe_job_id
    if status:
        query["status"] = sanitize_string(status, 50)
    if technician_id:
        if validate_uuid(technician_id):
            query["assigned_technician_id"] = technician_id
    if task_type:
        query["task_type"] = sanitize_string(task_type, 50)
    
    tasks = await db.tasks.find(query).sort([("status", 1), ("order", 1)]).to_list(1000)
    for task in tasks:
        task.pop("_id", None)
    return tasks


@router.get("/{task_id}")
async def get_task(task_id: str):
    """Get a specific task"""
    safe_id = sanitize_string(task_id, 100)
    task = await db.tasks.find_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.pop("_id", None)
    return task


@router.put("/{task_id}")
async def update_task(task_id: str, task_data: dict):
    """Update a task"""
    safe_id = sanitize_string(task_id, 100)
    task = await db.tasks.find_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {}
    for k, v in task_data.items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    if "assigned_technician_id" in update_data and update_data["assigned_technician_id"]:
        if validate_uuid(update_data["assigned_technician_id"]):
            tech = await db.technicians.find_one({"id": update_data["assigned_technician_id"]})
            if tech:
                update_data["assigned_technician_name"] = tech["name"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.tasks.update_one({"id": task["id"]}, {"$set": update_data})
    updated = await db.tasks.find_one({"id": task["id"]})
    updated.pop("_id", None)
    return updated


@router.post("/move")
async def move_task(move_data: dict):
    """Move a task to a new status column and/or reorder"""
    task_id = move_data.get("task_id")
    if not validate_uuid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_status = task["status"]
    old_order = task["order"]
    new_status = sanitize_string(move_data.get("new_status", old_status), 50)
    new_order = max(0, move_data.get("new_order", 0))
    
    # Update orders of other tasks in the old column (shift up)
    if old_status != new_status:
        await db.tasks.update_many(
            {"job_id": task["job_id"], "status": old_status, "order": {"$gt": old_order}},
            {"$inc": {"order": -1}}
        )
    
    # Update orders of tasks in new column (shift down)
    await db.tasks.update_many(
        {"job_id": task["job_id"], "status": new_status, "order": {"$gte": new_order}},
        {"$inc": {"order": 1}}
    )
    
    # Update the task
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {
            "status": new_status,
            "order": new_order,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    updated = await db.tasks.find_one({"id": task_id})
    updated.pop("_id", None)
    return updated


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    safe_id = sanitize_string(task_id, 100)
    result = await db.tasks.delete_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}
