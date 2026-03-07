# Settings Routes - Migrated from server.py
# Handles System Settings, AI Config, Maps Config, and Integrations

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone
import os

from .shared import (
    get_database, sanitize_string, logger
)

# Create router for settings
router = APIRouter(prefix="/settings", tags=["Settings"])

# Get database instance
db = get_database()


# ==================== SYSTEM SETTINGS ====================

@router.get("/system")
async def get_system_settings():
    """Get system settings"""
    settings = await db.system_settings.find_one({})
    if not settings:
        # Return default settings
        return {
            "company_name": "BreezeFlow HVAC",
            "timezone": "America/Chicago",
            "default_tax_rate": 8.25,
            "google_maps_enabled": False,
            "ai_features_enabled": True,
            "ai_provider": "gemini",
            "ai_model": "gemini-2.0-flash",
            "voip_enabled": False,
            "quickbooks_enabled": False,
            "push_notifications_enabled": False
        }
    
    settings.pop("_id", None)
    return settings


@router.put("/system")
async def update_system_settings(data: dict):
    """Update system settings"""
    allowed_fields = [
        "company_name", "timezone", "default_tax_rate",
        "google_maps_enabled", "google_maps_api_key",
        "ai_features_enabled", "ai_provider", "ai_model", "ai_failover_enabled",
        "voip_enabled", "voip_provider",
        "quickbooks_enabled",
        "push_notifications_enabled", "push_on_job_assigned", "push_on_job_status",
        "push_on_schedule_change", "push_on_chat_message"
    ]
    
    update_data = {}
    for key, value in data.items():
        if key in allowed_fields:
            if isinstance(value, str):
                update_data[key] = sanitize_string(value, 500)
            else:
                update_data[key] = value
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    updated = await db.system_settings.find_one({})
    updated.pop("_id", None)
    return updated


# ==================== AI CONFIG ====================

@router.get("/ai/config")
async def get_ai_config():
    """Get AI configuration"""
    settings = await db.system_settings.find_one({})
    
    return {
        "enabled": settings.get("ai_features_enabled", True) if settings else True,
        "provider": settings.get("ai_provider", "gemini") if settings else "gemini",
        "model": settings.get("ai_model", "gemini-2.0-flash") if settings else "gemini-2.0-flash",
        "failover_enabled": settings.get("ai_failover_enabled", True) if settings else True
    }


@router.put("/ai/config")
async def update_ai_config(data: dict):
    """Update AI configuration"""
    update_data = {}
    
    if "enabled" in data:
        update_data["ai_features_enabled"] = data["enabled"]
    if "provider" in data:
        update_data["ai_provider"] = data["provider"]
    if "model" in data:
        update_data["ai_model"] = data["model"]
    if "failover_enabled" in data:
        update_data["ai_failover_enabled"] = data["failover_enabled"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return await get_ai_config()


# ==================== MAPS CONFIG ====================

@router.get("/maps/config")
async def get_maps_config():
    """Get Google Maps configuration"""
    settings = await db.system_settings.find_one({})
    
    # Check if API key is available
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if settings and settings.get("google_maps_api_key"):
        api_key = settings["google_maps_api_key"]
    
    return {
        "enabled": settings.get("google_maps_enabled", False) if settings else False,
        "api_key_configured": bool(api_key),
        "features": {
            "routing": bool(api_key),
            "geocoding": bool(api_key),
            "distance_matrix": bool(api_key)
        }
    }


@router.put("/maps/config")
async def update_maps_config(data: dict):
    """Update Google Maps configuration"""
    update_data = {}
    
    if "enabled" in data:
        update_data["google_maps_enabled"] = data["enabled"]
    if "api_key" in data and data["api_key"]:
        update_data["google_maps_api_key"] = data["api_key"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_settings.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return await get_maps_config()


# ==================== PUSH NOTIFICATIONS ====================

@router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    # In production, this would be a real VAPID key
    return {
        "publicKey": os.environ.get("VAPID_PUBLIC_KEY", "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U")
    }


@router.post("/push/subscribe")
async def subscribe_push(data: dict):
    """Subscribe a device to push notifications"""
    user_id = data.get("user_id")
    subscription = data.get("subscription")
    device_name = data.get("device_name", "Unknown Device")
    
    if not subscription:
        raise HTTPException(status_code=400, detail="Subscription data required")
    
    # Store subscription
    import uuid
    sub_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "subscription": subscription,
        "device_name": device_name,
        "created_at": datetime.now(timezone.utc),
        "is_active": True
    }
    
    # Upsert by endpoint
    await db.push_subscriptions.update_one(
        {"subscription.endpoint": subscription.get("endpoint")},
        {"$set": sub_record},
        upsert=True
    )
    
    return {"message": "Subscribed to push notifications", "subscription_id": sub_record["id"]}


@router.post("/push/unsubscribe")
async def unsubscribe_push(data: dict):
    """Unsubscribe a device from push notifications"""
    endpoint = data.get("endpoint")
    
    if endpoint:
        await db.push_subscriptions.delete_one({"subscription.endpoint": endpoint})
    
    return {"message": "Unsubscribed from push notifications"}


@router.get("/push/subscriptions")
async def get_push_subscriptions(user_id: Optional[str] = None):
    """Get push subscriptions for a user"""
    query = {"is_active": True}
    if user_id:
        query["user_id"] = user_id
    
    subscriptions = await db.push_subscriptions.find(query).to_list(100)
    for sub in subscriptions:
        sub.pop("_id", None)
        # Don't expose full subscription data
        if "subscription" in sub:
            sub["endpoint_preview"] = sub["subscription"].get("endpoint", "")[:50] + "..."
            del sub["subscription"]
    
    return subscriptions


# ==================== ROLES ====================

@router.get("/roles")
async def get_roles():
    """Get all roles"""
    roles = await db.roles.find().to_list(50)
    for role in roles:
        role.pop("_id", None)
    
    if not roles:
        # Return default roles
        from models import DEFAULT_ROLES
        return DEFAULT_ROLES
    
    return roles


@router.post("/roles")
async def create_role(data: dict):
    """Create a new role"""
    from models import Role
    
    role = Role(
        name=sanitize_string(data.get("name", ""), 50),
        description=sanitize_string(data.get("description"), 200) if data.get("description") else None,
        permissions=data.get("permissions", [])
    )
    
    await db.roles.insert_one(role.dict())
    result = role.dict()
    return result


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    """Delete a role (if not system role)"""
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system role")
    
    # Check if role is in use
    users_with_role = await db.auth_users.count_documents({"role": role["name"]})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Role is assigned to {users_with_role} users")
    
    await db.roles.delete_one({"id": role_id})
    return {"message": "Role deleted"}
