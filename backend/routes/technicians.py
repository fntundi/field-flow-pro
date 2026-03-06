# Technicians Routes - Migrated from server.py
# Handles technician CRUD operations, profile images, and status updates

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import re

from .shared import (
    get_database, sanitize_string, sanitize_search_query, validate_uuid, logger
)

# Create router for technicians
router = APIRouter(prefix="/technicians", tags=["Technicians"])

# Get database instance
db = get_database()

# Image validation constants
MAX_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']


def validate_base64_image(data: str) -> tuple:
    """Validate base64 image data"""
    if not data:
        return False, "No image data provided"
    
    if data.startswith('data:'):
        match = re.match(r'data:([^;]+);base64,(.+)', data)
        if not match:
            return False, "Invalid data URL format"
        
        mime_type = match.group(1)
        base64_data = match.group(2)
        
        if mime_type not in ALLOWED_IMAGE_TYPES:
            return False, f"Invalid image type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
        
        import base64
        try:
            decoded = base64.b64decode(base64_data)
            if len(decoded) > MAX_IMAGE_SIZE:
                return False, f"Image too large. Max size: {MAX_IMAGE_SIZE // (1024*1024)}MB"
        except Exception:
            return False, "Invalid base64 encoding"
    
    return True, "Valid"


@router.post("")
async def create_technician(tech_data: dict):
    """Create a new technician"""
    from models import Technician
    
    sanitized_data = {
        "name": sanitize_string(tech_data.get("name", ""), 100),
        "email": sanitize_string(tech_data.get("email", ""), 255).lower(),
        "phone": sanitize_string(tech_data.get("phone", ""), 20),
        "specialty": sanitize_string(tech_data.get("specialty", ""), 100),
        "location": sanitize_string(tech_data.get("location", ""), 200),
        "role": tech_data.get("role", "technician"),
        "status": tech_data.get("status", "available"),
        "status_label": tech_data.get("status_label", "Available"),
    }
    
    count = await db.technicians.count_documents({})
    employee_number = sanitize_string(tech_data.get("employee_number"), 20) or f"TECH-{count + 1001}"
    
    tech = Technician(
        employee_number=employee_number,
        **sanitized_data
    )
    await db.technicians.insert_one(tech.dict())
    result = tech.dict()
    return result


@router.get("")
async def get_technicians(
    status: Optional[str] = None,
    specialty: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all technicians with optional filters"""
    query = {}
    if status:
        query["status"] = sanitize_string(status, 50)
    if specialty:
        query["specialty"] = {"$regex": sanitize_search_query(specialty), "$options": "i"}
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"employee_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    technicians = await db.technicians.find(query).to_list(1000)
    for tech in technicians:
        tech.pop("_id", None)
    return technicians


@router.get("/{tech_id}")
async def get_technician(tech_id: str):
    """Get a single technician by ID"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    tech.pop("_id", None)
    return tech


@router.get("/{tech_id}/public")
async def get_technician_public_profile(tech_id: str):
    """Get public-facing technician profile for customers"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    return {
        "id": tech["id"],
        "name": tech["name"],
        "role": tech.get("role", "technician"),
        "specialty": tech.get("specialty"),
        "profile_image": tech.get("profile_image"),
        "rating": tech.get("rating", 5.0),
        "years_experience": tech.get("years_experience", 0),
        "bio": tech.get("bio"),
    }


@router.put("/{tech_id}")
async def update_technician(tech_id: str, tech_data: dict):
    """Update a technician"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    update_data = {}
    for k, v in tech_data.items():
        if v is not None:
            if isinstance(v, str) and k not in ['status', 'status_label']:
                update_data[k] = sanitize_string(v, 500)
            else:
                update_data[k] = v
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.technicians.update_one({"id": tech_id}, {"$set": update_data})
    updated_tech = await db.technicians.find_one({"id": tech_id})
    updated_tech.pop("_id", None)
    return updated_tech


@router.delete("/{tech_id}")
async def delete_technician(tech_id: str):
    """Delete a technician"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    result = await db.technicians.delete_one({"id": tech_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"message": "Technician deleted successfully"}


@router.post("/{tech_id}/image")
async def upload_technician_image(tech_id: str, image_data: dict):
    """Upload technician profile image as base64"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    image_base64 = image_data.get("image_data", "")
    
    # Validate image data
    is_valid, message = validate_base64_image(image_base64)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Ensure proper data URL format
    if not image_base64.startswith("data:image"):
        image_base64 = f"data:image/jpeg;base64,{image_base64}"
    
    await db.technicians.update_one(
        {"id": tech_id},
        {"$set": {"profile_image": image_base64, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Profile image updated successfully"}


@router.put("/{tech_id}/status")
async def update_technician_status(tech_id: str, status_data: dict):
    """Update technician status"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    status = status_data.get("status", "available")
    status_label = status_data.get("status_label", "Available")
    
    await db.technicians.update_one(
        {"id": tech_id},
        {"$set": {
            "status": sanitize_string(status, 50),
            "status_label": sanitize_string(status_label, 50),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    return {"message": "Status updated successfully"}
