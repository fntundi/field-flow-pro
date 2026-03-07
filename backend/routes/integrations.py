# Integrations Routes - Migrated from server.py
# Handles QuickBooks and other third-party integrations

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import os

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for integrations
router = APIRouter(prefix="/integrations", tags=["Integrations"])

# Get database instance
db = get_database()


# ==================== QUICKBOOKS INTEGRATION ====================

@router.get("/quickbooks/status")
async def get_quickbooks_status():
    """Get QuickBooks integration status"""
    settings = await db.system_settings.find_one({})
    
    return {
        "enabled": settings.get("quickbooks_enabled", False) if settings else False,
        "connected": settings.get("quickbooks_connected", False) if settings else False,
        "company_name": settings.get("quickbooks_company_name") if settings else None,
        "last_sync": settings.get("quickbooks_last_sync") if settings else None
    }


@router.put("/quickbooks/settings")
async def update_quickbooks_settings(data: dict):
    """Update QuickBooks settings"""
    update_data = {}
    
    if "enabled" in data:
        update_data["quickbooks_enabled"] = data["enabled"]
    if "client_id" in data:
        update_data["quickbooks_client_id"] = data["client_id"]
    if "client_secret" in data:
        update_data["quickbooks_client_secret"] = data["client_secret"]
    if "environment" in data:
        update_data["quickbooks_environment"] = data["environment"]  # sandbox or production
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "QuickBooks settings updated"}


@router.get("/quickbooks/auth-url")
async def get_quickbooks_auth_url():
    """Get QuickBooks OAuth authorization URL"""
    settings = await db.system_settings.find_one({})
    
    client_id = os.environ.get("QUICKBOOKS_CLIENT_ID")
    if settings and settings.get("quickbooks_client_id"):
        client_id = settings["quickbooks_client_id"]
    
    if not client_id:
        raise HTTPException(status_code=400, detail="QuickBooks client ID not configured")
    
    # Build OAuth URL
    redirect_uri = os.environ.get("QUICKBOOKS_REDIRECT_URI", 
                                   f"{os.environ.get('REACT_APP_BACKEND_URL', '')}/api/integrations/quickbooks/callback")
    
    environment = settings.get("quickbooks_environment", "sandbox") if settings else "sandbox"
    base_url = "https://appcenter.intuit.com" if environment == "production" else "https://sandbox-quickbooks.api.intuit.com"
    
    auth_url = (
        f"{base_url}/connect/oauth2"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&scope=com.intuit.quickbooks.accounting"
        f"&redirect_uri={redirect_uri}"
        f"&state=security_token"
    )
    
    return {"auth_url": auth_url}


@router.get("/quickbooks/callback")
async def quickbooks_callback(code: str, state: str, realmId: str):
    """Handle QuickBooks OAuth callback"""
    # In production, exchange code for tokens
    # For now, just mark as connected
    
    await db.system_settings.update_one(
        {},
        {"$set": {
            "quickbooks_connected": True,
            "quickbooks_realm_id": realmId,
            "quickbooks_connected_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "QuickBooks connected successfully", "realm_id": realmId}


@router.post("/quickbooks/disconnect")
async def disconnect_quickbooks():
    """Disconnect QuickBooks integration"""
    await db.system_settings.update_one(
        {},
        {"$set": {
            "quickbooks_connected": False,
            "quickbooks_access_token": None,
            "quickbooks_refresh_token": None,
            "quickbooks_realm_id": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "QuickBooks disconnected"}


@router.post("/quickbooks/sync")
async def sync_quickbooks(data: dict):
    """Trigger QuickBooks sync"""
    sync_type = data.get("sync_type", "all")  # all, customers, invoices, payments
    
    settings = await db.system_settings.find_one({})
    if not settings or not settings.get("quickbooks_connected"):
        raise HTTPException(status_code=400, detail="QuickBooks not connected")
    
    # Log sync attempt
    import uuid
    sync_log = {
        "id": str(uuid.uuid4()),
        "sync_type": sync_type,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc),
        "items_synced": 0,
        "errors": []
    }
    
    await db.quickbooks_sync_logs.insert_one(sync_log)
    
    # In production, this would trigger actual sync
    # For now, simulate success
    await db.quickbooks_sync_logs.update_one(
        {"id": sync_log["id"]},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc),
            "items_synced": 0,
            "message": "Sync scaffolding - no actual data synced"
        }}
    )
    
    await db.system_settings.update_one(
        {},
        {"$set": {"quickbooks_last_sync": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Sync initiated", "sync_id": sync_log["id"]}


@router.get("/quickbooks/sync-logs")
async def get_quickbooks_sync_logs(limit: int = 20):
    """Get QuickBooks sync history"""
    logs = await db.quickbooks_sync_logs.find().sort("started_at", -1).limit(limit).to_list(limit)
    for log in logs:
        log.pop("_id", None)
    return logs


# ==================== CUSTOMER EQUIPMENT ====================

@router.get("/customer-equipment")
async def get_customer_equipment(
    customer_id: Optional[str] = None,
    site_id: Optional[str] = None,
    equipment_type: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get customer equipment"""
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if site_id:
        query["site_id"] = site_id
    if equipment_type:
        query["equipment_type"] = equipment_type
    
    equipment = await db.customer_equipment.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for e in equipment:
        e.pop("_id", None)
    return equipment


@router.get("/customer-equipment/{equipment_id}")
async def get_equipment(equipment_id: str):
    """Get specific equipment"""
    if not validate_uuid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    equipment = await db.customer_equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipment.pop("_id", None)
    return equipment


@router.post("/customer-equipment")
async def create_customer_equipment(data: dict):
    """Create customer equipment record"""
    from models import CustomerEquipment
    
    equipment = CustomerEquipment(
        customer_id=data.get("customer_id"),
        site_id=data.get("site_id"),
        equipment_type=data.get("equipment_type", "hvac"),
        make=sanitize_string(data.get("make"), 100) if data.get("make") else None,
        model=sanitize_string(data.get("model"), 100) if data.get("model") else None,
        serial_number=sanitize_string(data.get("serial_number"), 100) if data.get("serial_number") else None,
        install_date=data.get("install_date"),
        warranty_expiration=data.get("warranty_expiration"),
        location_in_building=sanitize_string(data.get("location_in_building"), 200) if data.get("location_in_building") else None,
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    
    await db.customer_equipment.insert_one(equipment.dict())
    result = equipment.dict()
    return result


@router.put("/customer-equipment/{equipment_id}")
async def update_customer_equipment(equipment_id: str, data: dict):
    """Update customer equipment"""
    if not validate_uuid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    equipment = await db.customer_equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    update_data = {}
    allowed_fields = ["equipment_type", "make", "model", "serial_number", "install_date",
                      "warranty_expiration", "location_in_building", "notes", "site_id"]
    
    for key in allowed_fields:
        if key in data and data[key] is not None:
            if isinstance(data[key], str):
                update_data[key] = sanitize_string(data[key], 500)
            else:
                update_data[key] = data[key]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.customer_equipment.update_one({"id": equipment_id}, {"$set": update_data})
    updated = await db.customer_equipment.find_one({"id": equipment_id})
    updated.pop("_id", None)
    return updated


@router.delete("/customer-equipment/{equipment_id}")
async def delete_customer_equipment(equipment_id: str):
    """Delete customer equipment"""
    if not validate_uuid(equipment_id):
        raise HTTPException(status_code=400, detail="Invalid equipment ID")
    
    result = await db.customer_equipment.delete_one({"id": equipment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return {"message": "Equipment deleted"}
