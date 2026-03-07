# Sites Routes - Migrated from server.py
# Handles Sites CRUD, job history, and equipment per RFC-002

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for sites
router = APIRouter(prefix="/sites", tags=["Sites"])

# Get database instance
db = get_database()


@router.get("")
async def get_sites(
    customer_id: Optional[str] = None,
    site_type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: bool = True
):
    """Get all sites with optional filters"""
    query = {"is_active": is_active}
    
    if customer_id:
        query["customer_id"] = customer_id
    
    if site_type:
        query["site_type"] = site_type
    
    if search:
        safe_search = sanitize_string(search, 100)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"address": {"$regex": safe_search, "$options": "i"}},
            {"customer_name": {"$regex": safe_search, "$options": "i"}},
        ]
    
    sites = await db.sites.find(query).sort("name", 1).to_list(500)
    for s in sites:
        s.pop("_id", None)
    return sites


@router.get("/{site_id}")
async def get_site(site_id: str):
    """Get a specific site with full details"""
    if not validate_uuid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    site.pop("_id", None)
    return site


@router.get("/{site_id}/jobs")
async def get_site_jobs(site_id: str, limit: int = 20):
    """Get job history for a site"""
    if not validate_uuid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Find jobs by site_id or matching address
    jobs = await db.jobs.find({
        "$or": [
            {"site_id": site_id},
            {"site_address": site["address"]}
        ]
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    for j in jobs:
        j.pop("_id", None)
    return jobs


@router.get("/{site_id}/equipment")
async def get_site_equipment(site_id: str):
    """Get equipment at a site"""
    if not validate_uuid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    if not site.get("equipment_ids"):
        return []
    
    equipment = await db.customer_equipment.find({
        "id": {"$in": site["equipment_ids"]}
    }).to_list(100)
    
    for e in equipment:
        e.pop("_id", None)
    return equipment


@router.post("")
async def create_site(data: dict):
    """Create a new site"""
    from models import Site
    
    # Verify customer exists
    customer = await db.customers.find_one({"id": data.get("customer_id")})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    site = Site(
        customer_id=data.get("customer_id"),
        customer_name=customer.get("name"),
        name=sanitize_string(data.get("name", ""), 200),
        site_type=data.get("site_type", "residential"),
        address=sanitize_string(data.get("address", ""), 500),
        city=sanitize_string(data.get("city"), 100) if data.get("city") else None,
        state=sanitize_string(data.get("state"), 50) if data.get("state") else None,
        zip_code=sanitize_string(data.get("zip_code"), 20) if data.get("zip_code") else None,
        access_instructions=sanitize_string(data.get("access_instructions"), 1000) if data.get("access_instructions") else None,
        gate_code=sanitize_string(data.get("gate_code"), 50) if data.get("gate_code") else None,
        key_location=sanitize_string(data.get("key_location"), 200) if data.get("key_location") else None,
        parking_notes=sanitize_string(data.get("parking_notes"), 500) if data.get("parking_notes") else None,
        building_hours=sanitize_string(data.get("building_hours"), 200) if data.get("building_hours") else None,
        contacts=data.get("contacts", []),
        requires_appointment=data.get("requires_appointment", False),
        has_pets=data.get("has_pets", False),
        pet_notes=sanitize_string(data.get("pet_notes"), 200) if data.get("pet_notes") else None,
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    
    await db.sites.insert_one(site.dict())
    result = site.dict()
    return result


@router.put("/{site_id}")
async def update_site(site_id: str, data: dict):
    """Update a site"""
    if not validate_uuid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    update_data = {}
    field_limits = {
        "name": 200, "address": 500, "city": 100, "state": 50, "zip_code": 20,
        "access_instructions": 1000, "gate_code": 50, "key_location": 200,
        "parking_notes": 500, "building_hours": 200, "pet_notes": 200, "notes": 2000
    }
    
    for field, limit in field_limits.items():
        if field in data and data[field] is not None:
            update_data[field] = sanitize_string(data[field], limit)
    
    # Handle non-string fields
    for field in ["site_type", "contacts", "requires_appointment", "has_pets", "is_active"]:
        if field in data and data[field] is not None:
            update_data[field] = data[field]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.sites.update_one({"id": site_id}, {"$set": update_data})
    
    updated = await db.sites.find_one({"id": site_id})
    updated.pop("_id", None)
    return updated


@router.delete("/{site_id}")
async def delete_site(site_id: str):
    """Soft delete a site (mark as inactive)"""
    if not validate_uuid(site_id):
        raise HTTPException(status_code=400, detail="Invalid site ID")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    await db.sites.update_one(
        {"id": site_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Site deleted"}


@router.post("/{site_id}/equipment/{equipment_id}")
async def link_equipment_to_site(site_id: str, equipment_id: str):
    """Link equipment to a site"""
    if not validate_uuid(site_id) or not validate_uuid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    site = await db.sites.find_one({"id": site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    equipment = await db.customer_equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Add equipment to site's list
    equipment_ids = site.get("equipment_ids", [])
    if equipment_id not in equipment_ids:
        equipment_ids.append(equipment_id)
        await db.sites.update_one(
            {"id": site_id},
            {"$set": {"equipment_ids": equipment_ids, "updated_at": datetime.now(timezone.utc)}}
        )
    
    # Update equipment with site reference
    await db.customer_equipment.update_one(
        {"id": equipment_id},
        {"$set": {"site_id": site_id, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Equipment linked to site"}


@router.post("/migrate-from-jobs")
async def migrate_sites_from_jobs():
    """Auto-create sites from existing job addresses"""
    import uuid
    
    # Get unique addresses from jobs
    pipeline = [
        {"$match": {"site_address": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$site_address",
            "customer_id": {"$first": "$customer_id"},
            "customer_name": {"$first": "$customer_name"},
            "city": {"$first": "$site_city"},
            "state": {"$first": "$site_state"},
            "zip": {"$first": "$site_zip"},
            "job_count": {"$sum": 1}
        }}
    ]
    
    addresses = await db.jobs.aggregate(pipeline).to_list(1000)
    
    created_count = 0
    for addr in addresses:
        # Check if site already exists for this address
        existing = await db.sites.find_one({"address": addr["_id"]})
        if existing:
            continue
        
        site = {
            "id": str(uuid.uuid4()),
            "customer_id": addr.get("customer_id"),
            "customer_name": addr.get("customer_name"),
            "name": f"Site at {addr['_id'][:50]}...",
            "site_type": "residential",
            "address": addr["_id"],
            "city": addr.get("city"),
            "state": addr.get("state"),
            "zip_code": addr.get("zip"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.sites.insert_one(site)
        created_count += 1
    
    return {"message": f"Created {created_count} sites from job addresses"}
