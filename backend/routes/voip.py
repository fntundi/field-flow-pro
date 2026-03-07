# VoIP Routes - Migrated from server.py
# Handles Phone.com integration for calls and SMS

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import os

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for VoIP
router = APIRouter(prefix="/voip", tags=["VoIP"])

# Get database instance
db = get_database()

# Import VoIP service
try:
    from voip_service import phone_com_service
except ImportError:
    phone_com_service = None


@router.get("/status")
async def get_voip_status():
    """Get VoIP integration status"""
    if not phone_com_service:
        return {"enabled": False, "provider": "phone.com", "api_key_configured": False}
    
    return {
        "enabled": phone_com_service.is_configured,
        "provider": "phone.com",
        "api_key_configured": bool(phone_com_service.api_key),
        "account_id_configured": bool(phone_com_service.account_id),
    }


@router.post("/configure")
async def configure_voip(data: dict):
    """Configure VoIP integration"""
    api_key = data.get("api_key")
    account_id = data.get("account_id")
    webhook_secret = data.get("webhook_secret")
    
    if not api_key or not account_id:
        raise HTTPException(status_code=400, detail="API key and account ID required")
    
    await db.system_settings.update_one(
        {},
        {"$set": {
            "voip_enabled": True,
            "voip_provider": "phone.com",
            "voip_account_id": account_id,
            "voip_webhook_secret": webhook_secret,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"message": "VoIP configured successfully. Set PHONE_COM_API_KEY environment variable."}


@router.get("/phone-numbers")
async def get_voip_phone_numbers():
    """Get available phone numbers from Phone.com"""
    if not phone_com_service or not phone_com_service.is_configured:
        return {
            "numbers": [
                {"id": "demo-1", "number": "+1 (555) 123-4567", "name": "Main Line", "type": "main"},
                {"id": "demo-2", "number": "+1 (555) 987-6543", "name": "Support", "type": "support"},
            ],
            "demo_mode": True
        }
    
    try:
        numbers = await phone_com_service.get_phone_numbers()
        return {"numbers": numbers, "demo_mode": False}
    except Exception as e:
        logger.error(f"Error fetching phone numbers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calls/initiate")
async def initiate_voip_call(data: dict):
    """Initiate an outbound click-to-call"""
    from voip_models import VoIPCallLog
    
    to_number = data.get("to_number")
    from_number = data.get("from_number", "+15551234567")
    customer_id = data.get("customer_id")
    job_id = data.get("job_id")
    notes = data.get("notes")
    
    # Auto-lookup customer if phone number matches
    customer = None
    if not customer_id and to_number:
        customer = await db.customers.find_one({
            "$or": [
                {"phone": {"$regex": to_number[-10:]}},
                {"mobile": {"$regex": to_number[-10:]}}
            ]
        })
    elif customer_id:
        customer = await db.customers.find_one({"id": customer_id})
    
    # Create call log record
    call_log = VoIPCallLog(
        caller_number=from_number,
        called_number=to_number,
        direction="outbound",
        status="initiated",
        customer_id=customer["id"] if customer else customer_id,
        customer_name=customer["name"] if customer else None,
        job_id=job_id,
        notes=notes,
    )
    
    if phone_com_service and phone_com_service.is_configured:
        try:
            response = await phone_com_service.make_call(
                call_log.caller_number,
                call_log.called_number
            )
            call_log.phone_com_call_id = response.get("id")
            call_log.status = "ringing"
        except Exception as e:
            logger.error(f"Phone.com call error: {e}")
            call_log.status = "failed"
            call_log.notes = f"Error: {str(e)}"
    else:
        # Demo mode - simulate call
        call_log.status = "completed"
        call_log.duration_seconds = 45
        call_log.notes = "[DEMO MODE] Simulated call"
    
    await db.voip_call_logs.insert_one(call_log.dict())
    
    return {
        "success": call_log.status != "failed",
        "call_id": call_log.id,
        "status": call_log.status,
        "demo_mode": not (phone_com_service and phone_com_service.is_configured)
    }


@router.get("/calls")
async def get_voip_calls(
    limit: int = 50,
    offset: int = 0,
    customer_id: Optional[str] = None,
    job_id: Optional[str] = None,
    direction: Optional[str] = None
):
    """Get call logs"""
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if job_id:
        query["job_id"] = job_id
    if direction:
        query["direction"] = direction
    
    calls = await db.voip_call_logs.find(query)\
        .sort("created_at", -1)\
        .skip(offset)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.voip_call_logs.count_documents(query)
    
    for call in calls:
        call.pop("_id", None)
    
    return {"calls": calls, "total": total}


@router.get("/calls/{call_id}")
async def get_voip_call(call_id: str):
    """Get a specific call log"""
    call = await db.voip_call_logs.find_one({"id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call.pop("_id", None)
    return call


@router.put("/calls/{call_id}/notes")
async def update_call_notes(call_id: str, data: dict):
    """Update notes on a call log"""
    notes = data.get("notes")
    tags = data.get("tags", [])
    
    result = await db.voip_call_logs.update_one(
        {"id": call_id},
        {"$set": {
            "notes": notes,
            "tags": tags,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Notes updated"}


@router.post("/sms/send")
async def send_voip_sms(data: dict):
    """Send an SMS message"""
    from voip_models import VoIPSMS
    
    to_number = data.get("to_number")
    from_number = data.get("from_number", "+15551234567")
    message = data.get("message")
    customer_id = data.get("customer_id")
    job_id = data.get("job_id")
    
    # Auto-lookup customer
    customer = None
    if not customer_id and to_number:
        customer = await db.customers.find_one({
            "$or": [
                {"phone": {"$regex": to_number[-10:]}},
                {"mobile": {"$regex": to_number[-10:]}}
            ]
        })
    elif customer_id:
        customer = await db.customers.find_one({"id": customer_id})
    
    # Create SMS record
    sms = VoIPSMS(
        from_number=from_number,
        to_number=to_number,
        direction="outbound",
        message=sanitize_string(message, 1600),
        status="pending",
        customer_id=customer["id"] if customer else customer_id,
        customer_name=customer["name"] if customer else None,
        job_id=job_id,
    )
    
    if phone_com_service and phone_com_service.is_configured:
        try:
            response = await phone_com_service.send_sms(from_number, to_number, message)
            sms.phone_com_message_id = response.get("id")
            sms.status = "sent"
        except Exception as e:
            logger.error(f"Phone.com SMS error: {e}")
            sms.status = "failed"
    else:
        # Demo mode
        sms.status = "delivered"
    
    await db.voip_sms_logs.insert_one(sms.dict())
    
    return {
        "success": sms.status != "failed",
        "message_id": sms.id,
        "status": sms.status,
        "demo_mode": not (phone_com_service and phone_com_service.is_configured)
    }


@router.get("/sms")
async def get_voip_sms(
    limit: int = 50,
    offset: int = 0,
    customer_id: Optional[str] = None,
    job_id: Optional[str] = None
):
    """Get SMS logs"""
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if job_id:
        query["job_id"] = job_id
    
    messages = await db.voip_sms_logs.find(query)\
        .sort("created_at", -1)\
        .skip(offset)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.voip_sms_logs.count_documents(query)
    
    for msg in messages:
        msg.pop("_id", None)
    
    return {"messages": messages, "total": total}


@router.get("/analytics")
async def get_voip_analytics(days: int = 30):
    """Get VoIP call analytics"""
    from datetime import timedelta
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get call stats
    total_calls = await db.voip_call_logs.count_documents({"created_at": {"$gte": cutoff}})
    inbound_calls = await db.voip_call_logs.count_documents({"created_at": {"$gte": cutoff}, "direction": "inbound"})
    outbound_calls = await db.voip_call_logs.count_documents({"created_at": {"$gte": cutoff}, "direction": "outbound"})
    
    # Get calls by status
    status_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.voip_call_logs.aggregate(status_pipeline).to_list(10)
    
    # Average duration
    duration_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "duration_seconds": {"$gt": 0}}},
        {"$group": {"_id": None, "avg_duration": {"$avg": "$duration_seconds"}}}
    ]
    duration_result = await db.voip_call_logs.aggregate(duration_pipeline).to_list(1)
    avg_duration = duration_result[0]["avg_duration"] if duration_result else 0
    
    # SMS stats
    total_sms = await db.voip_sms_logs.count_documents({"created_at": {"$gte": cutoff}})
    
    return {
        "period_days": days,
        "total_calls": total_calls,
        "inbound_calls": inbound_calls,
        "outbound_calls": outbound_calls,
        "calls_by_status": {c["_id"]: c["count"] for c in status_counts},
        "avg_call_duration_seconds": round(avg_duration, 1),
        "total_sms": total_sms
    }


@router.post("/webhook/call")
async def voip_call_webhook(data: dict):
    """Webhook endpoint for call events from Phone.com"""
    event_type = data.get("event_type")
    call_id = data.get("call_id")
    
    if not call_id:
        return {"message": "OK"}
    
    # Find the call log by Phone.com call ID
    call = await db.voip_call_logs.find_one({"phone_com_call_id": call_id})
    
    if call:
        update_data = {"updated_at": datetime.now(timezone.utc)}
        
        if event_type == "call.answered":
            update_data["status"] = "in_progress"
            update_data["answered_at"] = datetime.now(timezone.utc)
        elif event_type == "call.ended":
            update_data["status"] = "completed"
            update_data["ended_at"] = datetime.now(timezone.utc)
            if data.get("duration"):
                update_data["duration_seconds"] = data["duration"]
        elif event_type == "call.missed":
            update_data["status"] = "missed"
        
        await db.voip_call_logs.update_one({"phone_com_call_id": call_id}, {"$set": update_data})
    
    return {"message": "OK"}


@router.post("/webhook/sms")
async def voip_sms_webhook(data: dict):
    """Webhook endpoint for SMS events from Phone.com"""
    from voip_models import VoIPSMS
    
    message_id = data.get("message_id")
    direction = data.get("direction", "inbound")
    
    if direction == "inbound":
        # Create new inbound SMS record
        from_number = data.get("from_number")
        to_number = data.get("to_number")
        message = data.get("message")
        
        # Try to match customer
        customer = await db.customers.find_one({
            "$or": [
                {"phone": {"$regex": from_number[-10:]}},
                {"mobile": {"$regex": from_number[-10:]}}
            ]
        }) if from_number else None
        
        sms = VoIPSMS(
            from_number=from_number,
            to_number=to_number,
            direction="inbound",
            message=message,
            status="received",
            customer_id=customer["id"] if customer else None,
            customer_name=customer["name"] if customer else None,
            phone_com_message_id=message_id,
        )
        
        await db.voip_sms_logs.insert_one(sms.dict())
    elif message_id:
        # Update outbound SMS status
        sms = await db.voip_sms_logs.find_one({"phone_com_message_id": message_id})
        if sms:
            await db.voip_sms_logs.update_one(
                {"phone_com_message_id": message_id},
                {"$set": {"status": data.get("status", "delivered"), "updated_at": datetime.now(timezone.utc)}}
            )
    
    return {"message": "OK"}
