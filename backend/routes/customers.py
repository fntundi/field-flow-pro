# Customers Routes - Migrated from server.py
# Handles customer CRUD operations

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for customers
router = APIRouter(prefix="/customers", tags=["Customers"])

# Get database instance
db = get_database()


@router.get("")
async def get_customers(search: Optional[str] = None, limit: int = 100):
    """Get all customers"""
    query = {}
    
    if search:
        safe_search = sanitize_string(search, 100)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"phone": {"$regex": safe_search, "$options": "i"}},
        ]
    
    customers = await db.customers.find(query).sort("name", 1).limit(limit).to_list(limit)
    for c in customers:
        c.pop("_id", None)
    return customers


@router.get("/{customer_id}")
async def get_customer(customer_id: str):
    """Get a specific customer"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer.pop("_id", None)
    return customer


@router.post("")
async def create_customer(customer_data: dict):
    """Create a new customer"""
    import uuid
    
    customer = {
        "id": str(uuid.uuid4()),
        "name": sanitize_string(customer_data.get("name", ""), 200),
        "email": sanitize_string(customer_data.get("email", ""), 255).lower() if customer_data.get("email") else None,
        "phone": sanitize_string(customer_data.get("phone"), 20) if customer_data.get("phone") else None,
        "address": sanitize_string(customer_data.get("address"), 500) if customer_data.get("address") else None,
        "city": sanitize_string(customer_data.get("city"), 100) if customer_data.get("city") else None,
        "state": sanitize_string(customer_data.get("state"), 50) if customer_data.get("state") else None,
        "zip": sanitize_string(customer_data.get("zip"), 20) if customer_data.get("zip") else None,
        "notes": sanitize_string(customer_data.get("notes"), 2000) if customer_data.get("notes") else None,
        "customer_type": customer_data.get("customer_type", "residential"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.customers.insert_one(customer)
    customer.pop("_id", None)
    return customer


@router.put("/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict):
    """Update a customer"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {}
    allowed_fields = ["name", "email", "phone", "address", "city", "state", "zip", "notes", "customer_type", "is_active"]
    
    for k, v in customer_data.items():
        if k in allowed_fields and v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 500)
            else:
                update_data[k] = v
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    updated = await db.customers.find_one({"id": customer_id})
    updated.pop("_id", None)
    return updated


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Soft delete a customer"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Customer deleted successfully"}
