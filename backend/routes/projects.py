# Projects Routes - Migrated from server.py
# Handles Install Projects, Gantt, Milestones, and Billing per RFC-002

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for projects
router = APIRouter(prefix="/projects", tags=["Projects"])

# Get database instance
db = get_database()


# ==================== INSTALL PROJECTS ====================

@router.get("")
async def get_projects(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all install projects"""
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    
    projects = await db.install_projects.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for p in projects:
        p.pop("_id", None)
    return projects


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get a specific project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.pop("_id", None)
    return project


@router.post("")
async def create_project(data: dict):
    """Create a new install project"""
    from models import InstallProject
    
    project = InstallProject(
        job_id=data.get("job_id"),
        customer_id=data.get("customer_id"),
        customer_name=sanitize_string(data.get("customer_name", ""), 200),
        site_address=sanitize_string(data.get("site_address", ""), 500),
        title=sanitize_string(data.get("title", ""), 200),
        description=sanitize_string(data.get("description"), 2000) if data.get("description") else None,
        start_date=data.get("start_date"),
        target_end_date=data.get("target_end_date"),
        estimated_hours=data.get("estimated_hours", 0),
        estimated_cost=data.get("estimated_cost", 0),
        phases=data.get("phases", []),
    )
    
    await db.install_projects.insert_one(project.dict())
    result = project.dict()
    return result


@router.put("/{project_id}")
async def update_project(project_id: str, data: dict):
    """Update a project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {}
    allowed_fields = ["title", "description", "start_date", "target_end_date", "actual_end_date",
                      "estimated_hours", "actual_hours", "estimated_cost", "actual_cost", 
                      "status", "phases", "notes"]
    
    for key in allowed_fields:
        if key in data and data[key] is not None:
            if isinstance(data[key], str):
                update_data[key] = sanitize_string(data[key], 2000)
            else:
                update_data[key] = data[key]
    
    # Calculate progress if phases provided
    if "phases" in update_data:
        phases = update_data["phases"]
        if phases:
            completed = sum(1 for p in phases if p.get("status") == "completed")
            update_data["progress"] = int((completed / len(phases)) * 100)
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.install_projects.update_one({"id": project_id}, {"$set": update_data})
    updated = await db.install_projects.find_one({"id": project_id})
    updated.pop("_id", None)
    return updated


@router.put("/{project_id}/status")
async def update_project_status(project_id: str, data: dict):
    """Update project status"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    status = data.get("status")
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if status == "completed":
        update_data["actual_end_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        update_data["progress"] = 100
    
    await db.install_projects.update_one({"id": project_id}, {"$set": update_data})
    return {"message": f"Project status updated to {status}"}


# ==================== PROJECT PHASES ====================

@router.post("/{project_id}/phases")
async def add_project_phase(project_id: str, data: dict):
    """Add a phase to a project"""
    from models import ProjectPhase
    
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    phase = ProjectPhase(
        name=sanitize_string(data.get("name", ""), 100),
        description=sanitize_string(data.get("description"), 500) if data.get("description") else None,
        order=data.get("order", len(project.get("phases", []))),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        estimated_hours=data.get("estimated_hours", 0),
        assigned_technician_ids=data.get("assigned_technician_ids", []),
        tasks=data.get("tasks", []),
        dependencies=data.get("dependencies", []),
    )
    
    phases = project.get("phases", [])
    phases.append(phase.dict())
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"phases": phases, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Phase added", "phase_id": phase.id}


@router.put("/{project_id}/phases/{phase_id}")
async def update_project_phase(project_id: str, phase_id: str, data: dict):
    """Update a project phase"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    phases = project.get("phases", [])
    phase_index = None
    for i, p in enumerate(phases):
        if p.get("id") == phase_id:
            phase_index = i
            break
    
    if phase_index is None:
        raise HTTPException(status_code=404, detail="Phase not found")
    
    # Update phase
    for key, value in data.items():
        if value is not None:
            phases[phase_index][key] = value
    
    phases[phase_index]["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Recalculate project progress
    completed = sum(1 for p in phases if p.get("status") == "completed")
    progress = int((completed / len(phases)) * 100) if phases else 0
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"phases": phases, "progress": progress, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated = await db.install_projects.find_one({"id": project_id})
    updated.pop("_id", None)
    return updated


# ==================== MILESTONE TEMPLATES ====================

@router.get("/milestone-templates/list")
async def get_milestone_templates(active_only: bool = True):
    """Get all milestone templates"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    templates = await db.milestone_templates.find(query).sort("name", 1).to_list(100)
    for t in templates:
        t.pop("_id", None)
    return templates


@router.post("/milestone-templates")
async def create_milestone_template(data: dict):
    """Create a milestone template"""
    import uuid
    
    template = {
        "id": str(uuid.uuid4()),
        "name": sanitize_string(data.get("name", ""), 100),
        "description": sanitize_string(data.get("description"), 500) if data.get("description") else None,
        "milestones": data.get("milestones", []),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.milestone_templates.insert_one(template)
    template.pop("_id", None)
    return template


@router.put("/milestone-templates/{template_id}")
async def update_milestone_template(template_id: str, data: dict):
    """Update a milestone template"""
    if not validate_uuid(template_id):
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    template = await db.milestone_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {}
    if "name" in data:
        update_data["name"] = sanitize_string(data["name"], 100)
    if "description" in data:
        update_data["description"] = sanitize_string(data["description"], 500)
    if "milestones" in data:
        update_data["milestones"] = data["milestones"]
    if "is_active" in data:
        update_data["is_active"] = data["is_active"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.milestone_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.milestone_templates.find_one({"id": template_id})
    updated.pop("_id", None)
    return updated


# ==================== PROJECT BILLING ====================

@router.get("/{project_id}/billing")
async def get_project_billing(project_id: str):
    """Get billing info for a project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get related invoices
    invoices = await db.invoices.find({"job_id": project.get("job_id")}).to_list(100)
    for inv in invoices:
        inv.pop("_id", None)
    
    total_invoiced = sum(inv.get("total", 0) for inv in invoices)
    total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
    
    return {
        "project_id": project_id,
        "estimated_cost": project.get("estimated_cost", 0),
        "actual_cost": project.get("actual_cost", 0),
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "balance_due": total_invoiced - total_paid,
        "invoices": invoices
    }


@router.post("/{project_id}/milestones/{milestone_id}/invoice")
async def create_milestone_invoice(project_id: str, milestone_id: str, data: dict):
    """Create an invoice for a project milestone"""
    from models import Invoice, InvoiceLineItem
    
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find milestone in project
    milestone = None
    for phase in project.get("phases", []):
        for m in phase.get("milestones", []):
            if m.get("id") == milestone_id:
                milestone = m
                break
    
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    # Calculate amount
    amount = data.get("amount", milestone.get("amount", 0))
    
    # Create invoice
    line_item = InvoiceLineItem(
        line_type="misc",
        description=f"Milestone: {milestone.get('name', 'Project Milestone')}",
        quantity=1,
        unit_price=amount,
    )
    line_item.extended_price = amount
    
    invoice = Invoice(
        job_id=project.get("job_id"),
        customer_id=project.get("customer_id"),
        customer_name=project.get("customer_name"),
        line_items=[line_item.dict()],
        subtotal=amount,
        total=amount,
        balance_due=amount,
        notes=f"Invoice for project milestone: {milestone.get('name')}"
    )
    
    await db.invoices.insert_one(invoice.dict())
    
    return {
        "message": "Invoice created for milestone",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "amount": amount
    }
