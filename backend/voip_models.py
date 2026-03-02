# Phone.com VoIP Integration Models

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid

class VoIPCallLog(BaseModel):
    """Call log record for VoIP integration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Phone.com reference
    phone_com_call_id: Optional[str] = None
    
    # Call details
    caller_number: str
    called_number: str
    direction: Literal["inbound", "outbound"]
    status: Literal["initiated", "ringing", "answered", "completed", "missed", "failed", "voicemail"] = "initiated"
    
    # Duration and timing
    duration_seconds: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    # Recording
    recording_url: Optional[str] = None
    recording_downloaded: bool = False
    transcription: Optional[str] = None
    
    # Linking to BreezeFlow entities
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    job_id: Optional[str] = None
    lead_id: Optional[str] = None
    technician_id: Optional[str] = None
    
    # User who initiated (for outbound)
    initiated_by_user_id: Optional[str] = None
    initiated_by_user_name: Optional[str] = None
    
    # Notes and tags
    notes: Optional[str] = None
    tags: List[str] = []
    sentiment: Optional[Literal["positive", "neutral", "negative"]] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class VoIPSMS(BaseModel):
    """SMS message record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Phone.com reference
    phone_com_message_id: Optional[str] = None
    
    # Message details
    from_number: str
    to_number: str
    message: str
    direction: Literal["inbound", "outbound"]
    status: Literal["pending", "sent", "delivered", "failed", "received"] = "pending"
    
    # Linking
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    job_id: Optional[str] = None
    
    # User who sent (for outbound)
    sent_by_user_id: Optional[str] = None
    sent_by_user_name: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VoIPPhoneNumber(BaseModel):
    """Phone number available for calls/SMS"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone_com_id: Optional[str] = None
    number: str
    name: Optional[str] = None  # e.g., "Main Line", "Support"
    type: Literal["main", "support", "sales", "technician"] = "main"
    is_active: bool = True
    sms_enabled: bool = True
    call_recording_enabled: bool = True

class VoIPSettings(BaseModel):
    """VoIP integration settings"""
    enabled: bool = False
    api_key_configured: bool = False
    account_id: Optional[str] = None
    webhook_url: Optional[str] = None
    default_caller_id: Optional[str] = None
    call_recording_enabled: bool = True
    sms_enabled: bool = True
    auto_link_to_customers: bool = True  # Auto-match incoming calls to customers

class CallInitiateRequest(BaseModel):
    """Request to initiate an outbound call"""
    to_number: str
    from_number: Optional[str] = None  # If not provided, use default
    customer_id: Optional[str] = None
    job_id: Optional[str] = None
    notes: Optional[str] = None

class SMSSendRequest(BaseModel):
    """Request to send an SMS"""
    to_number: str
    from_number: Optional[str] = None
    message: str
    customer_id: Optional[str] = None
    job_id: Optional[str] = None

class CallAnalytics(BaseModel):
    """Call analytics summary"""
    total_calls: int = 0
    inbound_calls: int = 0
    outbound_calls: int = 0
    completed_calls: int = 0
    missed_calls: int = 0
    average_duration_seconds: float = 0
    total_duration_seconds: int = 0
    calls_by_status: dict = {}
    calls_by_hour: dict = {}
    top_callers: List[dict] = []
