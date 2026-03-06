# Scheduling Routes - Migrated from server.py
# Handles appointments, scheduling board, and time slots

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for scheduling
router = APIRouter(prefix="/appointments", tags=["Scheduling"])

# Get database instance
db = get_database()


@router.post("")
async def create_appointment(appt_data: dict):
    """Create a new appointment"""
    from models import Appointment
    
    technician_id = appt_data.get("technician_id")
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    
    tech = await db.technicians.find_one({"id": technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    appointment = Appointment(
        job_id=sanitize_string(appt_data.get("job_id"), 100),
        task_id=appt_data.get("task_id"),
        technician_id=technician_id,
        customer_name=sanitize_string(appt_data.get("customer_name"), 200),
        customer_phone=sanitize_string(appt_data.get("customer_phone"), 20) if appt_data.get("customer_phone") else None,
        customer_email=sanitize_string(appt_data.get("customer_email"), 255) if appt_data.get("customer_email") else None,
        site_address=sanitize_string(appt_data.get("site_address"), 500),
        scheduled_date=appt_data.get("scheduled_date"),
        scheduled_time=appt_data.get("scheduled_time"),
        estimated_duration=sanitize_string(appt_data.get("estimated_duration"), 50) if appt_data.get("estimated_duration") else None,
        job_type=sanitize_string(appt_data.get("job_type"), 100),
        notes=sanitize_string(appt_data.get("notes"), 2000) if appt_data.get("notes") else None,
    )
    await db.appointments.insert_one(appointment.dict())
    result = appointment.dict()
    return result


@router.get("")
async def get_appointments(
    job_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    status: Optional[str] = None,
    date: Optional[str] = None
):
    """Get all appointments with optional filters"""
    query = {}
    if job_id:
        query["job_id"] = sanitize_string(job_id, 100)
    if technician_id and validate_uuid(technician_id):
        query["technician_id"] = technician_id
    if status:
        query["status"] = sanitize_string(status, 50)
    if date:
        query["scheduled_date"] = sanitize_string(date, 20)
    
    appointments = await db.appointments.find(query).sort("scheduled_date", 1).to_list(1000)
    for appt in appointments:
        appt.pop("_id", None)
    return appointments


@router.get("/{appt_id}")
async def get_appointment(appt_id: str):
    """Get a single appointment by ID"""
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.pop("_id", None)
    return appointment


@router.get("/confirmation/{token}")
async def get_appointment_confirmation(token: str):
    """Get customer-facing appointment confirmation by token"""
    if not validate_uuid(token):
        raise HTTPException(status_code=400, detail="Invalid confirmation token")
    
    appointment = await db.appointments.find_one({"confirmation_token": token})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    job = await db.jobs.find_one({"id": appointment["job_id"]})
    job_number = job["job_number"] if job else "N/A"
    
    tech = await db.technicians.find_one({"id": appointment["technician_id"]})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    tech_profile = {
        "id": tech["id"],
        "name": tech["name"],
        "role": tech.get("role", "technician"),
        "specialty": tech.get("specialty"),
        "profile_image": tech.get("profile_image"),
        "rating": tech.get("rating", 5.0),
        "years_experience": tech.get("years_experience", 0),
        "bio": tech.get("bio"),
    }
    
    return {
        "appointment_id": appointment["id"],
        "job_number": job_number,
        "scheduled_date": appointment["scheduled_date"],
        "scheduled_time": appointment["scheduled_time"],
        "estimated_duration": appointment.get("estimated_duration"),
        "job_type": appointment["job_type"],
        "site_address": appointment["site_address"],
        "technician": tech_profile,
        "notes": appointment.get("notes"),
        "status": appointment["status"],
    }


@router.put("/{appt_id}/status")
async def update_appointment_status(appt_id: str, status_data: dict):
    """Update appointment status"""
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    status = status_data.get("status", "scheduled")
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {"status": sanitize_string(status, 50), "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Appointment status updated"}


@router.put("/{appt_id}")
async def update_appointment(appt_id: str, appt_data: dict):
    """Update an appointment"""
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    update_data = {}
    allowed_fields = ["scheduled_date", "scheduled_time", "estimated_duration", "notes", "status", "technician_id"]
    
    for k, v in appt_data.items():
        if k in allowed_fields and v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 500)
            else:
                update_data[k] = v
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.appointments.update_one({"id": appt_id}, {"$set": update_data})
    updated = await db.appointments.find_one({"id": appt_id})
    updated.pop("_id", None)
    return updated


@router.delete("/{appt_id}")
async def delete_appointment(appt_id: str):
    """Delete an appointment"""
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    result = await db.appointments.delete_one({"id": appt_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment deleted successfully"}
