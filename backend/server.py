from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
import math
import hashlib
import secrets
import asyncio
import json
from pathlib import Path
from typing import List, Optional, Dict, Set
import uuid
from datetime import datetime, timedelta, timezone
import googlemaps
import jwt
from passlib.context import CryptContext

from models import (
    User, UserCreate, UserResponse,
    UserAuth, UserRegister, UserLogin, TokenResponse,
    Technician, TechnicianCreate, TechnicianUpdate, TechnicianPublicProfile,
    Certification, License, WorkHistoryEntry,
    BoardConfig, BoardConfigCreate, BoardConfigUpdate, StatusColumn,
    Task, TaskCreate, TaskUpdate, TaskMoveRequest,
    Job, JobCreate, JobUpdate,
    Appointment, AppointmentCreate, AppointmentConfirmation,
    ImageUploadRequest, ImageUploadResponse,
    # Time tracking models
    GeoLocation, TimeEntry, TimeEntryCreate, ShiftSession, 
    JobTimeEntry, JobTimeEntryCreate, TechnicianMetrics, RouteEstimate,
    # Inventory models
    InventoryCategory, InventoryCategoryCreate,
    InventoryItem, InventoryItemCreate, InventoryItemUpdate,
    TruckInventory, TruckInventoryItem, TruckStockCheck, TruckStockCheckCreate,
    RestockRequest, RestockRequestCreate,
    JobEquipmentUsage, JobEquipmentApproval, InventoryAuditLog,
    # J-Load models
    JLoadQuickEstimate, JLoadQuickEstimateCreate,
    ManualJLoadCalculation, ManualJLoadCreate,
    # Truck models
    Truck, TruckCreate, TruckUpdate,
    # Routing & Maps
    RouteCalculation, RouteRequest,
    # Maintenance Agreements
    MaintenanceAgreementTemplate, MaintenanceAgreement, MaintenanceAgreementCreate,
    # Gantt / Project Management
    ProjectPhase, InstallProject, InstallProjectCreate, ProjectPhaseCreate,
    # Customer Portal
    CustomerAccount, CustomerAccountCreate, CustomerLogin, MagicLinkRequest,
    ServiceRequest, ServiceRequestCreate,
    # Offline Sync
    OfflineSyncQueue, SyncBatch, ConflictResolution, SyncStatus,
    # RFC-002 Phase 1 & 2 - Leads, PCBs, Sales
    Role, RoleCreate, DEFAULT_ROLES,
    Lead, LeadCreate, LeadUpdate,
    PCB, PCBCreate, PCBUpdate,
    Proposal, ProposalCreate, ProposalOption, ProposalLineItem,
    JobTypeTemplate, JobTypeTemplateCreate, ChecklistItemTemplate,
    JobChecklist, JobChecklistItem, ChecklistItemEvidence,
    Vendor, VendorCreate, PurchaseOrder, PurchaseOrderCreate, PurchaseOrderLineItem,
    WarehouseLocation, LocationInventoryItem, InventoryTransfer,
    Invoice, InvoiceCreate, InvoiceLineItem,
    Payment, PaymentCreate,
    CustomerEquipment, CustomerEquipmentCreate,
    SystemSettings,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'field_service_db')]

# Create the main app
app = FastAPI(title="Field Service Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== SECURITY UTILITIES ====================

# JWT Settings
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer for JWT
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = await db.auth_users.find_one({"id": user_id})
    if not user:
        return None
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    user = await get_current_user(credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# Maximum image size (5MB)
MAX_IMAGE_SIZE = 5 * 1024 * 1024

# Allowed image MIME types
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

def sanitize_string(value: str, max_length: int = 1000) -> str:
    """Sanitize string input to prevent injection attacks"""
    if not value:
        return value
    # Remove any control characters (ASCII 0-31 and 127-159)
    value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    # Truncate to max length
    return value[:max_length].strip()

def sanitize_search_query(query: str) -> str:
    """Sanitize search query for MongoDB regex"""
    if not query:
        return query
    # Escape special regex characters
    return re.escape(sanitize_string(query, 200))

def validate_uuid(value: str) -> bool:
    """Validate UUID format"""
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False

def validate_base64_image(data: str) -> tuple[bool, str]:
    """Validate base64 image data"""
    if not data:
        return False, "No image data provided"
    
    # Check if it's a data URL
    if data.startswith('data:'):
        # Extract MIME type and base64 content
        match = re.match(r'data:([^;]+);base64,(.+)', data)
        if not match:
            return False, "Invalid data URL format"
        
        mime_type = match.group(1)
        base64_content = match.group(2)
        
        if mime_type not in ALLOWED_IMAGE_TYPES:
            return False, f"Image type {mime_type} not allowed"
    else:
        base64_content = data
    
    # Validate base64 content
    try:
        decoded = base64.b64decode(base64_content)
        if len(decoded) > MAX_IMAGE_SIZE:
            return False, f"Image size exceeds maximum of {MAX_IMAGE_SIZE // (1024*1024)}MB"
    except Exception:
        return False, "Invalid base64 encoding"
    
    return True, "Valid"

# ==================== ERROR HANDLING ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "status_code": 500}
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Field Service Management API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "healthy", "database": db_status, "timestamp": datetime.utcnow().isoformat()}

# ==================== AUTHENTICATION API ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    """Register a new user with email/password"""
    # Check if user exists
    existing = await db.auth_users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = UserAuth(
        email=data.email.lower(),
        name=sanitize_string(data.name, 200),
        password_hash=hash_password(data.password),
        role=data.role,
        auth_provider="local",
    )
    await db.auth_users.insert_one(user.dict())
    
    # Create access token
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "avatar_url": user.avatar_url,
        }
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """Login with email/password"""
    user = await db.auth_users.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Update last login
    await db.auth_users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create access token
    token = create_access_token({"sub": user["id"], "email": user["email"], "role": user["role"]})
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "avatar_url": user.get("avatar_url"),
        }
    )

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(require_auth)):
    """Get current user profile"""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "avatar_url": user.get("avatar_url"),
        "phone": user.get("phone"),
        "auth_provider": user.get("auth_provider", "local"),
    }

@api_router.put("/auth/me")
async def update_me(data: dict, user: dict = Depends(require_auth)):
    """Update current user profile"""
    update_data = {}
    if "name" in data:
        update_data["name"] = sanitize_string(data["name"], 200)
    if "phone" in data:
        update_data["phone"] = sanitize_string(data["phone"], 20)
    if "avatar_url" in data:
        update_data["avatar_url"] = data["avatar_url"]
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.auth_users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated = await db.auth_users.find_one({"id": user["id"]})
    updated.pop("_id", None)
    updated.pop("password_hash", None)
    
    return updated

@api_router.post("/auth/change-password")
async def change_password(data: dict, user: dict = Depends(require_auth)):
    """Change password for authenticated user"""
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")
    
    # Get user with password hash
    db_user = await db.auth_users.find_one({"id": user["id"]})
    if not db_user or not verify_password(current_password, db_user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    await db.auth_users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hash_password(new_password),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/users")
async def get_users(user: dict = Depends(require_auth)):
    """Get all users (admin only)"""
    if user["role"] not in ["admin", "owner", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.auth_users.find().to_list(500)
    for u in users:
        u.pop("_id", None)
        u.pop("password_hash", None)
    
    return users

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict, user: dict = Depends(require_auth)):
    """Update user role (admin only)"""
    if user["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    new_role = data.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Role required")
    
    await db.auth_users.update_one(
        {"id": user_id},
        {"$set": {"role": new_role, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"User role updated to {new_role}"}

# ==================== GOOGLE OAUTH API ====================

import httpx

@api_router.post("/auth/google/session")
async def google_session_exchange(data: dict, response: JSONResponse):
    """Exchange Google OAuth session_id for user data and create local session"""
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    # Call Emergent Auth to get session data
    try:
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            google_data = auth_response.json()
    except httpx.RequestError as e:
        logger.error(f"Error calling Emergent Auth: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    # Extract user data from Google response
    email = google_data.get("email", "").lower()
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")
    google_session_token = google_data.get("session_token", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
    
    # Check if user exists, if not create them
    existing_user = await db.auth_users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        # Update existing user with Google data
        await db.auth_users.update_one(
            {"email": email},
            {"$set": {
                "google_id": google_data.get("id"),
                "name": name or existing_user.get("name"),
                "avatar_url": picture or existing_user.get("avatar_url"),
                "auth_provider": "google",
                "last_login": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        user_id = existing_user["id"]
        user_role = existing_user.get("role", "technician")
    else:
        # Create new user
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "email": email,
            "name": name,
            "google_id": google_data.get("id"),
            "avatar_url": picture,
            "role": "technician",  # Default role for new Google users
            "auth_provider": "google",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc)
        }
        await db.auth_users.insert_one(new_user)
        user_role = "technician"
    
    # Store session token in database
    session_expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "session_token": google_session_token,
            "expires_at": session_expires,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Create our own JWT token for the user
    access_token = create_access_token({"sub": user_id, "email": email, "role": user_role})
    
    # Get fresh user data
    user = await db.auth_users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "technician"),
            "avatar_url": user.get("avatar_url"),
            "auth_provider": "google"
        }
    }

@api_router.post("/auth/google/logout")
async def google_logout(user: dict = Depends(require_auth)):
    """Logout user by deleting session"""
    # Delete session from database
    await db.user_sessions.delete_one({"user_id": user["id"]})
    return {"message": "Logged out successfully"}

# ==================== DEFAULT DATA INITIALIZATION ====================

async def ensure_default_board_config():
    """Ensure default board configuration exists"""
    existing = await db.board_configs.find_one({"is_default": True})
    if not existing:
        default_columns = [
            StatusColumn(id=str(uuid.uuid4()), name="Lead", key="lead", color="#6366f1", order=0, is_default=True),
            StatusColumn(id=str(uuid.uuid4()), name="Diagnostic Call", key="diagnostic_call", color="#8b5cf6", order=1, is_default=True),
            StatusColumn(id=str(uuid.uuid4()), name="Sales Call Scheduled", key="sales_call_scheduled", color="#ec4899", order=2, is_default=True),
            StatusColumn(id=str(uuid.uuid4()), name="Dispatched", key="dispatched", color="#f59e0b", order=3, is_default=True),
            StatusColumn(id=str(uuid.uuid4()), name="Out for Service", key="out_for_service", color="#3b82f6", order=4, is_default=True),
            StatusColumn(id=str(uuid.uuid4()), name="Completed", key="completed", color="#22c55e", order=5, is_default=True),
        ]
        default_config = BoardConfig(
            name="Default Board",
            description="Default board configuration for jobs",
            columns=default_columns,
            is_default=True,
        )
        await db.board_configs.insert_one(default_config.dict())
        logger.info("Created default board configuration")
    return existing or await db.board_configs.find_one({"is_default": True})

# ==================== USERS API ====================

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate):
    # Sanitize inputs
    email = sanitize_string(user_data.email, 255).lower()
    name = sanitize_string(user_data.name, 100)
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=email,
        name=name,
        role=user_data.role,
        password_hash=user_data.password,  # In production, use proper hashing!
    )
    await db.users.insert_one(user.dict())
    return UserResponse(**user.dict())

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(role: Optional[str] = None):
    query = {}
    if role:
        query["role"] = sanitize_string(role, 50)
    users = await db.users.find(query).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    if not validate_uuid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

# ==================== TECHNICIANS API ====================

@api_router.post("/technicians", response_model=Technician)
async def create_technician(tech_data: TechnicianCreate):
    # Sanitize inputs
    sanitized_data = tech_data.dict()
    sanitized_data["name"] = sanitize_string(tech_data.name, 100)
    sanitized_data["email"] = sanitize_string(tech_data.email, 255).lower()
    sanitized_data["phone"] = sanitize_string(tech_data.phone, 20)
    sanitized_data["specialty"] = sanitize_string(tech_data.specialty, 100)
    sanitized_data["location"] = sanitize_string(tech_data.location, 200)
    
    count = await db.technicians.count_documents({})
    employee_number = sanitize_string(tech_data.employee_number, 20) or f"TECH-{count + 1001}"
    
    tech = Technician(
        employee_number=employee_number,
        **{k: v for k, v in sanitized_data.items() if k != "employee_number"}
    )
    await db.technicians.insert_one(tech.dict())
    return tech

@api_router.get("/technicians", response_model=List[Technician])
async def get_technicians(
    status: Optional[str] = None,
    specialty: Optional[str] = None,
    search: Optional[str] = None
):
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
    return [Technician(**t) for t in technicians]

@api_router.get("/technicians/{tech_id}", response_model=Technician)
async def get_technician(tech_id: str):
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return Technician(**tech)

@api_router.get("/technicians/{tech_id}/public", response_model=TechnicianPublicProfile)
async def get_technician_public_profile(tech_id: str):
    """Get public-facing technician profile for customers"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return TechnicianPublicProfile(
        id=tech["id"],
        name=tech["name"],
        role=tech["role"],
        specialty=tech["specialty"],
        profile_image=tech.get("profile_image"),
        rating=tech.get("rating", 5.0),
        years_experience=tech.get("years_experience", 0),
        bio=tech.get("bio"),
    )

@api_router.put("/technicians/{tech_id}", response_model=Technician)
async def update_technician(tech_id: str, tech_data: TechnicianUpdate):
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    update_data = {}
    for k, v in tech_data.dict().items():
        if v is not None:
            if isinstance(v, str) and k not in ['status', 'status_label']:
                update_data[k] = sanitize_string(v, 500)
            else:
                update_data[k] = v
    update_data["updated_at"] = datetime.utcnow()
    
    await db.technicians.update_one({"id": tech_id}, {"$set": update_data})
    updated_tech = await db.technicians.find_one({"id": tech_id})
    return Technician(**updated_tech)

@api_router.delete("/technicians/{tech_id}")
async def delete_technician(tech_id: str):
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    result = await db.technicians.delete_one({"id": tech_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"message": "Technician deleted successfully"}

@api_router.post("/technicians/{tech_id}/image", response_model=ImageUploadResponse)
async def upload_technician_image(tech_id: str, image_data: ImageUploadRequest):
    """Upload technician profile image as base64"""
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    # Validate image data
    is_valid, message = validate_base64_image(image_data.image_data)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Ensure proper data URL format
    if not image_data.image_data.startswith("data:image"):
        image_base64 = f"data:image/jpeg;base64,{image_data.image_data}"
    else:
        image_base64 = image_data.image_data
    
    await db.technicians.update_one(
        {"id": tech_id},
        {"$set": {"profile_image": image_base64, "updated_at": datetime.utcnow()}}
    )
    
    return ImageUploadResponse(success=True, message="Profile image updated successfully")

@api_router.put("/technicians/{tech_id}/status")
async def update_technician_status(tech_id: str, status: str, status_label: str):
    if not validate_uuid(tech_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    await db.technicians.update_one(
        {"id": tech_id},
        {"$set": {
            "status": sanitize_string(status, 50),
            "status_label": sanitize_string(status_label, 50),
            "updated_at": datetime.utcnow()
        }}
    )
    return {"message": "Status updated successfully"}

# ==================== BOARD CONFIG API ====================

@api_router.get("/board-configs", response_model=List[BoardConfig])
async def get_board_configs():
    await ensure_default_board_config()
    configs = await db.board_configs.find().to_list(100)
    return [BoardConfig(**c) for c in configs]

@api_router.get("/board-configs/default", response_model=BoardConfig)
async def get_default_board_config():
    config = await ensure_default_board_config()
    return BoardConfig(**config)

@api_router.get("/board-configs/{config_id}", response_model=BoardConfig)
async def get_board_config(config_id: str):
    if not validate_uuid(config_id):
        raise HTTPException(status_code=400, detail="Invalid config ID format")
    config = await db.board_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Board config not found")
    return BoardConfig(**config)

@api_router.post("/board-configs", response_model=BoardConfig)
async def create_board_config(config_data: BoardConfigCreate):
    # Sanitize column names
    sanitized_columns = []
    for col in config_data.columns:
        sanitized_col = StatusColumn(
            id=col.id or str(uuid.uuid4()),
            name=sanitize_string(col.name, 50),
            key=sanitize_string(col.key, 50).lower().replace(" ", "_"),
            color=sanitize_string(col.color, 20),
            order=col.order,
            is_default=False
        )
        sanitized_columns.append(sanitized_col)
    
    config = BoardConfig(
        name=sanitize_string(config_data.name, 100),
        description=sanitize_string(config_data.description, 500) if config_data.description else None,
        columns=sanitized_columns,
    )
    await db.board_configs.insert_one(config.dict())
    return config

@api_router.put("/board-configs/{config_id}", response_model=BoardConfig)
async def update_board_config(config_id: str, config_data: BoardConfigUpdate):
    if not validate_uuid(config_id):
        raise HTTPException(status_code=400, detail="Invalid config ID format")
    config = await db.board_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Board config not found")
    
    update_data = {}
    if config_data.name:
        update_data["name"] = sanitize_string(config_data.name, 100)
    if config_data.description:
        update_data["description"] = sanitize_string(config_data.description, 500)
    if config_data.columns:
        sanitized_columns = []
        for col in config_data.columns:
            sanitized_col = {
                "id": col.id or str(uuid.uuid4()),
                "name": sanitize_string(col.name, 50),
                "key": sanitize_string(col.key, 50),
                "color": sanitize_string(col.color, 20),
                "order": col.order,
                "is_default": col.is_default
            }
            sanitized_columns.append(sanitized_col)
        update_data["columns"] = sanitized_columns
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.board_configs.update_one({"id": config_id}, {"$set": update_data})
    updated = await db.board_configs.find_one({"id": config_id})
    return BoardConfig(**updated)

@api_router.delete("/board-configs/{config_id}")
async def delete_board_config(config_id: str):
    if not validate_uuid(config_id):
        raise HTTPException(status_code=400, detail="Invalid config ID format")
    config = await db.board_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Board config not found")
    if config.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete default board config")
    
    await db.board_configs.delete_one({"id": config_id})
    return {"message": "Board config deleted successfully"}

# ==================== JOBS API ====================

@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate):
    count = await db.jobs.count_documents({})
    
    # Sanitize all string inputs
    job = Job(
        job_number=f"JOB-{count + 1001}",
        customer_name=sanitize_string(job_data.customer_name, 200),
        customer_id=job_data.customer_id,
        customer_phone=sanitize_string(job_data.customer_phone, 20) if job_data.customer_phone else None,
        customer_email=sanitize_string(job_data.customer_email, 255) if job_data.customer_email else None,
        site_address=sanitize_string(job_data.site_address, 500),
        site_city=sanitize_string(job_data.site_city, 100) if job_data.site_city else None,
        site_state=sanitize_string(job_data.site_state, 50) if job_data.site_state else None,
        site_zip=sanitize_string(job_data.site_zip, 20) if job_data.site_zip else None,
        job_type=sanitize_string(job_data.job_type, 100),
        title=sanitize_string(job_data.title, 200),
        description=sanitize_string(job_data.description, 2000) if job_data.description else None,
        priority=job_data.priority,
        scheduled_date=job_data.scheduled_date,
        estimated_hours=job_data.estimated_hours,
    )
    await db.jobs.insert_one(job.dict())
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000, ge=1),
    offset: int = Query(default=0, ge=0)
):
    query = {}
    if status:
        if status == "active":
            query["status"] = {"$in": ["open", "in_progress", "urgent"]}
        else:
            query["status"] = sanitize_string(status, 50)
    if priority:
        query["priority"] = sanitize_string(priority, 50)
    if customer_id:
        query["customer_id"] = sanitize_string(customer_id, 100)
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"job_number": {"$regex": safe_search, "$options": "i"}},
            {"customer_name": {"$regex": safe_search, "$options": "i"}},
            {"site_address": {"$regex": safe_search, "$options": "i"}},
            {"title": {"$regex": safe_search, "$options": "i"}},
        ]
    
    jobs = await db.jobs.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [Job(**j) for j in jobs]

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    safe_id = sanitize_string(job_id, 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return Job(**job)

@api_router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_data: JobUpdate):
    safe_id = sanitize_string(job_id, 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {}
    for k, v in job_data.dict().items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    update_data["updated_at"] = datetime.utcnow()
    
    await db.jobs.update_one({"id": job["id"]}, {"$set": update_data})
    updated = await db.jobs.find_one({"id": job["id"]})
    return Job(**updated)

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    safe_id = sanitize_string(job_id, 100)
    result = await db.jobs.delete_one({"$or": [{"id": safe_id}, {"job_number": safe_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    # Also delete associated tasks
    await db.tasks.delete_many({"job_id": safe_id})
    return {"message": "Job deleted successfully"}

# ==================== TASKS API ====================

@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate):
    safe_job_id = sanitize_string(task_data.job_id, 100)
    job = await db.jobs.find_one({"$or": [{"id": safe_job_id}, {"job_number": safe_job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    tech_name = None
    if task_data.assigned_technician_id:
        if not validate_uuid(task_data.assigned_technician_id):
            raise HTTPException(status_code=400, detail="Invalid technician ID format")
        tech = await db.technicians.find_one({"id": task_data.assigned_technician_id})
        if tech:
            tech_name = tech["name"]
    
    max_order = await db.tasks.find(
        {"job_id": job["id"], "status": task_data.status}
    ).sort("order", -1).limit(1).to_list(1)
    order = (max_order[0]["order"] + 1) if max_order else 0
    
    count = await db.tasks.count_documents({})
    task = Task(
        task_number=f"TASK-{count + 1001}",
        job_id=job["id"],
        title=sanitize_string(task_data.title, 200),
        description=sanitize_string(task_data.description, 2000) if task_data.description else None,
        task_type=task_data.task_type,
        status=sanitize_string(task_data.status, 50),
        priority=task_data.priority,
        assigned_technician_id=task_data.assigned_technician_id,
        assigned_technician_name=tech_name,
        scheduled_date=task_data.scheduled_date,
        scheduled_time=task_data.scheduled_time,
        estimated_duration=sanitize_string(task_data.estimated_duration, 50) if task_data.estimated_duration else None,
        notes=sanitize_string(task_data.notes, 2000) if task_data.notes else None,
        order=order,
    )
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    technician_id: Optional[str] = None,
    task_type: Optional[str] = None
):
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
    return [Task(**t) for t in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    safe_id = sanitize_string(task_id, 100)
    task = await db.tasks.find_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_data: TaskUpdate):
    safe_id = sanitize_string(task_id, 100)
    task = await db.tasks.find_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {}
    for k, v in task_data.dict().items():
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
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.tasks.update_one({"id": task["id"]}, {"$set": update_data})
    updated = await db.tasks.find_one({"id": task["id"]})
    return Task(**updated)

@api_router.post("/tasks/move", response_model=Task)
async def move_task(move_data: TaskMoveRequest):
    """Move a task to a new status column and/or reorder"""
    if not validate_uuid(move_data.task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    
    task = await db.tasks.find_one({"id": move_data.task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_status = task["status"]
    old_order = task["order"]
    new_status = sanitize_string(move_data.new_status, 50)
    new_order = max(0, move_data.new_order)  # Ensure non-negative
    
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
        {"id": move_data.task_id},
        {"$set": {
            "status": new_status,
            "order": new_order,
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated = await db.tasks.find_one({"id": move_data.task_id})
    return Task(**updated)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    safe_id = sanitize_string(task_id, 100)
    result = await db.tasks.delete_one({"$or": [{"id": safe_id}, {"task_number": safe_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ==================== APPOINTMENTS API ====================

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt_data: AppointmentCreate):
    if not validate_uuid(appt_data.technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID format")
    
    tech = await db.technicians.find_one({"id": appt_data.technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    appointment = Appointment(
        job_id=sanitize_string(appt_data.job_id, 100),
        task_id=appt_data.task_id,
        technician_id=appt_data.technician_id,
        customer_name=sanitize_string(appt_data.customer_name, 200),
        customer_phone=sanitize_string(appt_data.customer_phone, 20) if appt_data.customer_phone else None,
        customer_email=sanitize_string(appt_data.customer_email, 255) if appt_data.customer_email else None,
        site_address=sanitize_string(appt_data.site_address, 500),
        scheduled_date=appt_data.scheduled_date,
        scheduled_time=appt_data.scheduled_time,
        estimated_duration=sanitize_string(appt_data.estimated_duration, 50) if appt_data.estimated_duration else None,
        job_type=sanitize_string(appt_data.job_type, 100),
        notes=sanitize_string(appt_data.notes, 2000) if appt_data.notes else None,
    )
    await db.appointments.insert_one(appointment.dict())
    return appointment

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(
    job_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    status: Optional[str] = None,
    date: Optional[str] = None
):
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
    return [Appointment(**a) for a in appointments]

@api_router.get("/appointments/{appt_id}", response_model=Appointment)
async def get_appointment(appt_id: str):
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return Appointment(**appointment)

@api_router.get("/appointments/confirmation/{token}", response_model=AppointmentConfirmation)
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
    
    tech_profile = TechnicianPublicProfile(
        id=tech["id"],
        name=tech["name"],
        role=tech["role"],
        specialty=tech["specialty"],
        profile_image=tech.get("profile_image"),
        rating=tech.get("rating", 5.0),
        years_experience=tech.get("years_experience", 0),
        bio=tech.get("bio"),
    )
    
    return AppointmentConfirmation(
        appointment_id=appointment["id"],
        job_number=job_number,
        scheduled_date=appointment["scheduled_date"],
        scheduled_time=appointment["scheduled_time"],
        estimated_duration=appointment.get("estimated_duration"),
        job_type=appointment["job_type"],
        site_address=appointment["site_address"],
        technician=tech_profile,
        notes=appointment.get("notes"),
        status=appointment["status"],
    )

@api_router.put("/appointments/{appt_id}/status")
async def update_appointment_status(appt_id: str, status: str):
    if not validate_uuid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {"status": sanitize_string(status, 50), "updated_at": datetime.utcnow()}}
    )
    return {"message": "Appointment status updated"}

# ==================== TIME TRACKING API ====================

def calculate_distance_miles(loc1: GeoLocation, loc2: GeoLocation) -> float:
    """Calculate distance between two points using Haversine formula"""
    R = 3959  # Earth's radius in miles
    
    lat1, lon1 = math.radians(loc1.latitude), math.radians(loc1.longitude)
    lat2, lon2 = math.radians(loc2.latitude), math.radians(loc2.longitude)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def estimate_travel_time(distance_miles: float, route_count: int = 3) -> float:
    """
    Estimate travel time based on distance.
    Simulates averaging top 3 routes by adding variance.
    Assumes average speed of 25-35 mph for urban/suburban driving.
    """
    # Base estimate at 30 mph average
    base_minutes = (distance_miles / 30) * 60
    
    # Simulate 3 route options with variance
    routes = [
        base_minutes * 0.9,   # Fastest route
        base_minutes * 1.0,   # Average route
        base_minutes * 1.15,  # Slowest route with traffic
    ]
    
    # Return average of top 3 routes
    return sum(routes[:route_count]) / route_count

@api_router.post("/time-tracking/shift/start")
async def start_shift(technician_id: str, location: Optional[GeoLocation] = None):
    """Clock in for shift - captures technician's starting location"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    tech = await db.technicians.find_one({"id": technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    # Check for existing active shift
    existing = await db.shift_sessions.find_one({
        "technician_id": technician_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Active shift already exists. End current shift first.")
    
    session = ShiftSession(
        technician_id=technician_id,
        shift_start=datetime.utcnow(),
        shift_start_location=location,
        status="active"
    )
    
    await db.shift_sessions.insert_one(session.dict())
    
    # Update technician status
    await db.technicians.update_one(
        {"id": technician_id},
        {"$set": {"status": "available", "status_label": "On Shift", "updated_at": datetime.utcnow()}}
    )
    
    # Log time entry
    entry = TimeEntry(
        technician_id=technician_id,
        entry_type="shift_start",
        location=location
    )
    await db.time_entries.insert_one(entry.dict())
    
    return {
        "message": "Shift started",
        "session_id": session.id,
        "shift_start": session.shift_start.isoformat(),
        "location_captured": location is not None
    }

@api_router.post("/time-tracking/shift/end")
async def end_shift(technician_id: str, location: Optional[GeoLocation] = None):
    """Clock out from shift"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    session = await db.shift_sessions.find_one({
        "technician_id": technician_id,
        "status": "active"
    })
    if not session:
        raise HTTPException(status_code=400, detail="No active shift found")
    
    shift_start = session["shift_start"]
    if isinstance(shift_start, str):
        shift_start = datetime.fromisoformat(shift_start.replace("Z", "+00:00"))
    
    shift_end = datetime.utcnow()
    total_minutes = (shift_end - shift_start).total_seconds() / 60
    
    # Count completed jobs in this shift
    jobs_completed = await db.job_time_entries.count_documents({
        "shift_session_id": session["id"],
        "status": "completed"
    })
    
    await db.shift_sessions.update_one(
        {"id": session["id"]},
        {"$set": {
            "shift_end": shift_end,
            "shift_end_location": location.dict() if location else None,
            "total_shift_minutes": total_minutes,
            "jobs_completed": jobs_completed,
            "status": "completed"
        }}
    )
    
    # Update technician status
    await db.technicians.update_one(
        {"id": technician_id},
        {"$set": {"status": "off_duty", "status_label": "Off Duty", "updated_at": datetime.utcnow()}}
    )
    
    # Log time entry
    entry = TimeEntry(
        technician_id=technician_id,
        entry_type="shift_end",
        location=location
    )
    await db.time_entries.insert_one(entry.dict())
    
    return {
        "message": "Shift ended",
        "session_id": session["id"],
        "total_shift_hours": round(total_minutes / 60, 2),
        "jobs_completed": jobs_completed
    }

@api_router.get("/time-tracking/shift/active/{technician_id}")
async def get_active_shift(technician_id: str):
    """Get active shift for a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    session = await db.shift_sessions.find_one({
        "technician_id": technician_id,
        "status": "active"
    })
    
    if not session:
        return {"active": False, "session": None}
    
    return {"active": True, "session": ShiftSession(**session)}

@api_router.post("/time-tracking/job/dispatch")
async def dispatch_to_job(data: JobTimeEntryCreate):
    """Dispatch technician to a job - starts travel tracking"""
    if not validate_uuid(data.technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    tech = await db.technicians.find_one({"id": data.technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    job = await db.jobs.find_one({"$or": [{"id": data.job_id}, {"job_number": data.job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get active shift
    shift = await db.shift_sessions.find_one({
        "technician_id": data.technician_id,
        "status": "active"
    })
    
    # Calculate estimated travel time if we have locations
    estimated_travel = None
    estimated_distance = None
    
    if data.dispatch_location:
        # Mock job location based on address (in real app, geocode the address)
        # For demo, use Dallas area coordinates with slight variation
        job_lat = 32.7767 + (hash(job["site_address"]) % 100) / 1000
        job_lon = -96.7970 + (hash(job["site_address"]) % 100) / 1000
        
        job_location = GeoLocation(
            latitude=job_lat,
            longitude=job_lon,
            address=f"{job['site_address']}, {job.get('site_city', '')}"
        )
        
        estimated_distance = calculate_distance_miles(data.dispatch_location, job_location)
        estimated_travel = estimate_travel_time(estimated_distance)
    
    entry = JobTimeEntry(
        technician_id=data.technician_id,
        job_id=job["id"],
        job_number=job["job_number"],
        job_type=job["job_type"],
        shift_session_id=shift["id"] if shift else None,
        dispatch_time=datetime.utcnow(),
        dispatch_location=data.dispatch_location,
        estimated_travel_minutes=estimated_travel,
        estimated_route_distance_miles=estimated_distance,
        status="traveling"
    )
    
    await db.job_time_entries.insert_one(entry.dict())
    
    # Update technician status
    await db.technicians.update_one(
        {"id": data.technician_id},
        {"$set": {"status": "en_route", "status_label": f"En Route - {job['job_number']}", "updated_at": datetime.utcnow()}}
    )
    
    return {
        "message": "Dispatched to job",
        "entry_id": entry.id,
        "job_number": job["job_number"],
        "estimated_travel_minutes": round(estimated_travel, 1) if estimated_travel else None,
        "estimated_distance_miles": round(estimated_distance, 1) if estimated_distance else None
    }

@api_router.post("/time-tracking/job/arrive/{entry_id}")
async def arrive_at_job(entry_id: str, location: Optional[GeoLocation] = None):
    """Clock in at job site - marks arrival and calculates actual travel time"""
    if not validate_uuid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID")
    
    entry = await db.job_time_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Job time entry not found")
    
    if entry["status"] != "traveling":
        raise HTTPException(status_code=400, detail="Invalid status for arrival")
    
    arrival_time = datetime.utcnow()
    dispatch_time = entry["dispatch_time"]
    if isinstance(dispatch_time, str):
        dispatch_time = datetime.fromisoformat(dispatch_time.replace("Z", "+00:00"))
    
    actual_travel = (arrival_time - dispatch_time).total_seconds() / 60
    
    # Calculate travel variance
    travel_variance = None
    if entry.get("estimated_travel_minutes"):
        travel_variance = actual_travel - entry["estimated_travel_minutes"]
    
    await db.job_time_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "job_start": arrival_time,
            "job_start_location": location.dict() if location else None,
            "actual_travel_minutes": actual_travel,
            "travel_variance_minutes": travel_variance,
            "status": "on_site",
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update technician status
    await db.technicians.update_one(
        {"id": entry["technician_id"]},
        {"$set": {"status": "on_job", "status_label": f"On Site - {entry['job_number']}", "updated_at": datetime.utcnow()}}
    )
    
    # Log time entry
    time_entry = TimeEntry(
        technician_id=entry["technician_id"],
        job_id=entry["job_id"],
        entry_type="job_start",
        location=location
    )
    await db.time_entries.insert_one(time_entry.dict())
    
    return {
        "message": "Arrived at job site",
        "actual_travel_minutes": round(actual_travel, 1),
        "estimated_travel_minutes": entry.get("estimated_travel_minutes"),
        "travel_variance_minutes": round(travel_variance, 1) if travel_variance else None
    }

@api_router.post("/time-tracking/job/complete/{entry_id}")
async def complete_job(entry_id: str, location: Optional[GeoLocation] = None, notes: Optional[str] = None):
    """Clock out from job site - marks completion and calculates job duration"""
    if not validate_uuid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID")
    
    entry = await db.job_time_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Job time entry not found")
    
    if entry["status"] != "on_site":
        raise HTTPException(status_code=400, detail="Invalid status for completion")
    
    completion_time = datetime.utcnow()
    job_start = entry["job_start"]
    if isinstance(job_start, str):
        job_start = datetime.fromisoformat(job_start.replace("Z", "+00:00"))
    
    actual_job_minutes = (completion_time - job_start).total_seconds() / 60
    
    await db.job_time_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "job_end": completion_time,
            "job_end_location": location.dict() if location else None,
            "actual_job_minutes": actual_job_minutes,
            "status": "completed",
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update technician status back to available
    await db.technicians.update_one(
        {"id": entry["technician_id"]},
        {"$set": {"status": "available", "status_label": "Available", "updated_at": datetime.utcnow()}}
    )
    
    # Log time entry
    time_entry = TimeEntry(
        technician_id=entry["technician_id"],
        job_id=entry["job_id"],
        entry_type="job_end",
        location=location,
        notes=notes
    )
    await db.time_entries.insert_one(time_entry.dict())
    
    # Update technician metrics
    await update_technician_metrics(entry["technician_id"])
    
    return {
        "message": "Job completed",
        "actual_job_minutes": round(actual_job_minutes, 1),
        "actual_job_hours": round(actual_job_minutes / 60, 2),
        "travel_minutes": entry.get("actual_travel_minutes")
    }

@api_router.get("/time-tracking/job/active/{technician_id}")
async def get_active_job_entry(technician_id: str):
    """Get active job time entry for a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    entry = await db.job_time_entries.find_one({
        "technician_id": technician_id,
        "status": {"$in": ["traveling", "on_site"]}
    })
    
    if not entry:
        return {"active": False, "entry": None}
    
    return {"active": True, "entry": JobTimeEntry(**entry)}

async def update_technician_metrics(technician_id: str):
    """Update aggregated metrics for a technician"""
    tech = await db.technicians.find_one({"id": technician_id})
    if not tech:
        return
    
    # Get all completed job entries for this technician
    entries = await db.job_time_entries.find({
        "technician_id": technician_id,
        "status": "completed"
    }).to_list(1000)
    
    if not entries:
        return
    
    # Calculate travel metrics
    travel_times = [e["actual_travel_minutes"] for e in entries if e.get("actual_travel_minutes")]
    travel_variances = [e["travel_variance_minutes"] for e in entries if e.get("travel_variance_minutes") is not None]
    
    avg_travel = sum(travel_times) / len(travel_times) if travel_times else 0
    total_travel = sum(travel_times)
    avg_variance = sum(travel_variances) / len(travel_variances) if travel_variances else 0
    
    # Calculate job duration metrics by type
    job_times_by_type = {
        "residential_repair": [],
        "commercial_repair": [],
        "residential_install": [],
        "commercial_install": [],
        "maintenance": [],
        "emergency": [],
    }
    
    for entry in entries:
        if not entry.get("actual_job_minutes"):
            continue
        job_type = (entry.get("job_type") or "").lower()
        
        if "residential" in job_type and ("repair" in job_type or "service" in job_type):
            job_times_by_type["residential_repair"].append(entry["actual_job_minutes"])
        elif "commercial" in job_type and ("repair" in job_type or "service" in job_type):
            job_times_by_type["commercial_repair"].append(entry["actual_job_minutes"])
        elif "residential" in job_type and "install" in job_type:
            job_times_by_type["residential_install"].append(entry["actual_job_minutes"])
        elif "commercial" in job_type and "install" in job_type:
            job_times_by_type["commercial_install"].append(entry["actual_job_minutes"])
        elif "maintenance" in job_type:
            job_times_by_type["maintenance"].append(entry["actual_job_minutes"])
        elif "emergency" in job_type:
            job_times_by_type["emergency"].append(entry["actual_job_minutes"])
    
    # Calculate averages
    def safe_avg(lst):
        return sum(lst) / len(lst) if lst else 0
    
    # Recent entries (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_entries = [e for e in entries if e.get("created_at", datetime.min) > thirty_days_ago]
    recent_travel = [e["actual_travel_minutes"] for e in recent_entries if e.get("actual_travel_minutes")]
    recent_variance = [e["travel_variance_minutes"] for e in recent_entries if e.get("travel_variance_minutes") is not None]
    
    metrics = TechnicianMetrics(
        technician_id=technician_id,
        technician_name=tech["name"],
        avg_travel_minutes=round(avg_travel, 1),
        total_travel_minutes=round(total_travel, 1),
        travel_entries_count=len(travel_times),
        travel_variance_avg=round(avg_variance, 1),
        avg_job_minutes_residential_repair=round(safe_avg(job_times_by_type["residential_repair"]), 1),
        avg_job_minutes_commercial_repair=round(safe_avg(job_times_by_type["commercial_repair"]), 1),
        avg_job_minutes_residential_install=round(safe_avg(job_times_by_type["residential_install"]), 1),
        avg_job_minutes_commercial_install=round(safe_avg(job_times_by_type["commercial_install"]), 1),
        avg_job_minutes_maintenance=round(safe_avg(job_times_by_type["maintenance"]), 1),
        avg_job_minutes_emergency=round(safe_avg(job_times_by_type["emergency"]), 1),
        total_jobs_tracked=len(entries),
        total_job_minutes=round(sum(e.get("actual_job_minutes", 0) for e in entries), 1),
        recent_avg_travel_minutes=round(safe_avg(recent_travel), 1),
        recent_travel_variance=round(safe_avg(recent_variance), 1),
    )
    
    # Upsert metrics
    await db.technician_metrics.update_one(
        {"technician_id": technician_id},
        {"$set": metrics.dict()},
        upsert=True
    )

@api_router.get("/time-tracking/metrics/{technician_id}", response_model=TechnicianMetrics)
async def get_technician_metrics(technician_id: str):
    """Get aggregated time tracking metrics for a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    tech = await db.technicians.find_one({"id": technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    metrics = await db.technician_metrics.find_one({"technician_id": technician_id})
    
    if not metrics:
        # Return empty metrics
        return TechnicianMetrics(
            technician_id=technician_id,
            technician_name=tech["name"]
        )
    
    return TechnicianMetrics(**metrics)

@api_router.post("/time-tracking/route-estimate")
async def get_route_estimate(origin: GeoLocation, destination: GeoLocation):
    """Calculate estimated travel time between two points (average of top 3 routes)"""
    distance = calculate_distance_miles(origin, destination)
    estimated_minutes = estimate_travel_time(distance, route_count=3)
    
    confidence = "high" if distance < 10 else "medium" if distance < 30 else "low"
    
    return RouteEstimate(
        origin=origin,
        destination=destination,
        estimated_minutes=round(estimated_minutes, 1),
        estimated_miles=round(distance, 1),
        route_count=3,
        confidence=confidence
    )

@api_router.get("/time-tracking/history/{technician_id}")
async def get_time_tracking_history(
    technician_id: str,
    days: int = Query(default=30, le=365, ge=1)
):
    """Get time tracking history for a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    since = datetime.utcnow() - timedelta(days=days)
    
    entries = await db.job_time_entries.find({
        "technician_id": technician_id,
        "created_at": {"$gte": since}
    }).sort("created_at", -1).to_list(100)
    
    shifts = await db.shift_sessions.find({
        "technician_id": technician_id,
        "created_at": {"$gte": since}
    }).sort("created_at", -1).to_list(50)
    
    return {
        "job_entries": [JobTimeEntry(**e) for e in entries],
        "shifts": [ShiftSession(**s) for s in shifts]
    }

# ==================== INVENTORY CATEGORIES API ====================

STANDARD_CATEGORIES = [
    {"name": "Filters", "description": "Air filters, cabin filters", "icon": "filter", "sort_order": 1},
    {"name": "Refrigerant", "description": "R-410A, R-22, R-32", "icon": "thermometer", "sort_order": 2},
    {"name": "Copper & Fittings", "description": "Copper tubing, fittings, valves", "icon": "wrench", "sort_order": 3},
    {"name": "Electrical", "description": "Wiring, breakers, contactors", "icon": "zap", "sort_order": 4},
    {"name": "Motors", "description": "Blower motors, condenser motors", "icon": "settings", "sort_order": 5},
    {"name": "Capacitors", "description": "Run capacitors, start capacitors", "icon": "battery", "sort_order": 6},
    {"name": "Compressors", "description": "Scroll, reciprocating compressors", "icon": "cpu", "sort_order": 7},
    {"name": "Thermostats", "description": "Smart, programmable thermostats", "icon": "thermometer", "sort_order": 8},
    {"name": "Tools", "description": "Gauges, meters, hand tools", "icon": "tool", "sort_order": 9},
    {"name": "Safety Equipment", "description": "PPE, safety gear", "icon": "shield", "sort_order": 10},
]

async def ensure_standard_categories():
    """Ensure standard inventory categories exist"""
    for cat_data in STANDARD_CATEGORIES:
        existing = await db.inventory_categories.find_one({"name": cat_data["name"], "is_standard": True})
        if not existing:
            cat = InventoryCategory(
                name=cat_data["name"],
                description=cat_data["description"],
                icon=cat_data["icon"],
                sort_order=cat_data["sort_order"],
                is_standard=True
            )
            await db.inventory_categories.insert_one(cat.dict())

@api_router.get("/inventory/categories", response_model=List[InventoryCategory])
async def get_inventory_categories():
    """Get all inventory categories"""
    await ensure_standard_categories()
    categories = await db.inventory_categories.find().sort("sort_order", 1).to_list(100)
    return [InventoryCategory(**c) for c in categories]

@api_router.post("/inventory/categories", response_model=InventoryCategory)
async def create_inventory_category(data: InventoryCategoryCreate):
    """Create a custom inventory category"""
    category = InventoryCategory(
        name=sanitize_string(data.name, 100),
        description=sanitize_string(data.description, 500) if data.description else None,
        icon=data.icon,
        sort_order=data.sort_order,
        is_standard=False
    )
    await db.inventory_categories.insert_one(category.dict())
    return category

@api_router.delete("/inventory/categories/{category_id}")
async def delete_inventory_category(category_id: str):
    """Delete a custom category (cannot delete standard categories)"""
    if not validate_uuid(category_id):
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    category = await db.inventory_categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.get("is_standard"):
        raise HTTPException(status_code=400, detail="Cannot delete standard categories")
    
    await db.inventory_categories.delete_one({"id": category_id})
    return {"message": "Category deleted"}

# ==================== INVENTORY ITEMS API ====================

@api_router.get("/inventory/items", response_model=List[InventoryItem])
async def get_inventory_items(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True
):
    """Get all inventory items"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if active_only:
        query["is_active"] = True
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"sku": {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}},
        ]
    
    items = await db.inventory_items.find(query).sort("name", 1).to_list(1000)
    return [InventoryItem(**i) for i in items]

@api_router.get("/inventory/items/{item_id}", response_model=InventoryItem)
async def get_inventory_item(item_id: str):
    """Get a specific inventory item"""
    if not validate_uuid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")
    item = await db.inventory_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItem(**item)

@api_router.post("/inventory/items", response_model=InventoryItem)
async def create_inventory_item(data: InventoryItemCreate):
    """Create a new inventory item"""
    # Get category name
    category = await db.inventory_categories.find_one({"id": data.category_id})
    category_name = category["name"] if category else None
    
    item = InventoryItem(
        sku=sanitize_string(data.sku, 50),
        name=sanitize_string(data.name, 200),
        description=sanitize_string(data.description, 500) if data.description else None,
        category_id=data.category_id,
        category_name=category_name,
        unit=data.unit,
        unit_cost=data.unit_cost,
        retail_price=data.retail_price,
        min_stock_threshold=data.min_stock_threshold,
        is_serialized=data.is_serialized
    )
    await db.inventory_items.insert_one(item.dict())
    return item

@api_router.put("/inventory/items/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, data: InventoryItemUpdate):
    """Update an inventory item"""
    if not validate_uuid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    item = await db.inventory_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if "category_id" in update_data:
        category = await db.inventory_categories.find_one({"id": update_data["category_id"]})
        update_data["category_name"] = category["name"] if category else None
    
    update_data["updated_at"] = datetime.utcnow()
    await db.inventory_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await db.inventory_items.find_one({"id": item_id})
    return InventoryItem(**updated)

# ==================== TRUCKS API ====================

@api_router.get("/trucks", response_model=List[Truck])
async def get_trucks(status: Optional[str] = None):
    """Get all trucks"""
    query = {}
    if status:
        query["status"] = status
    trucks = await db.trucks.find(query).sort("truck_number", 1).to_list(100)
    return [Truck(**t) for t in trucks]

@api_router.get("/trucks/{truck_id}", response_model=Truck)
async def get_truck(truck_id: str):
    """Get a specific truck"""
    if not validate_uuid(truck_id):
        raise HTTPException(status_code=400, detail="Invalid truck ID")
    truck = await db.trucks.find_one({"id": truck_id})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return Truck(**truck)

@api_router.post("/trucks", response_model=Truck)
async def create_truck(data: TruckCreate):
    """Create a new truck"""
    tech_name = None
    if data.assigned_technician_id:
        tech = await db.technicians.find_one({"id": data.assigned_technician_id})
        tech_name = tech["name"] if tech else None
    
    truck = Truck(
        truck_number=sanitize_string(data.truck_number, 50),
        name=sanitize_string(data.name, 100),
        vin=data.vin,
        make=data.make,
        model=data.model,
        year=data.year,
        license_plate=data.license_plate,
        assigned_technician_id=data.assigned_technician_id,
        assigned_technician_name=tech_name
    )
    await db.trucks.insert_one(truck.dict())
    
    # Create empty truck inventory
    truck_inv = TruckInventory(
        truck_id=truck.id,
        truck_name=truck.name,
        technician_id=data.assigned_technician_id,
        technician_name=tech_name
    )
    await db.truck_inventories.insert_one(truck_inv.dict())
    
    return truck

@api_router.put("/trucks/{truck_id}", response_model=Truck)
async def update_truck(truck_id: str, data: TruckUpdate):
    """Update a truck"""
    if not validate_uuid(truck_id):
        raise HTTPException(status_code=400, detail="Invalid truck ID")
    
    truck = await db.trucks.find_one({"id": truck_id})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if "assigned_technician_id" in update_data:
        tech = await db.technicians.find_one({"id": update_data["assigned_technician_id"]})
        update_data["assigned_technician_name"] = tech["name"] if tech else None
    
    update_data["updated_at"] = datetime.utcnow()
    await db.trucks.update_one({"id": truck_id}, {"$set": update_data})
    
    # Update truck inventory assignment too
    await db.truck_inventories.update_one(
        {"truck_id": truck_id},
        {"$set": {
            "technician_id": update_data.get("assigned_technician_id"),
            "technician_name": update_data.get("assigned_technician_name"),
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated = await db.trucks.find_one({"id": truck_id})
    return Truck(**updated)

@api_router.get("/trucks/by-technician/{technician_id}", response_model=Truck)
async def get_truck_by_technician(technician_id: str):
    """Get truck assigned to a technician"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    truck = await db.trucks.find_one({"assigned_technician_id": technician_id, "status": "active"})
    if not truck:
        raise HTTPException(status_code=404, detail="No truck assigned to this technician")
    return Truck(**truck)

# ==================== TRUCK INVENTORY API ====================

@api_router.get("/truck-inventory/{truck_id}")
async def get_truck_inventory(truck_id: str):
    """Get inventory for a specific truck"""
    if not validate_uuid(truck_id):
        raise HTTPException(status_code=400, detail="Invalid truck ID")
    
    inv = await db.truck_inventories.find_one({"truck_id": truck_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Truck inventory not found")
    
    # Exclude MongoDB _id field
    inv.pop("_id", None)
    return inv

@api_router.put("/truck-inventory/{truck_id}/items")
async def update_truck_inventory_items(truck_id: str, items: List[dict]):
    """Update items in truck inventory"""
    if not validate_uuid(truck_id):
        raise HTTPException(status_code=400, detail="Invalid truck ID")
    
    inv = await db.truck_inventories.find_one({"truck_id": truck_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Truck inventory not found")
    
    # Enrich items with category info
    enriched_items = []
    for item in items:
        inv_item = await db.inventory_items.find_one({"id": item.get("item_id")})
        if inv_item:
            enriched_items.append({
                "item_id": item["item_id"],
                "item_name": inv_item["name"],
                "sku": inv_item["sku"],
                "category_id": inv_item["category_id"],
                "category_name": inv_item.get("category_name"),
                "quantity": item.get("quantity", 0),
                "min_threshold": inv_item.get("min_stock_threshold", 1),
                "unit": inv_item.get("unit", "each"),
                "last_counted": item.get("last_counted"),
                "needs_restock": item.get("quantity", 0) < inv_item.get("min_stock_threshold", 1)
            })
    
    await db.truck_inventories.update_one(
        {"truck_id": truck_id},
        {"$set": {"items": enriched_items, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Truck inventory updated", "items_count": len(enriched_items)}

@api_router.post("/truck-inventory/{truck_id}/add-item")
async def add_item_to_truck(truck_id: str, item_id: str, quantity: int):
    """Add an item to truck inventory"""
    if not validate_uuid(truck_id) or not validate_uuid(item_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    inv = await db.truck_inventories.find_one({"truck_id": truck_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Truck inventory not found")
    
    inv_item = await db.inventory_items.find_one({"id": item_id})
    if not inv_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    items = inv.get("items", [])
    existing_idx = next((i for i, x in enumerate(items) if x.get("item_id") == item_id), None)
    
    if existing_idx is not None:
        items[existing_idx]["quantity"] = quantity
        items[existing_idx]["last_counted"] = datetime.utcnow().isoformat()
        items[existing_idx]["needs_restock"] = quantity < inv_item.get("min_stock_threshold", 1)
    else:
        items.append({
            "item_id": item_id,
            "item_name": inv_item["name"],
            "sku": inv_item["sku"],
            "category_id": inv_item["category_id"],
            "category_name": inv_item.get("category_name"),
            "quantity": quantity,
            "min_threshold": inv_item.get("min_stock_threshold", 1),
            "unit": inv_item.get("unit", "each"),
            "last_counted": datetime.utcnow().isoformat(),
            "needs_restock": quantity < inv_item.get("min_stock_threshold", 1)
        })
    
    await db.truck_inventories.update_one(
        {"truck_id": truck_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Item added to truck inventory"}

# ==================== STOCK CHECK API ====================

@api_router.post("/stock-check", response_model=TruckStockCheck)
async def submit_stock_check(data: TruckStockCheckCreate):
    """Submit a truck stock check (at shift start)"""
    truck = await db.trucks.find_one({"id": data.truck_id})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    tech = await db.technicians.find_one({"id": data.technician_id})
    tech_name = tech["name"] if tech else "Unknown"
    
    # Calculate items below threshold
    items_below = []
    for item in data.items_checked:
        if item.get("actual_qty", 0) < item.get("min_threshold", 1):
            items_below.append(item)
    
    stock_check = TruckStockCheck(
        truck_id=data.truck_id,
        technician_id=data.technician_id,
        technician_name=tech_name,
        shift_session_id=data.shift_session_id,
        check_type=data.check_type,
        items_checked=data.items_checked,
        items_below_threshold=items_below,
        notes=data.notes
    )
    await db.stock_checks.insert_one(stock_check.dict())
    
    # Update truck inventory with new counts
    inv = await db.truck_inventories.find_one({"truck_id": data.truck_id})
    if inv:
        items = inv.get("items", [])
        for checked in data.items_checked:
            for item in items:
                if item.get("item_id") == checked.get("item_id"):
                    item["quantity"] = checked.get("actual_qty", 0)
                    item["last_counted"] = datetime.utcnow().isoformat()
                    item["needs_restock"] = checked.get("actual_qty", 0) < item.get("min_threshold", 1)
        
        await db.truck_inventories.update_one(
            {"truck_id": data.truck_id},
            {"$set": {
                "items": items,
                "last_stock_check": datetime.utcnow(),
                "stock_check_required": False,
                "updated_at": datetime.utcnow()
            }}
        )
    
    # Auto-generate restock request if items are below threshold
    if items_below:
        restock_items = []
        for item in items_below:
            inv_item = await db.inventory_items.find_one({"id": item.get("item_id")})
            if inv_item:
                restock_items.append({
                    "item_id": item["item_id"],
                    "item_name": inv_item["name"],
                    "sku": inv_item["sku"],
                    "current_qty": item.get("actual_qty", 0),
                    "requested_qty": inv_item.get("min_stock_threshold", 1) * 2,  # Restock to 2x minimum
                    "reason": "Below minimum threshold"
                })
        
        if restock_items:
            restock = RestockRequest(
                truck_id=data.truck_id,
                truck_name=truck["name"],
                technician_id=data.technician_id,
                technician_name=tech_name,
                request_type="auto",
                items=restock_items,
                priority="normal" if len(items_below) < 3 else "high",
                notes=f"Auto-generated from stock check. {len(items_below)} items below threshold."
            )
            await db.restock_requests.insert_one(restock.dict())
    
    return stock_check

@api_router.get("/stock-check/required/{technician_id}")
async def check_if_stock_check_required(technician_id: str):
    """Check if technician needs to do stock check before starting work"""
    if not validate_uuid(technician_id):
        raise HTTPException(status_code=400, detail="Invalid technician ID")
    
    truck = await db.trucks.find_one({"assigned_technician_id": technician_id, "status": "active"})
    if not truck:
        return {"required": False, "reason": "No truck assigned"}
    
    inv = await db.truck_inventories.find_one({"truck_id": truck["id"]})
    if not inv:
        return {"required": True, "reason": "No inventory record", "truck_id": truck["id"]}
    
    # Check if stock check was done today
    last_check = inv.get("last_stock_check")
    if last_check:
        if isinstance(last_check, str):
            last_check = datetime.fromisoformat(last_check.replace("Z", "+00:00"))
        if last_check.date() == datetime.utcnow().date():
            return {"required": False, "reason": "Already checked today", "truck_id": truck["id"]}
    
    return {
        "required": True,
        "reason": "Daily stock check required",
        "truck_id": truck["id"],
        "truck_name": truck["name"],
        "items": inv.get("items", [])
    }

@api_router.get("/stock-checks", response_model=List[TruckStockCheck])
async def get_stock_checks(
    truck_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    days: int = 7
):
    """Get stock check history"""
    query = {}
    if truck_id:
        query["truck_id"] = truck_id
    if technician_id:
        query["technician_id"] = technician_id
    
    since = datetime.utcnow() - timedelta(days=days)
    query["created_at"] = {"$gte": since}
    
    checks = await db.stock_checks.find(query).sort("created_at", -1).to_list(100)
    return [TruckStockCheck(**c) for c in checks]

# ==================== RESTOCK REQUESTS API ====================

@api_router.get("/restock-requests", response_model=List[RestockRequest])
async def get_restock_requests(
    status: Optional[str] = None,
    truck_id: Optional[str] = None,
    priority: Optional[str] = None
):
    """Get restock requests"""
    query = {}
    if status:
        query["status"] = status
    if truck_id:
        query["truck_id"] = truck_id
    if priority:
        query["priority"] = priority
    
    requests = await db.restock_requests.find(query).sort("created_at", -1).to_list(100)
    return [RestockRequest(**r) for r in requests]

@api_router.post("/restock-requests", response_model=RestockRequest)
async def create_restock_request(data: RestockRequestCreate):
    """Create a manual restock request"""
    truck = await db.trucks.find_one({"id": data.truck_id})
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    tech_name = None
    if data.technician_id:
        tech = await db.technicians.find_one({"id": data.technician_id})
        tech_name = tech["name"] if tech else None
    
    restock = RestockRequest(
        truck_id=data.truck_id,
        truck_name=truck["name"],
        technician_id=data.technician_id,
        technician_name=tech_name,
        request_type=data.request_type,
        items=data.items,
        priority=data.priority,
        notes=data.notes
    )
    await db.restock_requests.insert_one(restock.dict())
    return restock

@api_router.put("/restock-requests/{request_id}/status")
async def update_restock_status(request_id: str, status: str, approved_by: Optional[str] = None):
    """Update restock request status"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.restock_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Restock request not found")
    
    update_data = {"status": status, "updated_at": datetime.utcnow()}
    if status == "approved" and approved_by:
        update_data["approved_by"] = approved_by
        update_data["approved_at"] = datetime.utcnow()
    elif status == "completed":
        update_data["completed_at"] = datetime.utcnow()
        
        # Update truck inventory with restocked items
        for item in request.get("items", []):
            await db.truck_inventories.update_one(
                {"truck_id": request["truck_id"], "items.item_id": item["item_id"]},
                {"$set": {
                    "items.$.quantity": item.get("requested_qty", 0),
                    "items.$.needs_restock": False,
                    "items.$.last_counted": datetime.utcnow().isoformat()
                }}
            )
            
            # Log audit entry
            audit = InventoryAuditLog(
                truck_id=request["truck_id"],
                item_id=item["item_id"],
                item_name=item.get("item_name", ""),
                sku=item.get("sku", ""),
                action="restock",
                quantity_before=item.get("current_qty", 0),
                quantity_change=item.get("requested_qty", 0) - item.get("current_qty", 0),
                quantity_after=item.get("requested_qty", 0),
                restock_request_id=request_id,
                performed_by_id=approved_by or "system",
                performed_by_name="System",
                notes=f"Restocked via request {request_id}"
            )
            await db.inventory_audit_log.insert_one(audit.dict())
    
    await db.restock_requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": f"Status updated to {status}"}

# ==================== JOB EQUIPMENT USAGE API ====================

@api_router.post("/jobs/{job_id}/equipment-usage")
async def create_job_equipment_usage(job_id: str, technician_id: str, truck_id: str, planned_items: List[dict] = []):
    """Create equipment usage record for a job (called when job starts)"""
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    tech = await db.technicians.find_one({"id": technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    usage = JobEquipmentUsage(
        job_id=job["id"],
        job_number=job["job_number"],
        technician_id=technician_id,
        technician_name=tech["name"],
        truck_id=truck_id,
        planned_items=planned_items
    )
    await db.job_equipment_usage.insert_one(usage.dict())
    return usage

@api_router.get("/jobs/{job_id}/equipment-usage")
async def get_job_equipment_usage(job_id: str):
    """Get equipment usage for a job"""
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    usage = await db.job_equipment_usage.find_one({"job_id": job["id"]})
    if not usage:
        return None
    return usage

@api_router.post("/jobs/{job_id}/equipment-usage/approve")
async def approve_job_equipment(job_id: str, approval: JobEquipmentApproval):
    """Technician approves/edits equipment actually used on job"""
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    usage = await db.job_equipment_usage.find_one({"job_id": job["id"]})
    if not usage:
        raise HTTPException(status_code=404, detail="Equipment usage record not found")
    
    # Check for variance between planned and actual
    planned_ids = {i.get("item_id"): i.get("quantity", 0) for i in usage.get("planned_items", [])}
    actual_ids = {i.get("item_id"): i.get("quantity", 0) for i in approval.actual_items}
    has_variance = planned_ids != actual_ids
    
    await db.job_equipment_usage.update_one(
        {"id": usage["id"]},
        {"$set": {
            "actual_items": approval.actual_items,
            "tech_approved": True,
            "tech_approved_at": datetime.utcnow(),
            "tech_notes": approval.notes,
            "has_variance": has_variance,
            "status": "adjusted" if has_variance else "approved",
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Deduct from truck inventory and create audit logs
    truck_id = usage["truck_id"]
    for item in approval.actual_items:
        item_id = item.get("item_id")
        qty_used = item.get("quantity", 0)
        
        if qty_used > 0:
            # Get current truck inventory
            inv = await db.truck_inventories.find_one({"truck_id": truck_id})
            if inv:
                items = inv.get("items", [])
                for inv_item in items:
                    if inv_item.get("item_id") == item_id:
                        old_qty = inv_item.get("quantity", 0)
                        new_qty = max(0, old_qty - qty_used)
                        inv_item["quantity"] = new_qty
                        inv_item["needs_restock"] = new_qty < inv_item.get("min_threshold", 1)
                        
                        # Create audit log
                        audit = InventoryAuditLog(
                            truck_id=truck_id,
                            item_id=item_id,
                            item_name=item.get("item_name", inv_item.get("item_name", "")),
                            sku=item.get("sku", inv_item.get("sku", "")),
                            action="job_usage",
                            quantity_before=old_qty,
                            quantity_change=-qty_used,
                            quantity_after=new_qty,
                            job_id=job["id"],
                            job_number=job["job_number"],
                            performed_by_id=usage["technician_id"],
                            performed_by_name=usage["technician_name"],
                            notes=f"Used on job {job['job_number']}"
                        )
                        await db.inventory_audit_log.insert_one(audit.dict())
                        break
                
                await db.truck_inventories.update_one(
                    {"truck_id": truck_id},
                    {"$set": {"items": items, "updated_at": datetime.utcnow()}}
                )
    
    # Mark inventory as deducted
    await db.job_equipment_usage.update_one(
        {"id": usage["id"]},
        {"$set": {"inventory_deducted": True, "inventory_deducted_at": datetime.utcnow()}}
    )
    
    return {"message": "Equipment approved and inventory updated", "has_variance": has_variance}

# ==================== INVENTORY AUDIT LOG API ====================

@api_router.get("/inventory/audit-log")
async def get_inventory_audit_log(
    truck_id: Optional[str] = None,
    job_id: Optional[str] = None,
    item_id: Optional[str] = None,
    days: int = 30
):
    """Get inventory audit log"""
    query = {}
    if truck_id:
        query["truck_id"] = truck_id
    if job_id:
        query["job_id"] = job_id
    if item_id:
        query["item_id"] = item_id
    
    since = datetime.utcnow() - timedelta(days=days)
    query["created_at"] = {"$gte": since}
    
    logs = await db.inventory_audit_log.find(query).sort("created_at", -1).to_list(500)
    # Exclude MongoDB _id field from each log
    for log in logs:
        log.pop("_id", None)
    return logs

# ==================== J-LOAD CALCULATOR API ====================

# Climate zone multipliers for quick estimate
CLIMATE_FACTORS = {
    "1": {"cooling": 35, "heating": 15},  # Very Hot-Humid (Miami)
    "2": {"cooling": 32, "heating": 20},  # Hot-Humid (Houston)
    "3": {"cooling": 28, "heating": 28},  # Hot-Dry/Warm-Humid (LA, Dallas)
    "4": {"cooling": 24, "heating": 35},  # Mixed-Humid (NYC, DC)
    "5": {"cooling": 20, "heating": 42},  # Cold (Chicago, Denver)
    "6": {"cooling": 18, "heating": 48},  # Cold (Minneapolis)
    "7": {"cooling": 15, "heating": 55},  # Very Cold (Fargo)
}

BUILDING_AGE_FACTORS = {
    "new": 0.85,
    "10_years": 1.0,
    "20_years": 1.15,
    "30_plus": 1.30
}

INSULATION_FACTORS = {
    "poor": 1.25,
    "average": 1.0,
    "good": 0.85,
    "excellent": 0.70
}

WINDOW_FACTORS = {
    "single": 1.3,
    "double": 1.0,
    "triple": 0.85,
    "low_e": 0.75
}

@api_router.post("/jload/quick-estimate", response_model=JLoadQuickEstimate)
async def calculate_quick_estimate(data: JLoadQuickEstimateCreate, technician_id: Optional[str] = None):
    """Calculate quick J-load estimate"""
    climate = CLIMATE_FACTORS.get(data.climate_zone, CLIMATE_FACTORS["3"])
    age_factor = BUILDING_AGE_FACTORS.get(data.building_age, 1.0)
    insulation_factor = INSULATION_FACTORS.get(data.insulation_quality, 1.0)
    window_factor = WINDOW_FACTORS.get(data.window_type, 1.0)
    
    # Base calculation
    # Volume is calculated inline below
    # volume = data.square_footage * data.ceiling_height * data.num_floors
    window_load = data.num_windows * 1000 * window_factor  # ~1000 BTU per window adjusted
    
    # Cooling calculation (BTU/hr)
    cooling_base = data.square_footage * climate["cooling"]
    cooling_btuh = cooling_base * age_factor * insulation_factor + window_load
    
    # Heating calculation (BTU/hr)
    heating_base = data.square_footage * climate["heating"]
    heating_btuh = heating_base * age_factor * insulation_factor
    
    # Commercial adjustment
    if data.building_type == "commercial":
        cooling_btuh *= 1.2  # Higher occupancy/equipment loads
        heating_btuh *= 0.9  # More internal heat gains
    elif data.building_type == "mixed":
        cooling_btuh *= 1.1
    
    # Equipment sizing
    tonnage = cooling_btuh / 12000
    recommended_tonnage = math.ceil(tonnage * 2) / 2  # Round to nearest 0.5 ton
    recommended_furnace = math.ceil(heating_btuh / 10000) * 10000  # Round to nearest 10k BTU
    
    # Equipment recommendations
    equipment = [
        {
            "type": "Air Conditioner",
            "size": f"{recommended_tonnage} Ton",
            "model_suggestion": f"Carrier 24ACC6{int(recommended_tonnage*12):02d}" if recommended_tonnage <= 5 else "Commercial RTU recommended"
        },
        {
            "type": "Gas Furnace",
            "size": f"{int(recommended_furnace/1000)}K BTU",
            "model_suggestion": f"Carrier 59SC5A{int(recommended_furnace/1000):03d}"
        }
    ]
    
    tech_name = None
    if technician_id:
        tech = await db.technicians.find_one({"id": technician_id})
        tech_name = tech["name"] if tech else None
    
    estimate = JLoadQuickEstimate(
        job_id=data.job_id,
        site_id=data.site_id,
        quote_id=data.quote_id,
        square_footage=data.square_footage,
        climate_zone=data.climate_zone,
        building_type=data.building_type,
        building_age=data.building_age,
        insulation_quality=data.insulation_quality,
        num_floors=data.num_floors,
        ceiling_height=data.ceiling_height,
        num_windows=data.num_windows,
        window_type=data.window_type,
        cooling_btuh=round(cooling_btuh),
        heating_btuh=round(heating_btuh),
        recommended_tonnage=recommended_tonnage,
        recommended_furnace_btuh=recommended_furnace,
        recommended_equipment=equipment,
        notes=data.notes,
        calculated_by_id=technician_id,
        calculated_by_name=tech_name
    )
    
    await db.jload_estimates.insert_one(estimate.dict())
    return estimate

@api_router.post("/jload/manual-j", response_model=ManualJLoadCalculation)
async def create_manual_j_calculation(data: ManualJLoadCreate, technician_id: Optional[str] = None):
    """Create a Manual J load calculation (full ACCA method)"""
    tech_name = None
    if technician_id:
        tech = await db.technicians.find_one({"id": technician_id})
        tech_name = tech["name"] if tech else None
    
    calc = ManualJLoadCalculation(
        job_id=data.job_id,
        site_id=data.site_id,
        quote_id=data.quote_id,
        project_name=sanitize_string(data.project_name, 200),
        address=sanitize_string(data.address, 300),
        city=sanitize_string(data.city, 100),
        state=sanitize_string(data.state, 50),
        zip_code=sanitize_string(data.zip_code, 20),
        climate_zone=data.climate_zone,
        total_square_footage=data.total_square_footage,
        conditioned_volume=data.total_square_footage * data.ceiling_height * data.num_floors,
        calculated_by_id=technician_id,
        calculated_by_name=tech_name,
        status="draft"
    )
    
    await db.manual_j_calculations.insert_one(calc.dict())
    return calc

@api_router.get("/jload/manual-j/{calc_id}", response_model=ManualJLoadCalculation)
async def get_manual_j_calculation(calc_id: str):
    """Get a Manual J calculation"""
    if not validate_uuid(calc_id):
        raise HTTPException(status_code=400, detail="Invalid calculation ID")
    calc = await db.manual_j_calculations.find_one({"id": calc_id})
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return ManualJLoadCalculation(**calc)

@api_router.put("/jload/manual-j/{calc_id}")
async def update_manual_j_calculation(calc_id: str, update_data: dict):
    """Update Manual J calculation with building envelope data"""
    if not validate_uuid(calc_id):
        raise HTTPException(status_code=400, detail="Invalid calculation ID")
    
    calc = await db.manual_j_calculations.find_one({"id": calc_id})
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    
    update_data["updated_at"] = datetime.utcnow()
    await db.manual_j_calculations.update_one({"id": calc_id}, {"$set": update_data})
    
    updated = await db.manual_j_calculations.find_one({"id": calc_id})
    return updated

@api_router.post("/jload/manual-j/{calc_id}/calculate")
async def run_manual_j_calculation(calc_id: str):
    """Run the full Manual J calculation"""
    if not validate_uuid(calc_id):
        raise HTTPException(status_code=400, detail="Invalid calculation ID")
    
    calc = await db.manual_j_calculations.find_one({"id": calc_id})
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    
    # Simplified Manual J calculation
    # In production, this would use full ACCA Manual J procedures
    
    total_wall_load = 0
    for wall in calc.get("walls", []):
        area = wall.get("area_sqft", 0)
        r_value = wall.get("r_value", 13)
        u_factor = 1 / r_value
        # Simplified: delta_t * area * u_factor
        total_wall_load += 30 * area * u_factor  # 30 degree delta T
    
    total_window_load = 0
    for window in calc.get("windows", []):
        area = window.get("area_sqft", 0)
        u_factor = window.get("u_factor", 0.5)
        shgc = window.get("shgc", 0.4)
        total_window_load += area * (30 * u_factor + 200 * shgc)  # Conduction + solar
    
    total_ceiling_load = 0
    for ceiling in calc.get("ceilings", []):
        area = ceiling.get("area_sqft", 0)
        r_value = ceiling.get("r_value", 30)
        u_factor = 1 / r_value
        total_ceiling_load += 50 * area * u_factor  # Higher delta T for attic
    
    infiltration_load = calc.get("conditioned_volume", 0) * calc.get("infiltration_ach", 0.5) * 0.018 * 30
    
    internal_gains = (
        calc.get("occupants", 2) * 300 +  # ~300 BTU per person sensible
        calc.get("appliance_load_btuh", 0) +
        calc.get("lighting_load_btuh", 0)
    )
    
    # Total sensible cooling load
    sensible_cooling = total_wall_load + total_window_load + total_ceiling_load + infiltration_load + internal_gains
    
    # Latent load (roughly 30% of sensible for humid climates)
    latent_cooling = sensible_cooling * 0.3
    
    # Total cooling
    total_cooling = sensible_cooling + latent_cooling
    
    # Heating load (no solar or internal gains credit)
    heating_load = (total_wall_load + total_window_load + total_ceiling_load + infiltration_load) * 1.2  # Higher delta T
    
    # Duct losses
    duct_loss_factor = 1 + (calc.get("duct_leakage_percent", 10) / 100)
    if calc.get("duct_location") != "conditioned":
        duct_loss_factor += 0.1
    
    total_cooling *= duct_loss_factor
    heating_load *= duct_loss_factor
    
    # Equipment sizing
    cooling_tons = total_cooling / 12000
    recommended_tons = math.ceil(cooling_tons * 2) / 2
    recommended_heating = math.ceil(heating_load / 10000) * 10000
    
    equipment = [
        {
            "type": "Air Conditioner/Heat Pump",
            "size": f"{recommended_tons} Ton",
            "capacity_btuh": int(recommended_tons * 12000)
        },
        {
            "type": "Furnace/Backup Heat",
            "size": f"{int(recommended_heating/1000)}K BTU",
            "capacity_btuh": int(recommended_heating)
        }
    ]
    
    await db.manual_j_calculations.update_one(
        {"id": calc_id},
        {"$set": {
            "sensible_cooling_load": round(sensible_cooling),
            "latent_cooling_load": round(latent_cooling),
            "total_cooling_load": round(total_cooling),
            "heating_load": round(heating_load),
            "recommended_cooling_tons": recommended_tons,
            "recommended_heating_btuh": recommended_heating,
            "equipment_recommendations": equipment,
            "status": "calculated",
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "sensible_cooling_load": round(sensible_cooling),
        "latent_cooling_load": round(latent_cooling),
        "total_cooling_load": round(total_cooling),
        "heating_load": round(heating_load),
        "recommended_cooling_tons": recommended_tons,
        "recommended_heating_btuh": recommended_heating,
        "equipment_recommendations": equipment
    }

@api_router.get("/jload/by-job/{job_id}")
async def get_jload_calculations_for_job(job_id: str):
    """Get all J-load calculations for a job"""
    estimates = await db.jload_estimates.find({"job_id": job_id}).to_list(10)
    manual_calcs = await db.manual_j_calculations.find({"job_id": job_id}).to_list(10)
    return {
        "quick_estimates": estimates,
        "manual_j_calculations": manual_calcs
    }

# ==================== AI FEATURES API ====================

# Initialize Gemini client lazily
_gemini_client = None

async def get_gemini_response(prompt: str, session_id: str = "default") -> str:
    """Get response from Gemini using emergentintegrations"""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not configured")
    
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Create a new chat instance for each request with appropriate session
    client = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message="You are a helpful HVAC service assistant for BreezeFlow, an HVAC business operations platform."
    )
    
    # Configure for Gemini
    client = client.with_model(provider="gemini", model="gemini-2.0-flash")
    
    # Create user message and send (await since it's async)
    user_msg = UserMessage(text=prompt)
    response = await client.send_message(user_msg)
    
    return response

@api_router.post("/ai/scheduling-suggestions")
async def get_scheduling_suggestions(data: dict):
    """AI-powered scheduling suggestions for dispatchers"""
    settings = await get_system_settings()
    if not settings.ai_features_enabled:
        raise HTTPException(status_code=400, detail="AI features are disabled")
    
    # Check if API key is configured
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Get context data
    jobs_today = data.get("jobs", [])
    technicians = data.get("technicians", [])
    new_job = data.get("new_job", {})
    
    prompt = f"""Based on the following information, suggest the best scheduling options.

Current Jobs Today:
{jobs_today}

Available Technicians:
{technicians}

New Job to Schedule:
- Type: {new_job.get('job_type', 'Service')}
- Priority: {new_job.get('priority', 'normal')}
- Location: {new_job.get('address', 'Unknown')}
- Estimated Duration: {new_job.get('estimated_hours', 2)} hours
- Customer: {new_job.get('customer_name', 'Unknown')}

Provide 2-3 scheduling recommendations with:
1. Best technician match and why
2. Suggested time slot
3. Any potential conflicts to consider

Keep response concise and actionable."""

    try:
        session_id = f"scheduling-{str(uuid.uuid4())[:8]}"
        response = await get_gemini_response(prompt, session_id)
        return {
            "suggestions": response,
            "ai_model": "gemini-2.0-flash"
        }
    except Exception as e:
        logger.error(f"AI scheduling error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.post("/ai/job-summary")
async def generate_job_summary(data: dict):
    """AI-powered job summary generation"""
    settings = await get_system_settings()
    if not settings.ai_features_enabled:
        raise HTTPException(status_code=400, detail="AI features are disabled")
    
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    job_id = data.get("job_id")
    if job_id:
        job = await db.jobs.find_one({"id": job_id})
        if job:
            job.pop("_id", None)
            data["job"] = job
    
    prompt = f"""Generate a professional job summary based on this information:

Job Details:
- Type: {data.get('job_type', 'Service')}
- Title: {data.get('title', 'Service Call')}
- Description: {data.get('description', 'N/A')}
- Customer: {data.get('customer_name', 'Unknown')}
- Address: {data.get('address', 'Unknown')}

Work Performed:
{data.get('notes', 'No notes provided')}

Equipment Used:
{data.get('equipment_used', 'None recorded')}

Generate a professional summary (2-3 paragraphs) that:
1. Summarizes the issue and diagnosis
2. Describes work performed
3. Notes any recommendations for the customer

Use professional HVAC terminology. Keep it customer-friendly."""

    try:
        session_id = f"summary-{str(uuid.uuid4())[:8]}"
        response = await get_gemini_response(prompt, session_id)
        return {
            "summary": response,
            "ai_model": "gemini-2.0-flash"
        }
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.post("/ai/predictive-maintenance")
async def get_predictive_maintenance(data: dict):
    """AI-powered predictive maintenance suggestions"""
    settings = await get_system_settings()
    if not settings.ai_features_enabled:
        raise HTTPException(status_code=400, detail="AI features are disabled")
    
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    equipment = data.get("equipment", {})
    service_history = data.get("service_history", [])
    
    prompt = f"""Analyze this equipment and service history to predict maintenance needs.

Equipment:
- Type: {equipment.get('equipment_type', 'Unknown')}
- Manufacturer: {equipment.get('manufacturer', 'Unknown')}
- Model: {equipment.get('model', 'Unknown')}
- Install Date: {equipment.get('install_date', 'Unknown')}
- Last Service: {equipment.get('last_service_date', 'Unknown')}

Service History (last 5 visits):
{service_history[:5] if service_history else 'No service history'}

Based on:
1. Equipment age and typical lifecycle
2. Service history patterns
3. Common failure modes for this equipment type

Provide:
1. Predicted maintenance timeline (next 12 months)
2. Top 3 components likely to need attention
3. Recommended preventive actions
4. Estimated cost impact of deferred maintenance

Keep response focused and actionable."""

    try:
        session_id = f"maintenance-{str(uuid.uuid4())[:8]}"
        response = await get_gemini_response(prompt, session_id)
        return {
            "predictions": response,
            "ai_model": "gemini-2.0-flash"
        }
    except Exception as e:
        logger.error(f"AI predictive maintenance error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ==================== GOOGLE MAPS ROUTING API ====================

async def get_system_settings():
    """Get or create system settings"""
    settings = await db.system_settings.find_one({})
    if not settings:
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
        default_settings = SystemSettings(
            google_maps_enabled=bool(api_key),
            google_maps_api_key_set=bool(api_key),
        )
        await db.system_settings.insert_one(default_settings.dict())
        return default_settings
    return SystemSettings(**settings)

def get_google_maps_client():
    """Get Google Maps client if API key is configured"""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return None
    return googlemaps.Client(key=api_key)

@api_router.get("/system/settings")
async def get_settings():
    """Get system settings"""
    settings = await get_system_settings()
    return settings

@api_router.put("/system/settings")
async def update_settings(data: dict):
    """Update system settings"""
    settings = await get_system_settings()
    
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Check if Google Maps API key is present if enabling
    if update_data.get("google_maps_enabled"):
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
        if not api_key:
            update_data["google_maps_enabled"] = False
            update_data["google_maps_api_key_set"] = False
        else:
            update_data["google_maps_api_key_set"] = True
    
    await db.system_settings.update_one(
        {"id": settings.id},
        {"$set": update_data}
    )
    
    return await get_system_settings()

@api_router.get("/maps/config")
async def get_maps_config():
    """Check if Google Maps is configured and enabled"""
    settings = await get_system_settings()
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    
    return {
        "configured": bool(api_key),
        "enabled": settings.google_maps_enabled and bool(api_key),
        "message": (
            "Google Maps API is enabled and configured" 
            if settings.google_maps_enabled and api_key 
            else "Google Maps is disabled" if not settings.google_maps_enabled
            else "Google Maps API key not set. Add GOOGLE_MAPS_API_KEY to backend/.env"
        )
    }

@api_router.post("/maps/route", response_model=RouteCalculation)
async def calculate_route(request: RouteRequest):
    """Calculate route between two points using Google Maps"""
    gmaps = get_google_maps_client()
    
    if not gmaps:
        # Fallback to Haversine calculation if no API key
        return await calculate_route_fallback(request)
    
    try:
        # Call Google Maps Directions API
        directions_result = gmaps.directions(
            request.origin,
            request.destination,
            mode="driving",
            departure_time="now" if not request.departure_time else request.departure_time,
            traffic_model="best_guess"
        )
        
        if not directions_result:
            raise HTTPException(status_code=404, detail="No route found")
        
        route = directions_result[0]
        leg = route["legs"][0]
        
        # Extract data
        distance_meters = leg["distance"]["value"]
        duration_seconds = leg["duration"]["value"]
        duration_in_traffic = leg.get("duration_in_traffic", {}).get("value")
        
        result = RouteCalculation(
            origin_address=leg["start_address"],
            origin_lat=leg["start_location"]["lat"],
            origin_lng=leg["start_location"]["lng"],
            destination_address=leg["end_address"],
            destination_lat=leg["end_location"]["lat"],
            destination_lng=leg["end_location"]["lng"],
            distance_meters=distance_meters,
            distance_miles=round(distance_meters / 1609.34, 2),
            duration_seconds=duration_seconds,
            duration_minutes=round(duration_seconds / 60, 1),
            duration_in_traffic_seconds=duration_in_traffic,
            duration_in_traffic_minutes=round(duration_in_traffic / 60, 1) if duration_in_traffic else None,
            polyline=route["overview_polyline"]["points"],
            summary=route.get("summary", ""),
            warnings=route.get("warnings", []),
            api_status="OK"
        )
        
        # Store in database for analytics
        await db.route_calculations.insert_one(result.dict())
        
        return result
        
    except googlemaps.exceptions.ApiError as e:
        logger.error(f"Google Maps API error: {e}")
        return await calculate_route_fallback(request)

async def calculate_route_fallback(request: RouteRequest):
    """Fallback route calculation using Haversine formula"""
    # Try to parse coordinates from origin/destination
    def parse_coords(s):
        parts = s.split(",")
        if len(parts) == 2:
            try:
                return float(parts[0].strip()), float(parts[1].strip())
            except ValueError:
                pass
        return None, None
    
    origin_lat, origin_lng = parse_coords(request.origin)
    dest_lat, dest_lng = parse_coords(request.destination)
    
    if origin_lat and dest_lat:
        # Haversine calculation
        R = 3959  # Earth radius in miles
        lat1, lat2 = math.radians(origin_lat), math.radians(dest_lat)
        dlat = math.radians(dest_lat - origin_lat)
        dlng = math.radians(dest_lng - origin_lng)
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        distance_miles = R * c
        
        # Estimate time at 30 mph average
        duration_minutes = distance_miles / 30 * 60
        
        return RouteCalculation(
            origin_address=request.origin,
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            destination_address=request.destination,
            destination_lat=dest_lat,
            destination_lng=dest_lng,
            distance_meters=int(distance_miles * 1609.34),
            distance_miles=round(distance_miles, 2),
            duration_seconds=int(duration_minutes * 60),
            duration_minutes=round(duration_minutes, 1),
            api_status="FALLBACK_HAVERSINE"
        )
    
    # Can't calculate without coordinates
    return RouteCalculation(
        origin_address=request.origin,
        destination_address=request.destination,
        api_status="FALLBACK_NO_COORDS"
    )

@api_router.post("/maps/geocode")
async def geocode_address(address: str):
    """Convert address to coordinates"""
    gmaps = get_google_maps_client()
    
    if not gmaps:
        return {"error": "Google Maps API not configured"}
    
    try:
        result = gmaps.geocode(address)
        if result:
            location = result[0]["geometry"]["location"]
            return {
                "address": result[0]["formatted_address"],
                "lat": location["lat"],
                "lng": location["lng"]
            }
        return {"error": "Address not found"}
    except Exception as e:
        return {"error": str(e)}

# ==================== MAINTENANCE AGREEMENTS API ====================

@api_router.get("/maintenance/templates", response_model=List[MaintenanceAgreementTemplate])
async def get_maintenance_templates():
    """Get all maintenance agreement templates"""
    templates = await db.maintenance_templates.find({"is_active": True}).to_list(100)
    # Exclude _id
    for t in templates:
        t.pop("_id", None)
    return [MaintenanceAgreementTemplate(**t) for t in templates]

@api_router.post("/maintenance/templates", response_model=MaintenanceAgreementTemplate)
async def create_maintenance_template(data: dict):
    """Create a maintenance agreement template"""
    template = MaintenanceAgreementTemplate(**data)
    await db.maintenance_templates.insert_one(template.dict())
    return template

@api_router.get("/maintenance/agreements", response_model=List[MaintenanceAgreement])
async def get_maintenance_agreements(
    status: Optional[str] = None,
    customer_name: Optional[str] = None
):
    """Get all maintenance agreements"""
    query = {}
    if status:
        query["status"] = status
    if customer_name:
        query["customer_name"] = {"$regex": customer_name, "$options": "i"}
    
    agreements = await db.maintenance_agreements.find(query).sort("created_at", -1).to_list(100)
    for a in agreements:
        a.pop("_id", None)
    return [MaintenanceAgreement(**a) for a in agreements]

@api_router.get("/maintenance/agreements/{agreement_id}", response_model=MaintenanceAgreement)
async def get_maintenance_agreement(agreement_id: str):
    """Get a specific maintenance agreement"""
    if not validate_uuid(agreement_id):
        raise HTTPException(status_code=400, detail="Invalid agreement ID")
    
    agreement = await db.maintenance_agreements.find_one({"id": agreement_id})
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    agreement.pop("_id", None)
    return MaintenanceAgreement(**agreement)

@api_router.post("/maintenance/agreements", response_model=MaintenanceAgreement)
async def create_maintenance_agreement(data: MaintenanceAgreementCreate):
    """Create a new maintenance agreement"""
    # Calculate end date if not provided
    start = datetime.fromisoformat(data.start_date)
    if not data.end_date:
        end_date = (start + timedelta(days=365)).isoformat()[:10]
    else:
        end_date = data.end_date
    
    # Get template info if provided
    template_name = None
    if data.template_id:
        template = await db.maintenance_templates.find_one({"id": data.template_id})
        template_name = template["name"] if template else None
    
    # Calculate next service date based on frequency
    if data.frequency == "monthly":
        next_service = start + timedelta(days=30)
    elif data.frequency == "quarterly":
        next_service = start + timedelta(days=90)
    elif data.frequency == "semi_annual":
        next_service = start + timedelta(days=180)
    else:  # annual
        next_service = start + timedelta(days=365)
    
    agreement = MaintenanceAgreement(
        customer_name=sanitize_string(data.customer_name, 200),
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        service_address=sanitize_string(data.service_address, 500),
        template_id=data.template_id,
        template_name=template_name,
        frequency=data.frequency,
        equipment=data.equipment,
        start_date=data.start_date,
        end_date=end_date,
        next_service_date=next_service.isoformat()[:10],
        annual_price=data.annual_price,
        payment_frequency=data.payment_frequency,
        auto_renew=data.auto_renew,
        notes=data.notes
    )
    
    await db.maintenance_agreements.insert_one(agreement.dict())
    return agreement

@api_router.put("/maintenance/agreements/{agreement_id}", response_model=MaintenanceAgreement)
async def update_maintenance_agreement(agreement_id: str, data: dict):
    """Update a maintenance agreement"""
    if not validate_uuid(agreement_id):
        raise HTTPException(status_code=400, detail="Invalid agreement ID")
    
    agreement = await db.maintenance_agreements.find_one({"id": agreement_id})
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    data["updated_at"] = datetime.utcnow()
    await db.maintenance_agreements.update_one({"id": agreement_id}, {"$set": data})
    
    updated = await db.maintenance_agreements.find_one({"id": agreement_id})
    updated.pop("_id", None)
    return MaintenanceAgreement(**updated)

@api_router.post("/maintenance/agreements/{agreement_id}/generate-jobs")
async def generate_maintenance_jobs(agreement_id: str):
    """Generate scheduled maintenance jobs for an agreement"""
    if not validate_uuid(agreement_id):
        raise HTTPException(status_code=400, detail="Invalid agreement ID")
    
    agreement = await db.maintenance_agreements.find_one({"id": agreement_id})
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    
    # Calculate dates for jobs based on frequency
    start = datetime.fromisoformat(agreement["start_date"])
    end = datetime.fromisoformat(agreement["end_date"])
    frequency = agreement["frequency"]
    
    if frequency == "monthly":
        interval = timedelta(days=30)
    elif frequency == "quarterly":
        interval = timedelta(days=90)
    elif frequency == "semi_annual":
        interval = timedelta(days=180)
    else:  # annual
        interval = timedelta(days=365)
    
    job_ids = []
    current_date = start
    
    while current_date <= end:
        # Create a job for each scheduled visit
        job_number = f"MA-{agreement['agreement_number'][-8:]}-{len(job_ids)+1:02d}"
        
        job = Job(
            job_number=job_number,
            customer_name=agreement["customer_name"],
            customer_phone=agreement.get("customer_phone"),
            customer_email=agreement.get("customer_email"),
            site_address=agreement["service_address"],
            job_type="Maintenance",
            title=f"Scheduled Maintenance - {agreement['agreement_number']}",
            description=f"Scheduled maintenance per agreement {agreement['agreement_number']}",
            status="pending",
            priority="normal",
            scheduled_date=current_date.isoformat()[:10],
            estimated_hours=2.0,  # 2 hours default
        )
        
        await db.jobs.insert_one(job.dict())
        job_ids.append(job.id)
        
        current_date += interval
    
    # Update agreement with generated job IDs
    await db.maintenance_agreements.update_one(
        {"id": agreement_id},
        {"$set": {"generated_job_ids": job_ids, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Generated {len(job_ids)} maintenance jobs", "job_ids": job_ids}

@api_router.get("/maintenance/due-renewals")
async def get_due_renewals(days: int = 30):
    """Get agreements due for renewal in the next N days"""
    cutoff = (datetime.utcnow() + timedelta(days=days)).isoformat()[:10]
    
    agreements = await db.maintenance_agreements.find({
        "status": "active",
        "auto_renew": True,
        "end_date": {"$lte": cutoff}
    }).to_list(100)
    
    for a in agreements:
        a.pop("_id", None)
    
    return agreements

# ==================== GANTT / INSTALL PROJECTS API ====================

@api_router.get("/projects", response_model=List[InstallProject])
async def get_install_projects(
    status: Optional[str] = None,
    job_id: Optional[str] = None
):
    """Get all install projects"""
    query = {}
    if status:
        query["status"] = status
    if job_id:
        query["job_id"] = job_id
    
    projects = await db.install_projects.find(query).sort("planned_start_date", 1).to_list(100)
    for p in projects:
        p.pop("_id", None)
    return [InstallProject(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=InstallProject)
async def get_install_project(project_id: str):
    """Get a specific install project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.pop("_id", None)
    return InstallProject(**project)

@api_router.post("/projects", response_model=InstallProject)
async def create_install_project(data: InstallProjectCreate):
    """Create a new install project"""
    project = InstallProject(
        job_id=data.job_id,
        name=sanitize_string(data.name, 200),
        description=data.description,
        customer_name=sanitize_string(data.customer_name, 200),
        site_address=sanitize_string(data.site_address, 500),
        planned_start_date=data.planned_start_date,
        planned_end_date=data.planned_end_date,
        estimated_hours=data.estimated_hours,
        estimated_cost=data.estimated_cost,
        notes=data.notes
    )
    
    await db.install_projects.insert_one(project.dict())
    
    # Update the parent job to link to this project
    await db.jobs.update_one(
        {"id": data.job_id},
        {"$set": {"install_project_id": project.id, "type": "install"}}
    )
    
    return project

@api_router.put("/projects/{project_id}", response_model=InstallProject)
async def update_install_project(project_id: str, data: dict):
    """Update an install project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    data["updated_at"] = datetime.utcnow()
    
    # Recalculate percent complete if phases updated
    if "phases" in data:
        phases = data["phases"]
        if phases:
            total_percent = sum(p.get("percent_complete", 0) for p in phases) / len(phases)
            data["percent_complete"] = int(total_percent)
    
    await db.install_projects.update_one({"id": project_id}, {"$set": data})
    
    updated = await db.install_projects.find_one({"id": project_id})
    updated.pop("_id", None)
    return InstallProject(**updated)

@api_router.post("/projects/{project_id}/phases", response_model=ProjectPhase)
async def add_project_phase(project_id: str, data: ProjectPhaseCreate):
    """Add a phase to an install project"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate duration
    start = datetime.fromisoformat(data.start_date)
    end = datetime.fromisoformat(data.end_date)
    duration = (end - start).days + 1
    
    phase = ProjectPhase(
        name=sanitize_string(data.name, 200),
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        duration_days=duration,
        depends_on=data.depends_on,
        assigned_technician_ids=data.assigned_technician_ids,
        color=data.color
    )
    
    phases = project.get("phases", [])
    phases.append(phase.dict())
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"phases": phases, "updated_at": datetime.utcnow()}}
    )
    
    return phase

@api_router.put("/projects/{project_id}/phases/{phase_id}")
async def update_project_phase(project_id: str, phase_id: str, data: dict):
    """Update a phase within a project"""
    if not validate_uuid(project_id) or not validate_uuid(phase_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    phases = project.get("phases", [])
    updated = False
    
    for i, phase in enumerate(phases):
        if phase.get("id") == phase_id:
            phases[i] = {**phase, **data}
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Phase not found")
    
    # Recalculate project percent complete
    total_percent = sum(p.get("percent_complete", 0) for p in phases) / len(phases) if phases else 0
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"phases": phases, "percent_complete": int(total_percent), "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Phase updated"}

@api_router.get("/projects/gantt-data/{project_id}")
async def get_gantt_data(project_id: str):
    """Get project data formatted for Gantt chart display"""
    if not validate_uuid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.pop("_id", None)
    
    # Get technician names for assignment
    tech_ids = project.get("assigned_technician_ids", [])
    for phase in project.get("phases", []):
        tech_ids.extend(phase.get("assigned_technician_ids", []))
    
    techs = await db.technicians.find({"id": {"$in": list(set(tech_ids))}}).to_list(50)
    tech_map = {t["id"]: t["name"] for t in techs}
    
    # Format for Gantt
    gantt_data = {
        "project": {
            "id": project["id"],
            "name": project["name"],
            "start": project["planned_start_date"],
            "end": project["planned_end_date"],
            "progress": project.get("percent_complete", 0)
        },
        "phases": [],
        "resources": [{"id": tid, "name": tech_map.get(tid, "Unknown")} for tid in set(tech_ids)]
    }
    
    for phase in project.get("phases", []):
        gantt_data["phases"].append({
            "id": phase["id"],
            "name": phase["name"],
            "start": phase["start_date"],
            "end": phase["end_date"],
            "duration": phase.get("duration_days", 1),
            "progress": phase.get("percent_complete", 0),
            "dependencies": phase.get("depends_on", []),
            "resources": [tech_map.get(tid, "Unknown") for tid in phase.get("assigned_technician_ids", [])],
            "color": phase.get("color"),
            "status": phase.get("status", "not_started")
        })
    
    return gantt_data

# ==================== CUSTOMER PORTAL API ====================

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((password + salt).encode())
    return f"{salt}:{hash_obj.hexdigest()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    if not stored_hash or ":" not in stored_hash:
        return False
    salt, hash_val = stored_hash.split(":", 1)
    hash_obj = hashlib.sha256((password + salt).encode())
    return hash_obj.hexdigest() == hash_val

def generate_token() -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(32)

@api_router.post("/customer/register")
async def register_customer(data: CustomerAccountCreate):
    """Register a new customer account"""
    # Check if email already exists
    existing = await db.customer_accounts.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create account
    account = CustomerAccount(
        email=data.email.lower(),
        password_hash=hash_password(data.password) if data.password else None,
        name=sanitize_string(data.name, 200),
        phone=data.phone,
        addresses=[{"address": data.address, "is_primary": True}] if data.address else [],
        verification_token=generate_token(),
        verification_token_expires=datetime.utcnow() + timedelta(hours=24)
    )
    
    await db.customer_accounts.insert_one(account.dict())
    
    # In production, send verification email here
    
    return {
        "message": "Account created. Please verify your email.",
        "customer_id": account.id,
        "verification_token": account.verification_token  # For demo - remove in production
    }

@api_router.post("/customer/login")
async def login_customer(data: CustomerLogin):
    """Login customer with email/password"""
    account = await db.customer_accounts.find_one({"email": data.email.lower()})
    
    if not account:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if account.get("status") != "active":
        raise HTTPException(status_code=401, detail="Account is not active")
    
    if data.password:
        if not verify_password(data.password, account.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid email or password")
    else:
        raise HTTPException(status_code=400, detail="Password required")
    
    # Generate session token
    session_token = generate_token()
    
    # Update last login
    await db.customer_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"last_login": datetime.utcnow(), "session_token": session_token}}
    )
    
    account.pop("_id", None)
    account.pop("password_hash", None)
    
    return {
        "message": "Login successful",
        "token": session_token,
        "customer": {
            "id": account["id"],
            "name": account["name"],
            "email": account["email"]
        }
    }

@api_router.post("/customer/magic-link")
async def request_magic_link(data: MagicLinkRequest):
    """Send a magic link for passwordless login"""
    account = await db.customer_accounts.find_one({"email": data.email.lower()})
    
    if not account:
        # Don't reveal if account exists
        return {"message": "If an account exists, a login link will be sent."}
    
    # Generate magic link token
    token = generate_token()
    expires = datetime.utcnow() + timedelta(minutes=15)
    
    await db.customer_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"magic_link_token": token, "magic_link_expires": expires}}
    )
    
    # In production, send email with magic link here
    # The link would be: https://yourapp.com/customer/verify-magic?token={token}
    
    return {
        "message": "If an account exists, a login link will be sent.",
        "token": token  # For demo - remove in production
    }

@api_router.post("/customer/verify-magic/{token}")
async def verify_magic_link(token: str):
    """Verify magic link and login"""
    account = await db.customer_accounts.find_one({
        "magic_link_token": token,
        "magic_link_expires": {"$gt": datetime.utcnow()}
    })
    
    if not account:
        raise HTTPException(status_code=401, detail="Invalid or expired link")
    
    # Generate session token
    session_token = generate_token()
    
    # Clear magic link and update login
    await db.customer_accounts.update_one(
        {"id": account["id"]},
        {"$set": {
            "magic_link_token": None,
            "magic_link_expires": None,
            "email_verified": True,
            "last_login": datetime.utcnow(),
            "session_token": session_token
        }}
    )
    
    return {
        "message": "Login successful",
        "token": session_token,
        "customer": {
            "id": account["id"],
            "name": account["name"],
            "email": account["email"]
        }
    }

@api_router.get("/customer/profile/{customer_id}")
async def get_customer_profile(customer_id: str, token: Optional[str] = None):
    """Get customer profile"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # In production, verify token matches
    
    account.pop("_id", None)
    account.pop("password_hash", None)
    account.pop("session_token", None)
    account.pop("magic_link_token", None)
    account.pop("verification_token", None)
    
    return account

@api_router.put("/customer/profile/{customer_id}")
async def update_customer_profile(customer_id: str, data: dict):
    """Update customer profile"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Don't allow updating sensitive fields
    safe_fields = ["name", "phone", "addresses", "notification_preferences"]
    update_data = {k: v for k, v in data.items() if k in safe_fields}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.customer_accounts.update_one({"id": customer_id}, {"$set": update_data})
    
    return {"message": "Profile updated"}

@api_router.post("/customer/service-request")
async def create_service_request(customer_id: str, data: ServiceRequestCreate):
    """Create a new service request"""
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    request = ServiceRequest(
        customer_id=customer_id,
        customer_name=account["name"],
        customer_email=account["email"],
        service_type=data.service_type,
        description=sanitize_string(data.description, 2000),
        urgency=data.urgency,
        preferred_dates=data.preferred_dates,
        preferred_time_of_day=data.preferred_time_of_day,
        service_address=sanitize_string(data.service_address, 500),
        access_instructions=data.access_instructions
    )
    
    await db.service_requests.insert_one(request.dict())
    
    return {
        "message": "Service request submitted",
        "request_number": request.request_number,
        "request_id": request.id
    }

@api_router.get("/customer/{customer_id}/service-requests")
async def get_customer_service_requests(customer_id: str):
    """Get service requests for a customer"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    requests = await db.service_requests.find(
        {"customer_id": customer_id}
    ).sort("created_at", -1).to_list(50)
    
    for r in requests:
        r.pop("_id", None)
        r.pop("internal_notes", None)
    
    return requests

@api_router.get("/customer/{customer_id}/jobs")
async def get_customer_jobs(customer_id: str):
    """Get jobs for a customer (by email match)"""
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Find jobs by customer email
    jobs = await db.jobs.find({
        "customer_email": account["email"]
    }).sort("created_at", -1).to_list(50)
    
    # Return safe subset of job info
    result = []
    for job in jobs:
        result.append({
            "id": job["id"],
            "job_number": job["job_number"],
            "status": job["status"],
            "type": job.get("type"),
            "category": job.get("category"),
            "scheduled_date": job.get("scheduled_date"),
            "site_address": job.get("site_address"),
            "description": job.get("description"),
            "assigned_technician_name": job.get("assigned_technician_name")
        })
    
    return result

@api_router.get("/customer/{customer_id}/agreements")
async def get_customer_agreements(customer_id: str):
    """Get maintenance agreements for a customer"""
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    agreements = await db.maintenance_agreements.find({
        "$or": [
            {"customer_id": customer_id},
            {"customer_email": account["email"]}
        ]
    }).sort("created_at", -1).to_list(50)
    
    for a in agreements:
        a.pop("_id", None)
    
    return agreements

@api_router.get("/service-requests", response_model=List[ServiceRequest])
async def get_all_service_requests(status: Optional[str] = None):
    """Get all service requests (admin view)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.service_requests.find(query).sort("created_at", -1).to_list(100)
    for r in requests:
        r.pop("_id", None)
    
    return [ServiceRequest(**r) for r in requests]

@api_router.put("/service-requests/{request_id}/status")
async def update_service_request_status(request_id: str, status: str, job_id: Optional[str] = None):
    """Update service request status"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.service_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {"status": status, "updated_at": datetime.utcnow()}
    if job_id:
        update_data["assigned_job_id"] = job_id
    
    await db.service_requests.update_one({"id": request_id}, {"$set": update_data})
    
    return {"message": f"Status updated to {status}"}

# ==================== MILESTONE TEMPLATES API ====================

@api_router.get("/milestone-templates")
async def get_milestone_templates(active_only: bool = True):
    """Get all milestone templates"""
    query = {"is_active": True} if active_only else {}
    templates = await db.milestone_templates.find(query).sort("name", 1).to_list(50)
    for t in templates:
        t.pop("_id", None)
    return templates

@api_router.get("/milestone-templates/{template_id}")
async def get_milestone_template(template_id: str):
    """Get a specific milestone template"""
    if not validate_uuid(template_id):
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    template = await db.milestone_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.pop("_id", None)
    return template

@api_router.post("/milestone-templates")
async def create_milestone_template(data: dict):
    """Create a new milestone template"""
    # Validate milestones sum to 100%
    milestones = data.get("milestones", [])
    total_percent = sum(m.get("percentage", 0) for m in milestones)
    if total_percent != 100:
        raise HTTPException(status_code=400, detail=f"Milestone percentages must sum to 100%, got {total_percent}%")
    
    template = {
        "id": str(uuid.uuid4()),
        "name": sanitize_string(data.get("name", ""), 200),
        "description": sanitize_string(data.get("description", ""), 500),
        "milestones": [
            {
                "id": str(uuid.uuid4()),
                "name": m.get("name", ""),
                "percentage": m.get("percentage", 0),
                "description": m.get("description", ""),
                "trigger": m.get("trigger", "manual"),
                "trigger_phase_id": m.get("trigger_phase_id")
            }
            for m in milestones
        ],
        "is_default": data.get("is_default", False),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    # If this is set as default, unset other defaults
    if template["is_default"]:
        await db.milestone_templates.update_many({}, {"$set": {"is_default": False}})
    
    await db.milestone_templates.insert_one(template)
    template.pop("_id", None)
    return template

@api_router.put("/milestone-templates/{template_id}")
async def update_milestone_template(template_id: str, data: dict):
    """Update a milestone template"""
    if not validate_uuid(template_id):
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    template = await db.milestone_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Validate milestones if provided
    if "milestones" in data:
        total_percent = sum(m.get("percentage", 0) for m in data["milestones"])
        if total_percent != 100:
            raise HTTPException(status_code=400, detail=f"Milestone percentages must sum to 100%, got {total_percent}%")
    
    update_data = {
        k: v for k, v in data.items() 
        if k in ["name", "description", "milestones", "is_default", "is_active"]
    }
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Handle default flag
    if update_data.get("is_default"):
        await db.milestone_templates.update_many({}, {"$set": {"is_default": False}})
    
    await db.milestone_templates.update_one({"id": template_id}, {"$set": update_data})
    
    updated = await db.milestone_templates.find_one({"id": template_id})
    updated.pop("_id", None)
    return updated

@api_router.delete("/milestone-templates/{template_id}")
async def delete_milestone_template(template_id: str):
    """Soft delete (deactivate) a milestone template"""
    if not validate_uuid(template_id):
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    await db.milestone_templates.update_one(
        {"id": template_id}, 
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Template deactivated"}

# ==================== PROJECT BILLING API ====================

@api_router.post("/projects/{project_id}/apply-template/{template_id}")
async def apply_milestone_template(project_id: str, template_id: str):
    """Apply a milestone template to a project"""
    if not validate_uuid(project_id) or not validate_uuid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    template = await db.milestone_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    project_total = project.get("estimated_cost", 0)
    
    # Create billing milestones from template
    billing_milestones = []
    for tm in template.get("milestones", []):
        milestone = {
            "id": str(uuid.uuid4()),
            "template_milestone_id": tm["id"],
            "name": tm["name"],
            "percentage": tm["percentage"],
            "amount": round(project_total * (tm["percentage"] / 100), 2),
            "description": tm.get("description", ""),
            "status": "pending",
            "trigger": tm.get("trigger", "manual"),
            "trigger_phase_id": tm.get("trigger_phase_id"),
            "invoice_id": None,
            "invoiced_at": None,
            "paid_at": None,
        }
        billing_milestones.append(milestone)
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {
            "billing_milestones": billing_milestones,
            "billing_template_id": template_id,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Template applied", "milestones": billing_milestones}

@api_router.put("/projects/{project_id}/milestones/{milestone_id}")
async def update_project_milestone(project_id: str, milestone_id: str, data: dict):
    """Update a billing milestone status"""
    if not validate_uuid(project_id) or not validate_uuid(milestone_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    milestones = project.get("billing_milestones", [])
    milestone_idx = next((i for i, m in enumerate(milestones) if m["id"] == milestone_id), None)
    
    if milestone_idx is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    # Update milestone
    new_status = data.get("status")
    if new_status:
        milestones[milestone_idx]["status"] = new_status
        
        if new_status == "ready_to_bill":
            milestones[milestone_idx]["triggered_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"billing_milestones": milestones, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Milestone updated", "milestone": milestones[milestone_idx]}

@api_router.post("/projects/{project_id}/milestones/{milestone_id}/invoice")
async def invoice_milestone(project_id: str, milestone_id: str):
    """Create an invoice for a billing milestone"""
    if not validate_uuid(project_id) or not validate_uuid(milestone_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    project = await db.install_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    milestones = project.get("billing_milestones", [])
    milestone = next((m for m in milestones if m["id"] == milestone_id), None)
    
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    if milestone.get("invoice_id"):
        raise HTTPException(status_code=400, detail="Milestone already invoiced")
    
    # Get customer info
    customer = await db.customers.find_one({"name": project.get("customer_name")})
    customer_email = customer.get("email", "") if customer else ""
    
    # Create invoice
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": f"INV-{str(uuid.uuid4())[:8].upper()}",
        "project_id": project_id,
        "job_id": project.get("job_id"),
        "customer_name": project.get("customer_name", ""),
        "customer_email": customer_email,
        "line_items": [{
            "description": f"{project.get('name', 'Install Project')} - {milestone['name']}",
            "quantity": 1,
            "unit_price": milestone["amount"],
            "total": milestone["amount"],
        }],
        "subtotal": milestone["amount"],
        "tax_rate": 0,
        "tax_amount": 0,
        "total": milestone["amount"],
        "balance_due": milestone["amount"],
        "paid_amount": 0,
        "status": "sent",
        "notes": f"Milestone: {milestone['name']} ({milestone['percentage']}%)",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.invoices.insert_one(invoice)
    
    # Update milestone
    milestone_idx = next(i for i, m in enumerate(milestones) if m["id"] == milestone_id)
    milestones[milestone_idx]["invoice_id"] = invoice["id"]
    milestones[milestone_idx]["invoiced_at"] = datetime.now(timezone.utc).isoformat()
    milestones[milestone_idx]["status"] = "invoiced"
    
    await db.install_projects.update_one(
        {"id": project_id},
        {"$set": {"billing_milestones": milestones, "updated_at": datetime.now(timezone.utc)}}
    )
    
    invoice.pop("_id", None)
    return {"message": "Invoice created", "invoice": invoice}

# ==================== RESCHEDULE REQUESTS API ====================

@api_router.get("/reschedule-requests")
async def get_reschedule_requests(status: Optional[str] = None):
    """Get all reschedule requests (dispatcher view)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.reschedule_requests.find(query).sort("created_at", -1).to_list(100)
    for r in requests:
        r.pop("_id", None)
    return requests

@api_router.post("/reschedule-requests")
async def create_reschedule_request(data: dict):
    """Create a reschedule request (from customer portal)"""
    job_id = data.get("job_id")
    if not job_id or not validate_uuid(job_id):
        raise HTTPException(status_code=400, detail="Valid job_id required")
    
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    request = {
        "id": str(uuid.uuid4()),
        "request_number": f"RSC-{str(uuid.uuid4())[:8].upper()}",
        "job_id": job_id,
        "job_number": job.get("job_number", ""),
        "customer_id": data.get("customer_id", ""),
        "customer_name": job.get("customer_name", ""),
        "customer_email": data.get("customer_email", ""),
        "customer_phone": data.get("customer_phone"),
        "original_date": job.get("scheduled_date", ""),
        "original_time": job.get("scheduled_time"),
        "requested_date": data.get("requested_date"),
        "requested_time_preference": data.get("requested_time_preference"),
        "reason": sanitize_string(data.get("reason", ""), 500),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.reschedule_requests.insert_one(request)
    request.pop("_id", None)
    return request

@api_router.put("/reschedule-requests/{request_id}/approve")
async def approve_reschedule_request(request_id: str, data: dict, user: dict = Depends(require_auth)):
    """Approve a reschedule request"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.reschedule_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    approved_date = data.get("approved_date") or request.get("requested_date")
    approved_time = data.get("approved_time")
    
    # Update request
    await db.reschedule_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "approved_date": approved_date,
            "approved_time": approved_time,
            "processed_by_id": user.get("id"),
            "processed_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    # Update job
    job_update = {"scheduled_date": approved_date, "updated_at": datetime.now(timezone.utc)}
    if approved_time:
        job_update["scheduled_time"] = approved_time
    
    await db.jobs.update_one({"id": request["job_id"]}, {"$set": job_update})
    
    return {"message": "Reschedule approved", "new_date": approved_date, "new_time": approved_time}

@api_router.put("/reschedule-requests/{request_id}/reject")
async def reject_reschedule_request(request_id: str, data: dict, user: dict = Depends(require_auth)):
    """Reject a reschedule request"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.reschedule_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.reschedule_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.get("reason", ""),
            "processed_by_id": user.get("id"),
            "processed_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    return {"message": "Reschedule rejected"}

@api_router.get("/customer/{customer_id}/reschedule-requests")
async def get_customer_reschedule_requests(customer_id: str):
    """Get reschedule requests for a specific customer"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    requests = await db.reschedule_requests.find(
        {"customer_id": customer_id}
    ).sort("created_at", -1).to_list(50)
    
    for r in requests:
        r.pop("_id", None)
    return requests

# ==================== CUSTOMER SUPPORT REQUESTS API ====================

@api_router.post("/customer/{customer_id}/support-request")
async def create_support_request(customer_id: str, data: dict):
    """Create a support request from customer portal"""
    if not validate_uuid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    account = await db.customer_accounts.find_one({"id": customer_id})
    if not account:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    request = {
        "id": str(uuid.uuid4()),
        "request_number": f"SUP-{str(uuid.uuid4())[:8].upper()}",
        "customer_id": customer_id,
        "customer_name": account.get("name", ""),
        "customer_email": account.get("email", ""),
        "request_type": data.get("request_type", "service"),
        "subject": sanitize_string(data.get("subject", ""), 200),
        "description": sanitize_string(data.get("description", ""), 2000),
        "service_address": data.get("service_address"),
        "equipment_id": data.get("equipment_id"),
        "equipment_type": data.get("equipment_type"),
        "priority": data.get("priority", "normal"),
        "status": "new",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.support_requests.insert_one(request)
    request.pop("_id", None)
    return request

@api_router.get("/support-requests")
async def get_all_support_requests(status: Optional[str] = None):
    """Get all support requests (admin view)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.support_requests.find(query).sort("created_at", -1).to_list(100)
    for r in requests:
        r.pop("_id", None)
    return requests

@api_router.put("/support-requests/{request_id}")
async def update_support_request(request_id: str, data: dict):
    """Update a support request status"""
    if not validate_uuid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.support_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        k: v for k, v in data.items() 
        if k in ["status", "assigned_to_id", "job_id", "response_notes"]
    }
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.support_requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": "Request updated"}

# ==================== JOB CHAT (WebSocket) API ====================

class ConnectionManager:
    """WebSocket connection manager for real-time chat"""
    def __init__(self):
        # job_id -> channel -> set of websocket connections
        self.active_connections: Dict[str, Dict[str, Set[WebSocket]]] = {}
        # websocket -> user info
        self.connection_info: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, job_id: str, channel: str, user_info: dict):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = {"internal": set(), "customer": set()}
        self.active_connections[job_id][channel].add(websocket)
        self.connection_info[websocket] = {"job_id": job_id, "channel": channel, "user": user_info}
        logger.info(f"WebSocket connected: {user_info.get('name')} to job {job_id} ({channel})")

    def disconnect(self, websocket: WebSocket):
        info = self.connection_info.get(websocket)
        if info:
            job_id = info["job_id"]
            channel = info["channel"]
            if job_id in self.active_connections and channel in self.active_connections[job_id]:
                self.active_connections[job_id][channel].discard(websocket)
            del self.connection_info[websocket]
            logger.info(f"WebSocket disconnected from job {job_id}")

    async def broadcast_to_job(self, job_id: str, channel: str, message: dict):
        """Broadcast message to all connections in a job channel"""
        if job_id not in self.active_connections:
            return
        
        connections = self.active_connections[job_id].get(channel, set())
        disconnected = set()
        
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected
        for conn in disconnected:
            self.disconnect(conn)

    def get_online_users(self, job_id: str, channel: str) -> List[dict]:
        """Get list of online users in a job channel"""
        if job_id not in self.active_connections:
            return []
        
        users = []
        for conn in self.active_connections[job_id].get(channel, set()):
            info = self.connection_info.get(conn)
            if info:
                users.append(info["user"])
        return users

chat_manager = ConnectionManager()

@app.websocket("/ws/chat/{job_id}/{channel}")
async def websocket_chat(websocket: WebSocket, job_id: str, channel: str):
    """WebSocket endpoint for job chat"""
    # Get token from query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    
    # Validate token
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.auth_users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except jwt.ExpiredSignatureError:
        await websocket.close(code=4001, reason="Token expired")
        return
    except jwt.InvalidTokenError:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    # Validate channel access
    if channel == "internal" and user.get("role") == "customer":
        await websocket.close(code=4003, reason="Access denied to internal channel")
        return
    
    user_info = {
        "id": user["id"],
        "name": user.get("name", "Unknown"),
        "role": user.get("role", "user"),
        "avatar_url": user.get("avatar_url"),
    }
    
    await chat_manager.connect(websocket, job_id, channel, user_info)
    
    # Send online users list
    online_users = chat_manager.get_online_users(job_id, channel)
    await websocket.send_json({"type": "users_online", "users": online_users})
    
    # Broadcast user joined
    await chat_manager.broadcast_to_job(job_id, channel, {
        "type": "user_joined",
        "user": user_info,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type", "message")
            
            if message_type == "message":
                # Save message to database
                message = {
                    "id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "channel": channel,
                    "sender_id": user["id"],
                    "sender_name": user.get("name", "Unknown"),
                    "sender_role": user.get("role", "user"),
                    "sender_avatar_url": user.get("avatar_url"),
                    "message_type": data.get("message_type", "text"),
                    "content": sanitize_string(data.get("content", ""), 2000),
                    "image_url": data.get("image_url"),
                    "is_read": False,
                    "read_by": [user["id"]],
                    "created_at": datetime.now(timezone.utc),
                }
                
                await db.chat_messages.insert_one(message)
                
                # Update thread
                await db.chat_threads.update_one(
                    {"job_id": job_id, "channel": channel},
                    {
                        "$set": {
                            "last_message_at": message["created_at"],
                            "last_message_preview": message["content"][:100],
                            "updated_at": datetime.now(timezone.utc),
                        },
                        "$inc": {"message_count": 1}
                    },
                    upsert=True
                )
                
                # Broadcast to all in channel
                message["created_at"] = message["created_at"].isoformat()
                await chat_manager.broadcast_to_job(job_id, channel, {
                    "type": "new_message",
                    "message": message,
                })
            
            elif message_type == "typing":
                await chat_manager.broadcast_to_job(job_id, channel, {
                    "type": "typing",
                    "user": user_info,
                })
            
            elif message_type == "read":
                # Mark messages as read
                message_ids = data.get("message_ids", [])
                if message_ids:
                    await db.chat_messages.update_many(
                        {"id": {"$in": message_ids}},
                        {"$addToSet": {"read_by": user["id"]}}
                    )
    
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket)
        await chat_manager.broadcast_to_job(job_id, channel, {
            "type": "user_left",
            "user": user_info,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        chat_manager.disconnect(websocket)

# Chat REST API endpoints
@api_router.get("/jobs/{job_id}/chat/{channel}/messages")
async def get_chat_messages(job_id: str, channel: str, limit: int = 50, before: Optional[str] = None):
    """Get chat messages for a job"""
    if not validate_uuid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    if channel not in ["internal", "customer"]:
        raise HTTPException(status_code=400, detail="Invalid channel")
    
    query = {"job_id": job_id, "channel": channel}
    if before:
        query["created_at"] = {"$lt": datetime.fromisoformat(before)}
    
    messages = await db.chat_messages.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Return in chronological order
    for m in messages:
        m.pop("_id", None)
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    
    return list(reversed(messages))

@api_router.get("/jobs/{job_id}/chat/threads")
async def get_chat_threads(job_id: str):
    """Get chat threads for a job"""
    if not validate_uuid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    threads = await db.chat_threads.find({"job_id": job_id}).to_list(10)
    for t in threads:
        t.pop("_id", None)
        if isinstance(t.get("last_message_at"), datetime):
            t["last_message_at"] = t["last_message_at"].isoformat()
    
    return threads

@api_router.post("/jobs/{job_id}/chat/{channel}/message")
async def post_chat_message(job_id: str, channel: str, data: dict, user: dict = Depends(require_auth)):
    """Post a chat message (REST fallback for non-WebSocket clients)"""
    if not validate_uuid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    if channel not in ["internal", "customer"]:
        raise HTTPException(status_code=400, detail="Invalid channel")
    
    # Check channel access
    if channel == "internal" and user.get("role") == "customer":
        raise HTTPException(status_code=403, detail="Access denied to internal channel")
    
    message = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "channel": channel,
        "sender_id": user["id"],
        "sender_name": user.get("name", "Unknown"),
        "sender_role": user.get("role", "user"),
        "sender_avatar_url": user.get("avatar_url"),
        "message_type": data.get("message_type", "text"),
        "content": sanitize_string(data.get("content", ""), 2000),
        "image_url": data.get("image_url"),
        "is_read": False,
        "read_by": [user["id"]],
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.chat_messages.insert_one(message.copy())  # Use copy to avoid _id mutation
    
    # Update thread
    await db.chat_threads.update_one(
        {"job_id": job_id, "channel": channel},
        {
            "$set": {
                "last_message_at": message["created_at"],
                "last_message_preview": message["content"][:100],
                "updated_at": datetime.now(timezone.utc),
            },
            "$inc": {"message_count": 1}
        },
        upsert=True
    )
    
    # Broadcast via WebSocket
    broadcast_message = message.copy()
    broadcast_message["created_at"] = broadcast_message["created_at"].isoformat()
    await chat_manager.broadcast_to_job(job_id, channel, {
        "type": "new_message",
        "message": broadcast_message,
    })
    
    # Return message with ISO timestamp
    message["created_at"] = message["created_at"].isoformat()
    return message

@api_router.get("/chat/unread-counts")
async def get_unread_counts(user: dict = Depends(require_auth)):
    """Get unread message counts by job"""
    user_id = user["id"]
    
    # Aggregate unread counts
    pipeline = [
        {"$match": {"read_by": {"$nin": [user_id]}}},
        {"$group": {"_id": {"job_id": "$job_id", "channel": "$channel"}, "count": {"$sum": 1}}},
    ]
    
    results = await db.chat_messages.aggregate(pipeline).to_list(100)
    
    counts = {}
    for r in results:
        job_id = r["_id"]["job_id"]
        channel = r["_id"]["channel"]
        if job_id not in counts:
            counts[job_id] = {"internal": 0, "customer": 0}
        counts[job_id][channel] = r["count"]
    
    return counts

# ==================== MULTI-WAREHOUSE INVENTORY API ====================

@api_router.get("/inventory/locations")
async def get_inventory_locations(location_type: Optional[str] = None, active_only: bool = True):
    """Get all inventory locations"""
    query = {}
    if location_type:
        query["location_type"] = location_type
    if active_only:
        query["is_active"] = True
    
    locations = await db.inventory_locations.find(query).sort("name", 1).to_list(100)
    for loc in locations:
        loc.pop("_id", None)
    return locations

@api_router.post("/inventory/locations")
async def create_inventory_location(data: dict):
    """Create a new inventory location"""
    location = {
        "id": str(uuid.uuid4()),
        "name": sanitize_string(data.get("name", ""), 200),
        "location_type": data.get("location_type", "warehouse"),
        "address": data.get("address"),
        "city": data.get("city"),
        "state": data.get("state"),
        "zip_code": data.get("zip_code"),
        "truck_id": data.get("truck_id"),
        "assigned_technician_id": data.get("assigned_technician_id"),
        "manager_name": data.get("manager_name"),
        "phone": data.get("phone"),
        "is_active": True,
        "is_primary": data.get("is_primary", False),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    # If setting as primary, unset others
    if location["is_primary"]:
        await db.inventory_locations.update_many({}, {"$set": {"is_primary": False}})
    
    await db.inventory_locations.insert_one(location)
    location.pop("_id", None)
    return location

@api_router.put("/inventory/locations/{location_id}")
async def update_inventory_location(location_id: str, data: dict):
    """Update an inventory location"""
    if not validate_uuid(location_id):
        raise HTTPException(status_code=400, detail="Invalid location ID")
    
    location = await db.inventory_locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    update_data = {k: v for k, v in data.items() if k in [
        "name", "location_type", "address", "city", "state", "zip_code",
        "truck_id", "assigned_technician_id", "manager_name", "phone", "is_active", "is_primary"
    ]}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    if update_data.get("is_primary"):
        await db.inventory_locations.update_many({}, {"$set": {"is_primary": False}})
    
    await db.inventory_locations.update_one({"id": location_id}, {"$set": update_data})
    
    updated = await db.inventory_locations.find_one({"id": location_id})
    updated.pop("_id", None)
    return updated

@api_router.get("/inventory/locations/{location_id}/stock")
async def get_location_stock(location_id: str):
    """Get stock levels for a location"""
    if not validate_uuid(location_id):
        raise HTTPException(status_code=400, detail="Invalid location ID")
    
    # Get stock records with item details
    pipeline = [
        {"$match": {"location_id": location_id}},
        {"$lookup": {
            "from": "inventory_items",
            "localField": "item_id",
            "foreignField": "id",
            "as": "item"
        }},
        {"$unwind": {"path": "$item", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "id": 1,
            "location_id": 1,
            "item_id": 1,
            "quantity_on_hand": 1,
            "quantity_reserved": 1,
            "quantity_available": 1,
            "min_quantity": 1,
            "max_quantity": 1,
            "reorder_point": 1,
            "average_cost": 1,
            "total_value": 1,
            "item_name": "$item.name",
            "item_sku": "$item.sku",
            "item_category": "$item.category",
        }}
    ]
    
    stock = await db.location_inventory.aggregate(pipeline).to_list(500)
    return stock

@api_router.put("/inventory/locations/{location_id}/stock/{item_id}")
async def update_location_stock(location_id: str, item_id: str, data: dict, user: dict = Depends(require_auth)):
    """Update stock level for an item at a location"""
    if not validate_uuid(location_id) or not validate_uuid(item_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    # Get current stock
    stock = await db.location_inventory.find_one({"location_id": location_id, "item_id": item_id})
    quantity_before = stock.get("quantity_on_hand", 0) if stock else 0
    
    new_quantity = data.get("quantity_on_hand", quantity_before)
    adjustment = new_quantity - quantity_before
    
    # Update or create stock record
    stock_update = {
        "location_id": location_id,
        "item_id": item_id,
        "quantity_on_hand": new_quantity,
        "quantity_available": new_quantity - (stock.get("quantity_reserved", 0) if stock else 0),
        "min_quantity": data.get("min_quantity", stock.get("min_quantity", 0) if stock else 0),
        "max_quantity": data.get("max_quantity", stock.get("max_quantity", 100) if stock else 100),
        "reorder_point": data.get("reorder_point", stock.get("reorder_point", 0) if stock else 0),
        "updated_at": datetime.now(timezone.utc),
    }
    
    if stock:
        await db.location_inventory.update_one(
            {"location_id": location_id, "item_id": item_id},
            {"$set": stock_update}
        )
    else:
        stock_update["id"] = str(uuid.uuid4())
        await db.location_inventory.insert_one(stock_update)
    
    # Record movement
    if adjustment != 0:
        movement = {
            "id": str(uuid.uuid4()),
            "location_id": location_id,
            "item_id": item_id,
            "movement_type": "adjustment",
            "quantity": adjustment,
            "quantity_before": quantity_before,
            "quantity_after": new_quantity,
            "reference_type": "manual",
            "performed_by_id": user["id"],
            "performed_by_name": user.get("name", "Unknown"),
            "performed_at": datetime.now(timezone.utc),
            "notes": data.get("notes", "Manual adjustment"),
        }
        await db.inventory_movements.insert_one(movement)
    
    return {"message": "Stock updated", "quantity": new_quantity}

@api_router.post("/inventory/transfers")
async def create_inventory_transfer(data: dict, user: dict = Depends(require_auth)):
    """Create an inventory transfer request"""
    from_location = await db.inventory_locations.find_one({"id": data.get("from_location_id")})
    to_location = await db.inventory_locations.find_one({"id": data.get("to_location_id")})
    
    if not from_location or not to_location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    transfer = {
        "id": str(uuid.uuid4()),
        "transfer_number": f"TRF-{str(uuid.uuid4())[:8].upper()}",
        "from_location_id": from_location["id"],
        "from_location_name": from_location["name"],
        "to_location_id": to_location["id"],
        "to_location_name": to_location["name"],
        "items": data.get("items", []),
        "status": "pending",
        "requested_by_id": user["id"],
        "requested_by_name": user.get("name", "Unknown"),
        "requested_at": datetime.now(timezone.utc),
        "notes": data.get("notes"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.inventory_transfers.insert_one(transfer)
    transfer.pop("_id", None)
    return transfer

@api_router.get("/inventory/transfers")
async def get_inventory_transfers(status: Optional[str] = None, location_id: Optional[str] = None):
    """Get inventory transfers"""
    query = {}
    if status:
        query["status"] = status
    if location_id:
        query["$or"] = [{"from_location_id": location_id}, {"to_location_id": location_id}]
    
    transfers = await db.inventory_transfers.find(query).sort("created_at", -1).to_list(100)
    for t in transfers:
        t.pop("_id", None)
    return transfers

@api_router.put("/inventory/transfers/{transfer_id}/approve")
async def approve_inventory_transfer(transfer_id: str, user: dict = Depends(require_auth)):
    """Approve a transfer and mark as in-transit"""
    if not validate_uuid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID")
    
    transfer = await db.inventory_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Transfer is not pending")
    
    # Deduct from source location
    for item in transfer.get("items", []):
        item_id = item.get("item_id")
        quantity = item.get("quantity", 0)
        
        stock = await db.location_inventory.find_one({
            "location_id": transfer["from_location_id"],
            "item_id": item_id
        })
        
        if not stock or stock.get("quantity_available", 0) < quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.get('item_name')}")
        
        # Update source stock
        await db.location_inventory.update_one(
            {"location_id": transfer["from_location_id"], "item_id": item_id},
            {"$inc": {"quantity_on_hand": -quantity, "quantity_available": -quantity}}
        )
        
        # Record movement
        movement = {
            "id": str(uuid.uuid4()),
            "location_id": transfer["from_location_id"],
            "item_id": item_id,
            "movement_type": "transfer_out",
            "quantity": -quantity,
            "reference_type": "transfer",
            "reference_id": transfer_id,
            "reference_number": transfer["transfer_number"],
            "performed_by_id": user["id"],
            "performed_by_name": user.get("name", "Unknown"),
            "performed_at": datetime.now(timezone.utc),
        }
        await db.inventory_movements.insert_one(movement)
    
    await db.inventory_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "in_transit",
            "approved_by_id": user["id"],
            "approved_at": datetime.now(timezone.utc),
            "shipped_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    return {"message": "Transfer approved and shipped"}

@api_router.put("/inventory/transfers/{transfer_id}/receive")
async def receive_inventory_transfer(transfer_id: str, user: dict = Depends(require_auth)):
    """Receive a transfer at destination"""
    if not validate_uuid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid transfer ID")
    
    transfer = await db.inventory_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer["status"] != "in_transit":
        raise HTTPException(status_code=400, detail="Transfer is not in transit")
    
    # Add to destination location
    for item in transfer.get("items", []):
        item_id = item.get("item_id")
        quantity = item.get("quantity", 0)
        
        # Update or create destination stock
        existing = await db.location_inventory.find_one({
            "location_id": transfer["to_location_id"],
            "item_id": item_id
        })
        
        if existing:
            await db.location_inventory.update_one(
                {"location_id": transfer["to_location_id"], "item_id": item_id},
                {"$inc": {"quantity_on_hand": quantity, "quantity_available": quantity}}
            )
        else:
            await db.location_inventory.insert_one({
                "id": str(uuid.uuid4()),
                "location_id": transfer["to_location_id"],
                "item_id": item_id,
                "quantity_on_hand": quantity,
                "quantity_reserved": 0,
                "quantity_available": quantity,
                "updated_at": datetime.now(timezone.utc),
            })
        
        # Record movement
        movement = {
            "id": str(uuid.uuid4()),
            "location_id": transfer["to_location_id"],
            "item_id": item_id,
            "movement_type": "transfer_in",
            "quantity": quantity,
            "reference_type": "transfer",
            "reference_id": transfer_id,
            "reference_number": transfer["transfer_number"],
            "performed_by_id": user["id"],
            "performed_by_name": user.get("name", "Unknown"),
            "performed_at": datetime.now(timezone.utc),
        }
        await db.inventory_movements.insert_one(movement)
    
    await db.inventory_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "received",
            "received_by_id": user["id"],
            "received_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    return {"message": "Transfer received"}

@api_router.get("/inventory/movements")
async def get_inventory_movements(location_id: Optional[str] = None, item_id: Optional[str] = None, limit: int = 100):
    """Get inventory movement history"""
    query = {}
    if location_id:
        query["location_id"] = location_id
    if item_id:
        query["item_id"] = item_id
    
    movements = await db.inventory_movements.find(query).sort("performed_at", -1).limit(limit).to_list(limit)
    for m in movements:
        m.pop("_id", None)
    return movements

# ==================== OFFLINE SYNC API ====================

@api_router.post("/sync/batch")
async def sync_offline_changes(batch: SyncBatch):
    """Sync a batch of offline changes"""
    results = {
        "synced": [],
        "conflicts": [],
        "failed": []
    }
    
    for change in batch.changes:
        queue_item = OfflineSyncQueue(
            client_id=batch.client_id,
            user_id=batch.user_id,
            user_type=batch.user_type,
            operation=change["operation"],
            entity_type=change["entity_type"],
            entity_id=change.get("entity_id"),
            payload=change.get("payload", {}),
            client_timestamp=datetime.fromisoformat(change["client_timestamp"]) if isinstance(change["client_timestamp"], str) else change["client_timestamp"],
            server_received_at=datetime.utcnow()
        )
        
        try:
            # Process based on entity type
            result = await process_sync_item(queue_item)
            
            if result["status"] == "synced":
                results["synced"].append({
                    "entity_type": change["entity_type"],
                    "entity_id": result.get("entity_id"),
                    "message": result.get("message")
                })
                queue_item.status = "synced"
            elif result["status"] == "conflict":
                results["conflicts"].append({
                    "entity_type": change["entity_type"],
                    "entity_id": change.get("entity_id"),
                    "conflict_type": result.get("conflict_type"),
                    "server_data": result.get("server_data"),
                    "queue_id": queue_item.id
                })
                queue_item.status = "conflict"
                queue_item.conflict_type = result.get("conflict_type")
                queue_item.conflict_data = result.get("server_data")
            else:
                results["failed"].append({
                    "entity_type": change["entity_type"],
                    "error": result.get("error")
                })
                queue_item.status = "failed"
                queue_item.last_error = result.get("error")
        
        except Exception as e:
            results["failed"].append({
                "entity_type": change["entity_type"],
                "error": str(e)
            })
            queue_item.status = "failed"
            queue_item.last_error = str(e)
        
        # Store sync attempt
        await db.sync_queue.insert_one(queue_item.dict())
    
    return results

async def process_sync_item(item: OfflineSyncQueue) -> dict:
    """Process a single sync item"""
    entity_type = item.entity_type
    operation = item.operation
    entity_id = item.entity_id
    payload = item.payload
    
    # Map entity types to collections
    collection_map = {
        "job": "jobs",
        "task": "tasks",
        "time_entry": "job_time_entries",
        "shift": "shift_sessions",
        "stock_check": "stock_checks",
        "equipment_usage": "job_equipment_usage"
    }
    
    collection_name = collection_map.get(entity_type)
    if not collection_name:
        return {"status": "failed", "error": f"Unknown entity type: {entity_type}"}
    
    collection = db[collection_name]
    
    if operation == "create":
        # Check if already exists (duplicate sync)
        if entity_id:
            existing = await collection.find_one({"id": entity_id})
            if existing:
                return {"status": "synced", "message": "Already exists", "entity_id": entity_id}
        
        # Create new
        if "id" not in payload:
            payload["id"] = str(uuid.uuid4())
        payload["created_at"] = datetime.utcnow()
        
        await collection.insert_one(payload)
        return {"status": "synced", "entity_id": payload["id"]}
    
    elif operation == "update":
        if not entity_id:
            return {"status": "failed", "error": "Entity ID required for update"}
        
        existing = await collection.find_one({"id": entity_id})
        if not existing:
            return {"status": "conflict", "conflict_type": "deleted", "server_data": None}
        
        # Check for concurrent edit (simple version check)
        server_updated = existing.get("updated_at")
        client_timestamp = item.client_timestamp
        
        if server_updated and client_timestamp:
            if isinstance(server_updated, str):
                server_updated = datetime.fromisoformat(server_updated)
            if server_updated > client_timestamp:
                # Server has newer version
                existing.pop("_id", None)
                return {
                    "status": "conflict",
                    "conflict_type": "concurrent_edit",
                    "server_data": existing
                }
        
        # Apply update
        payload["updated_at"] = datetime.utcnow()
        await collection.update_one({"id": entity_id}, {"$set": payload})
        return {"status": "synced", "entity_id": entity_id}
    
    elif operation == "delete":
        if not entity_id:
            return {"status": "failed", "error": "Entity ID required for delete"}
        
        result = await collection.delete_one({"id": entity_id})
        if result.deleted_count == 0:
            return {"status": "synced", "message": "Already deleted"}
        
        return {"status": "synced", "entity_id": entity_id}
    
    return {"status": "failed", "error": f"Unknown operation: {operation}"}

@api_router.post("/sync/resolve")
async def resolve_conflict(resolution: ConflictResolution):
    """Resolve a sync conflict"""
    queue_item = await db.sync_queue.find_one({"id": resolution.queue_id})
    if not queue_item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    if queue_item["status"] != "conflict":
        raise HTTPException(status_code=400, detail="Item is not in conflict state")
    
    entity_type = queue_item["entity_type"]
    entity_id = queue_item["entity_id"]
    
    collection_map = {
        "job": "jobs",
        "task": "tasks",
        "time_entry": "job_time_entries",
        "shift": "shift_sessions"
    }
    
    collection = db[collection_map.get(entity_type, entity_type)]
    
    if resolution.resolution == "client_wins":
        # Apply client's version
        payload = queue_item["payload"]
        payload["updated_at"] = datetime.utcnow()
        await collection.update_one({"id": entity_id}, {"$set": payload}, upsert=True)
    
    elif resolution.resolution == "merged" and resolution.merged_data:
        # Apply merged data
        resolution.merged_data["updated_at"] = datetime.utcnow()
        await collection.update_one({"id": entity_id}, {"$set": resolution.merged_data}, upsert=True)
    
    # server_wins means we do nothing - keep server version
    
    # Update queue item
    await db.sync_queue.update_one(
        {"id": resolution.queue_id},
        {"$set": {
            "status": "synced",
            "resolution": resolution.resolution,
            "resolved_at": datetime.utcnow()
        }}
    )
    
    return {"message": f"Conflict resolved with {resolution.resolution}"}

@api_router.get("/sync/status/{client_id}", response_model=SyncStatus)
async def get_sync_status(client_id: str):
    """Get sync status for a client"""
    pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    counts = await db.sync_queue.aggregate(pipeline).to_list(10)
    count_map = {c["_id"]: c["count"] for c in counts}
    
    # Get unresolved conflicts
    conflicts = await db.sync_queue.find({
        "client_id": client_id,
        "status": "conflict"
    }).to_list(50)
    
    for c in conflicts:
        c.pop("_id", None)
    
    # Get last sync time
    last_sync = await db.sync_queue.find_one(
        {"client_id": client_id, "status": "synced"},
        sort=[("server_received_at", -1)]
    )
    
    return SyncStatus(
        client_id=client_id,
        pending_count=count_map.get("pending", 0),
        synced_count=count_map.get("synced", 0),
        conflict_count=count_map.get("conflict", 0),
        failed_count=count_map.get("failed", 0),
        last_sync=last_sync["server_received_at"] if last_sync else None,
        conflicts=conflicts
    )

@api_router.get("/sync/pending/{client_id}")
async def get_pending_syncs(client_id: str):
    """Get pending sync items for retry"""
    items = await db.sync_queue.find({
        "client_id": client_id,
        "status": {"$in": ["pending", "failed"]},
        "retry_count": {"$lt": 3}
    }).to_list(100)
    
    for item in items:
        item.pop("_id", None)
    
    return items

# ==================== RBAC - ROLES API (RFC-002 Section 4.9) ====================

@api_router.get("/roles", response_model=List[Role])
async def get_roles():
    """Get all roles"""
    await ensure_default_roles()
    roles = await db.roles.find().to_list(100)
    return [Role(**r) for r in roles]

@api_router.post("/roles", response_model=Role)
async def create_role(data: RoleCreate):
    """Create a custom role"""
    role = Role(
        name=sanitize_string(data.name, 50).lower().replace(" ", "_"),
        display_name=sanitize_string(data.display_name, 100),
        description=sanitize_string(data.description, 500) if data.description else None,
        permissions=data.permissions,
        is_system=False
    )
    await db.roles.insert_one(role.dict())
    return role

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    """Delete a custom role (system roles cannot be deleted)"""
    if not validate_uuid(role_id):
        raise HTTPException(status_code=400, detail="Invalid role ID")
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    await db.roles.delete_one({"id": role_id})
    return {"message": "Role deleted"}

async def ensure_default_roles():
    """Ensure default system roles exist"""
    for role_data in DEFAULT_ROLES:
        existing = await db.roles.find_one({"name": role_data["name"], "is_system": True})
        if not existing:
            role = Role(
                name=role_data["name"],
                display_name=role_data["display_name"],
                description=role_data["description"],
                is_system=True
            )
            await db.roles.insert_one(role.dict())

# ==================== LEADS API (RFC-002 Section 4.1.1) ====================

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all leads with filtering"""
    query = {}
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if assigned_to:
        query["assigned_to_id"] = assigned_to
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"contact_name": {"$regex": safe_search, "$options": "i"}},
            {"contact_email": {"$regex": safe_search, "$options": "i"}},
            {"company_name": {"$regex": safe_search, "$options": "i"}},
            {"lead_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    leads = await db.leads.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [Lead(**lead) for lead in leads]

@api_router.get("/leads/metrics")
async def get_lead_metrics():
    """Get lead metrics per RFC-002 Section 4.1.1"""
    # Count by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.leads.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Count by source
    source_pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    source_counts = await db.leads.aggregate(source_pipeline).to_list(20)
    
    # Calculate conversion rate (won / (won + lost))
    total_closed = status_map.get("won", 0) + status_map.get("lost", 0)
    conversion_rate = (status_map.get("won", 0) / total_closed * 100) if total_closed > 0 else 0
    
    # Average time to first contact
    # (For now, return placeholder - would need timestamp analysis)
    
    return {
        "total_leads": sum(status_map.values()),
        "by_status": status_map,
        "by_source": {c["_id"]: c["count"] for c in source_counts},
        "lead_to_close_ratio": round(conversion_rate, 1),
        "avg_time_to_first_contact_hours": 4.2  # Placeholder
    }

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str):
    """Get a specific lead"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return Lead(**lead)

@api_router.post("/leads", response_model=Lead)
async def create_lead(data: LeadCreate):
    """Create a new lead"""
    lead = Lead(
        contact_name=sanitize_string(data.contact_name, 200),
        contact_email=sanitize_string(data.contact_email, 255) if data.contact_email else None,
        contact_phone=sanitize_string(data.contact_phone, 20) if data.contact_phone else None,
        company_name=sanitize_string(data.company_name, 200) if data.company_name else None,
        address=sanitize_string(data.address, 500) if data.address else None,
        city=sanitize_string(data.city, 100) if data.city else None,
        state=sanitize_string(data.state, 50) if data.state else None,
        zip_code=sanitize_string(data.zip_code, 20) if data.zip_code else None,
        source=sanitize_string(data.source, 50),
        source_detail=sanitize_string(data.source_detail, 200) if data.source_detail else None,
        preferred_contact_method=data.preferred_contact_method,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
        tags=data.tags,
        estimated_value=data.estimated_value,
        priority=data.priority,
    )
    await db.leads.insert_one(lead.dict())
    return lead

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, data: LeadUpdate):
    """Update a lead"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = {}
    for k, v in data.dict().items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    # Track status changes
    if "status" in update_data and update_data["status"] != lead.get("status"):
        update_data["status_changed_at"] = datetime.utcnow()
        
        # Track specific status timestamps
        new_status = update_data["status"]
        if new_status == "contacted" and not lead.get("first_contact_at"):
            update_data["first_contact_at"] = datetime.utcnow()
        elif new_status == "qualified":
            update_data["qualified_at"] = datetime.utcnow()
        elif new_status == "quoted":
            update_data["quoted_at"] = datetime.utcnow()
        elif new_status in ["won", "lost"]:
            update_data["closed_at"] = datetime.utcnow()
    
    # Update assigned name if ID changed
    if "assigned_to_id" in update_data:
        user = await db.users.find_one({"id": update_data["assigned_to_id"]})
        if not user:
            tech = await db.technicians.find_one({"id": update_data["assigned_to_id"]})
            user = tech
        update_data["assigned_to_name"] = user["name"] if user else None
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.leads.update_one({"id": lead["id"]}, {"$set": update_data})
    updated = await db.leads.find_one({"id": lead["id"]})
    return Lead(**updated)

@api_router.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: str, customer_name: Optional[str] = None):
    """Convert a lead to a customer and optionally create a job"""
    lead = await db.leads.find_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Create customer record (simplified)
    customer_id = str(uuid.uuid4())
    
    # Update lead
    await db.leads.update_one(
        {"id": lead["id"]},
        {"$set": {
            "status": "won",
            "status_changed_at": datetime.utcnow(),
            "closed_at": datetime.utcnow(),
            "converted_customer_id": customer_id,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "Lead converted successfully",
        "customer_id": customer_id,
        "lead_id": lead["id"]
    }

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead"""
    result = await db.leads.delete_one({"$or": [{"id": lead_id}, {"lead_number": lead_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

# ==================== PCB API (RFC-002 Section 4.1.2) ====================

@api_router.get("/pcbs", response_model=List[PCB])
async def get_pcbs(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all PCBs (Potential Callbacks)"""
    query = {}
    if status:
        query["status"] = status
    if assigned_to:
        query["$or"] = [
            {"assigned_technician_id": assigned_to},
            {"assigned_owner_id": assigned_to}
        ]
    if priority:
        query["priority"] = priority
    
    pcbs = await db.pcbs.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [PCB(**p) for p in pcbs]

@api_router.get("/pcbs/metrics")
async def get_pcb_metrics():
    """Get PCB metrics per RFC-002"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.pcbs.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Conversion rate
    total_resolved = status_map.get("converted", 0) + status_map.get("closed", 0)
    conversion_rate = (status_map.get("converted", 0) / total_resolved * 100) if total_resolved > 0 else 0
    
    # Overdue follow-ups
    today = datetime.utcnow().strftime("%Y-%m-%d")
    overdue_count = await db.pcbs.count_documents({
        "status": {"$in": ["created", "assigned", "follow_up"]},
        "follow_up_date": {"$lt": today}
    })
    
    return {
        "total_pcbs": sum(status_map.values()),
        "open_pcbs": status_map.get("created", 0) + status_map.get("assigned", 0) + status_map.get("follow_up", 0),
        "by_status": status_map,
        "conversion_rate": round(conversion_rate, 1),
        "overdue_count": overdue_count
    }

@api_router.get("/pcbs/{pcb_id}", response_model=PCB)
async def get_pcb(pcb_id: str):
    """Get a specific PCB"""
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    return PCB(**pcb)

@api_router.post("/pcbs", response_model=PCB)
async def create_pcb(data: PCBCreate):
    """Create a new PCB"""
    # Get assigned names
    tech_name = None
    owner_name = None
    
    if data.assigned_technician_id:
        tech = await db.technicians.find_one({"id": data.assigned_technician_id})
        tech_name = tech["name"] if tech else None
    
    if data.assigned_owner_id:
        user = await db.users.find_one({"id": data.assigned_owner_id})
        owner_name = user["name"] if user else None
    
    pcb = PCB(
        lead_id=data.lead_id,
        job_id=data.job_id,
        customer_id=data.customer_id,
        customer_name=sanitize_string(data.customer_name, 200) if data.customer_name else None,
        reason=sanitize_string(data.reason, 1000),
        reason_category=data.reason_category,
        assigned_technician_id=data.assigned_technician_id,
        assigned_technician_name=tech_name,
        assigned_owner_id=data.assigned_owner_id,
        assigned_owner_name=owner_name,
        follow_up_date=data.follow_up_date,
        follow_up_time=data.follow_up_time,
        priority=data.priority,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
        status="assigned" if (data.assigned_technician_id or data.assigned_owner_id) else "created",
    )
    await db.pcbs.insert_one(pcb.dict())
    return pcb

@api_router.put("/pcbs/{pcb_id}", response_model=PCB)
async def update_pcb(pcb_id: str, data: PCBUpdate):
    """Update a PCB"""
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    
    update_data = {}
    for k, v in data.dict().items():
        if v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    # Track status changes
    if "status" in update_data and update_data["status"] != pcb.get("status"):
        update_data["status_changed_at"] = datetime.utcnow()
        if update_data["status"] in ["converted", "closed"]:
            update_data["resolved_at"] = datetime.utcnow()
    
    # Update assigned names
    if "assigned_technician_id" in update_data:
        tech = await db.technicians.find_one({"id": update_data["assigned_technician_id"]})
        update_data["assigned_technician_name"] = tech["name"] if tech else None
    
    if "assigned_owner_id" in update_data:
        user = await db.users.find_one({"id": update_data["assigned_owner_id"]})
        update_data["assigned_owner_name"] = user["name"] if user else None
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.pcbs.update_one({"id": pcb["id"]}, {"$set": update_data})
    updated = await db.pcbs.find_one({"id": pcb["id"]})
    return PCB(**updated)

@api_router.post("/pcbs/{pcb_id}/convert")
async def convert_pcb_to_job(pcb_id: str, job_data: Optional[dict] = None):
    """Convert a PCB to a job"""
    pcb = await db.pcbs.find_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
    
    # Create a new job from PCB
    job_count = await db.jobs.count_documents({})
    job = Job(
        job_number=f"JOB-{job_count + 1001}",
        customer_name=pcb.get("customer_name", "Unknown"),
        customer_id=pcb.get("customer_id"),
        site_address=pcb.get("address", "Address to be provided"),
        job_type="Service",
        title=f"Follow-up: {pcb.get('reason', 'PCB Callback')[:50]}",
        description=pcb.get("notes"),
        priority=pcb.get("priority", "normal"),
    )
    await db.jobs.insert_one(job.dict())
    
    # Update PCB
    await db.pcbs.update_one(
        {"id": pcb["id"]},
        {"$set": {
            "status": "converted",
            "status_changed_at": datetime.utcnow(),
            "resolved_at": datetime.utcnow(),
            "converted_to_job_id": job.id,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "PCB converted to job",
        "job_id": job.id,
        "job_number": job.job_number
    }

@api_router.delete("/pcbs/{pcb_id}")
async def delete_pcb(pcb_id: str):
    """Delete a PCB"""
    result = await db.pcbs.delete_one({"$or": [{"id": pcb_id}, {"pcb_number": pcb_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PCB not found")
    return {"message": "PCB deleted"}

# ==================== PROPOSALS API (RFC-002 Section 4.1.3) ====================

@api_router.get("/proposals", response_model=List[Proposal])
async def get_proposals(
    status: Optional[str] = None,
    lead_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Get all proposals"""
    query = {}
    if status:
        query["status"] = status
    if lead_id:
        query["lead_id"] = lead_id
    if customer_id:
        query["customer_id"] = customer_id
    
    proposals = await db.proposals.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [Proposal(**p) for p in proposals]

@api_router.get("/proposals/metrics")
async def get_proposal_metrics():
    """Get proposal metrics"""
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.proposals.aggregate(pipeline).to_list(10)
    status_map = {c["_id"]: c["count"] for c in status_counts}
    
    # Win rate
    total_decided = status_map.get("accepted", 0) + status_map.get("rejected", 0)
    win_rate = (status_map.get("accepted", 0) / total_decided * 100) if total_decided > 0 else 0
    
    return {
        "total_proposals": sum(status_map.values()),
        "by_status": status_map,
        "open_quotes": status_map.get("draft", 0) + status_map.get("sent", 0),
        "win_rate": round(win_rate, 1)
    }

@api_router.get("/proposals/{proposal_id}", response_model=Proposal)
async def get_proposal(proposal_id: str):
    """Get a specific proposal"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return Proposal(**proposal)

@api_router.post("/proposals", response_model=Proposal)
async def create_proposal(data: ProposalCreate):
    """Create a new proposal"""
    proposal = Proposal(
        lead_id=data.lead_id,
        job_id=data.job_id,
        customer_id=data.customer_id,
        customer_name=sanitize_string(data.customer_name, 200),
        customer_email=sanitize_string(data.customer_email, 255) if data.customer_email else None,
        customer_phone=sanitize_string(data.customer_phone, 20) if data.customer_phone else None,
        site_address=sanitize_string(data.site_address, 500),
        title=sanitize_string(data.title, 200),
        description=sanitize_string(data.description, 2000) if data.description else None,
        valid_until=data.valid_until,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
    )
    await db.proposals.insert_one(proposal.dict())
    
    # Link to lead if provided
    if data.lead_id:
        await db.leads.update_one(
            {"id": data.lead_id},
            {"$push": {"proposal_ids": proposal.id}}
        )
    
    return proposal

@api_router.put("/proposals/{proposal_id}", response_model=Proposal)
async def update_proposal(proposal_id: str, data: dict):
    """Update a proposal"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    update_data = {k: v for k, v in data.items() if v is not None}
    
    # Track status changes
    if "status" in update_data and update_data["status"] != proposal.get("status"):
        update_data["status_changed_at"] = datetime.utcnow()
        if update_data["status"] == "sent":
            update_data["sent_at"] = datetime.utcnow()
        elif update_data["status"] == "accepted":
            update_data["accepted_at"] = datetime.utcnow()
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.proposals.update_one({"id": proposal["id"]}, {"$set": update_data})
    updated = await db.proposals.find_one({"id": proposal["id"]})
    return Proposal(**updated)

@api_router.post("/proposals/{proposal_id}/options")
async def add_proposal_option(proposal_id: str, option_data: dict):
    """Add a Good/Better/Best option to a proposal"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    option = ProposalOption(
        tier=option_data.get("tier", "good"),
        name=sanitize_string(option_data.get("name", "Option"), 100),
        description=sanitize_string(option_data.get("description", ""), 500) if option_data.get("description") else None,
        line_items=[ProposalLineItem(**item) for item in option_data.get("line_items", [])],
        is_recommended=option_data.get("is_recommended", False),
    )
    
    # Calculate totals
    for item in option.line_items:
        item.extended_price = item.quantity * item.unit_price
    
    option.equipment_total = sum(i.extended_price for i in option.line_items if i.item_type == "equipment")
    option.labor_total = sum(i.extended_price for i in option.line_items if i.item_type == "labor")
    option.materials_total = sum(i.extended_price for i in option.line_items if i.item_type == "material")
    option.misc_total = sum(i.extended_price for i in option.line_items if i.item_type == "misc")
    option.subtotal = option.equipment_total + option.labor_total + option.materials_total + option.misc_total
    option.discount_amount = sum(abs(i.extended_price) for i in option.line_items if i.item_type == "discount")
    option.total = option.subtotal - option.discount_amount + option.tax_amount
    
    # Add to proposal
    await db.proposals.update_one(
        {"id": proposal["id"]},
        {
            "$push": {"options": option.dict()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Option added", "option_id": option.id}

@api_router.post("/proposals/{proposal_id}/accept")
async def accept_proposal(proposal_id: str, option_id: str, signature: Optional[str] = None):
    """Accept a proposal and convert to job"""
    proposal = await db.proposals.find_one({"$or": [{"id": proposal_id}, {"proposal_number": proposal_id}]})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Create job from proposal
    job_count = await db.jobs.count_documents({})
    job = Job(
        job_number=f"JOB-{job_count + 1001}",
        customer_name=proposal["customer_name"],
        customer_email=proposal.get("customer_email"),
        customer_phone=proposal.get("customer_phone"),
        site_address=proposal["site_address"],
        job_type="Install",
        title=proposal["title"],
        description=proposal.get("description"),
    )
    await db.jobs.insert_one(job.dict())
    
    # Update proposal
    await db.proposals.update_one(
        {"id": proposal["id"]},
        {"$set": {
            "status": "accepted",
            "status_changed_at": datetime.utcnow(),
            "accepted_at": datetime.utcnow(),
            "selected_option_id": option_id,
            "customer_signature": signature,
            "customer_signed_at": datetime.utcnow() if signature else None,
            "converted_job_id": job.id,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update lead if linked
    if proposal.get("lead_id"):
        await db.leads.update_one(
            {"id": proposal["lead_id"]},
            {"$set": {
                "status": "won",
                "status_changed_at": datetime.utcnow(),
                "closed_at": datetime.utcnow(),
                "converted_job_id": job.id,
                "updated_at": datetime.utcnow()
            }}
        )
    
    return {
        "message": "Proposal accepted and job created",
        "job_id": job.id,
        "job_number": job.job_number
    }

# ==================== JOB TYPES & TEMPLATES API (RFC-002 Section 4.2.1) ====================

@api_router.get("/job-types", response_model=List[JobTypeTemplate])
async def get_job_types(
    category: Optional[str] = None,
    active_only: bool = True
):
    """Get all job type templates"""
    await ensure_default_job_types()
    
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["is_active"] = True
    
    templates = await db.job_type_templates.find(query).sort("name", 1).to_list(100)
    return [JobTypeTemplate(**t) for t in templates]

@api_router.post("/job-types", response_model=JobTypeTemplate)
async def create_job_type(data: JobTypeTemplateCreate):
    """Create a new job type template"""
    template = JobTypeTemplate(
        name=sanitize_string(data.name, 100),
        category=data.category,
        description=sanitize_string(data.description, 500) if data.description else None,
        default_priority=data.default_priority,
        estimated_duration_hours=data.estimated_duration_hours,
        requires_permit=data.requires_permit,
        requires_inspection=data.requires_inspection,
        base_labor_rate=data.base_labor_rate,
        trip_charge=data.trip_charge,
        checklist_items=data.checklist_items,
    )
    await db.job_type_templates.insert_one(template.dict())
    return template

@api_router.put("/job-types/{template_id}", response_model=JobTypeTemplate)
async def update_job_type(template_id: str, data: dict):
    """Update a job type template with version control"""
    template = await db.job_type_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Job type template not found")
    
    # Create new version
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["version"] = template.get("version", 1) + 1
    update_data["updated_at"] = datetime.utcnow()
    
    await db.job_type_templates.update_one({"id": template_id}, {"$set": update_data})
    updated = await db.job_type_templates.find_one({"id": template_id})
    return JobTypeTemplate(**updated)

async def ensure_default_job_types():
    """Ensure default job type templates exist"""
    default_types = [
        {
            "name": "Residential AC Service",
            "category": "residential_service",
            "description": "Standard residential air conditioning service call",
            "estimated_duration_hours": 1.5,
            "checklist_items": [
                {"order": 0, "description": "Check thermostat operation and settings", "requires_before_photo": False, "requires_after_photo": False, "is_required": True},
                {"order": 1, "description": "Inspect and replace air filter if needed", "requires_before_photo": True, "requires_after_photo": True, "is_required": True},
                {"order": 2, "description": "Check refrigerant levels and look for leaks", "requires_note": True, "is_required": True},
                {"order": 3, "description": "Inspect electrical connections and tighten", "requires_before_photo": False, "is_required": True},
                {"order": 4, "description": "Clean condensate drain line", "requires_after_photo": True, "is_required": True},
                {"order": 5, "description": "Check capacitor and contactor", "requires_note": True, "is_required": True},
            ]
        },
        {
            "name": "Residential AC Install",
            "category": "residential_install",
            "description": "Full residential air conditioning system installation",
            "estimated_duration_hours": 8.0,
            "requires_permit": True,
            "requires_inspection": True,
            "checklist_items": [
                {"order": 0, "description": "Photograph existing equipment and area before removal", "requires_before_photo": True, "is_required": True},
                {"order": 1, "description": "Safely remove and dispose of old equipment and refrigerant", "requires_note": True, "is_required": True},
                {"order": 2, "description": "Install new indoor unit/air handler according to manufacturer specifications", "requires_before_photo": True, "requires_after_photo": True, "is_required": True},
                {"order": 3, "description": "Install new outdoor condensing unit on proper pad with correct clearances", "requires_before_photo": True, "requires_after_photo": True, "is_required": True},
                {"order": 4, "description": "Connect refrigerant lines, pressure test, and charge system", "requires_note": True, "is_required": True},
                {"order": 5, "description": "Install new thermostat and verify operation", "requires_after_photo": True, "is_required": True},
                {"order": 6, "description": "Perform system startup and document readings", "requires_note": True, "requires_measurement": True, "is_required": True},
                {"order": 7, "description": "Customer walkthrough and operation demonstration", "requires_signature": True, "is_required": True},
            ]
        },
        {
            "name": "Commercial RTU Service",
            "category": "commercial_service",
            "description": "Rooftop unit service and maintenance",
            "estimated_duration_hours": 2.0,
            "checklist_items": [
                {"order": 0, "description": "Photograph unit nameplate and current condition", "requires_before_photo": True, "is_required": True},
                {"order": 1, "description": "Replace all filters", "requires_before_photo": True, "requires_after_photo": True, "is_required": True},
                {"order": 2, "description": "Check belt condition and tension", "requires_note": True, "is_required": True},
                {"order": 3, "description": "Lubricate bearings and moving parts", "is_required": True},
                {"order": 4, "description": "Check electrical connections and amp draw", "requires_measurement": True, "is_required": True},
                {"order": 5, "description": "Clean coils and check refrigerant charge", "requires_after_photo": True, "is_required": True},
            ]
        },
        {
            "name": "Commercial Install",
            "category": "commercial_install",
            "description": "Commercial HVAC system installation project",
            "estimated_duration_hours": 40.0,
            "requires_permit": True,
            "requires_inspection": True,
        },
    ]
    
    for type_data in default_types:
        existing = await db.job_type_templates.find_one({"name": type_data["name"]})
        if not existing:
            template = JobTypeTemplate(**type_data)
            await db.job_type_templates.insert_one(template.dict())

# ==================== JOB CHECKLISTS API (RFC-002 Section 4.2.2) ====================

@api_router.get("/jobs/{job_id}/checklist")
async def get_job_checklist(job_id: str):
    """Get checklist for a job"""
    checklist = await db.job_checklists.find_one({"job_id": job_id})
    if not checklist:
        return {"checklist": None, "message": "No checklist assigned to this job"}
    checklist.pop("_id", None)
    return checklist

@api_router.post("/jobs/{job_id}/checklist")
async def create_job_checklist(job_id: str, template_id: Optional[str] = None):
    """Create a checklist for a job from a template"""
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if checklist already exists
    existing = await db.job_checklists.find_one({"job_id": job["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Checklist already exists for this job")
    
    # Get template
    items = []
    template_name = None
    
    if template_id:
        template = await db.job_type_templates.find_one({"id": template_id})
        if template:
            template_name = template["name"]
            for item in template.get("checklist_items", []):
                checklist_item = JobChecklistItem(
                    template_item_id=item.get("id"),
                    order=item.get("order", 0),
                    description=item.get("description", ""),
                    requires_before_photo=item.get("requires_before_photo", False),
                    requires_after_photo=item.get("requires_after_photo", False),
                    requires_note=item.get("requires_note", False),
                    requires_measurement=item.get("requires_measurement", False),
                    requires_signature=item.get("requires_signature", False),
                    is_required=item.get("is_required", True),
                )
                items.append(checklist_item)
    
    checklist = JobChecklist(
        job_id=job["id"],
        template_id=template_id,
        template_name=template_name,
        items=[item.dict() for item in items],
        total_items=len(items),
    )
    
    await db.job_checklists.insert_one(checklist.dict())
    return checklist

@api_router.put("/jobs/{job_id}/checklist/items/{item_id}")
async def update_checklist_item(job_id: str, item_id: str, data: dict):
    """Update a checklist item (add evidence, mark complete, etc.)"""
    checklist = await db.job_checklists.find_one({"job_id": job_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    # Find and update the item
    items = checklist.get("items", [])
    item_index = None
    for i, item in enumerate(items):
        if item["id"] == item_id:
            item_index = i
            break
    
    if item_index is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    # Update item
    item = items[item_index]
    
    if "status" in data:
        item["status"] = data["status"]
        if data["status"] == "completed":
            item["completed_at"] = datetime.utcnow().isoformat()
            item["completed_by_id"] = data.get("completed_by_id")
            item["completed_by_name"] = data.get("completed_by_name")
    
    if "evidence" in data:
        # Add new evidence
        evidence = ChecklistItemEvidence(**data["evidence"])
        if "evidence" not in item:
            item["evidence"] = []
        item["evidence"].append(evidence.dict())
    
    if "has_exception" in data:
        item["has_exception"] = data["has_exception"]
        item["exception_reason"] = data.get("exception_reason")
        item["status"] = "exception"
    
    items[item_index] = item
    
    # Recalculate progress
    completed_count = sum(1 for i in items if i["status"] in ["completed", "exception"])
    exception_count = sum(1 for i in items if i["status"] == "exception")
    
    # Check if job can be completed (all required items done)
    blocking_items = []
    for i in items:
        if i.get("is_required") and i["status"] not in ["completed", "exception"]:
            blocking_items.append(i["id"])
    
    can_complete = len(blocking_items) == 0
    
    await db.job_checklists.update_one(
        {"job_id": job_id},
        {"$set": {
            "items": items,
            "completed_items": completed_count,
            "exception_items": exception_count,
            "percent_complete": int((completed_count / len(items)) * 100) if items else 0,
            "can_complete_job": can_complete,
            "blocking_items": blocking_items,
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated = await db.job_checklists.find_one({"job_id": job_id})
    updated.pop("_id", None)
    return updated

# ==================== VENDORS API (RFC-002 Section 4.7.2) ====================

@api_router.get("/vendors", response_model=List[Vendor])
async def get_vendors(active_only: bool = True, search: Optional[str] = None):
    """Get all vendors"""
    query = {}
    if active_only:
        query["is_active"] = True
    if search:
        safe_search = sanitize_search_query(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"vendor_number": {"$regex": safe_search, "$options": "i"}},
        ]
    
    vendors = await db.vendors.find(query).sort("name", 1).to_list(500)
    return [Vendor(**v) for v in vendors]

@api_router.get("/vendors/{vendor_id}", response_model=Vendor)
async def get_vendor(vendor_id: str):
    """Get a specific vendor"""
    vendor = await db.vendors.find_one({"$or": [{"id": vendor_id}, {"vendor_number": vendor_id}]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return Vendor(**vendor)

@api_router.post("/vendors", response_model=Vendor)
async def create_vendor(data: VendorCreate):
    """Create a new vendor"""
    vendor = Vendor(
        name=sanitize_string(data.name, 200),
        contact_name=sanitize_string(data.contact_name, 100) if data.contact_name else None,
        email=sanitize_string(data.email, 255) if data.email else None,
        phone=sanitize_string(data.phone, 20) if data.phone else None,
        address=sanitize_string(data.address, 500) if data.address else None,
        city=sanitize_string(data.city, 100) if data.city else None,
        state=sanitize_string(data.state, 50) if data.state else None,
        zip_code=sanitize_string(data.zip_code, 20) if data.zip_code else None,
        payment_terms=data.payment_terms,
        account_number=sanitize_string(data.account_number, 50) if data.account_number else None,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
    )
    await db.vendors.insert_one(vendor.dict())
    return vendor

@api_router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor(vendor_id: str, data: dict):
    """Update a vendor"""
    vendor = await db.vendors.find_one({"$or": [{"id": vendor_id}, {"vendor_number": vendor_id}]})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.vendors.update_one({"id": vendor["id"]}, {"$set": update_data})
    updated = await db.vendors.find_one({"id": vendor["id"]})
    return Vendor(**updated)

# ==================== PURCHASE ORDERS API (RFC-002 Section 4.7.2) ====================

@api_router.get("/purchase-orders", response_model=List[PurchaseOrder])
async def get_purchase_orders(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all purchase orders"""
    query = {}
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    pos = await db.purchase_orders.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [PurchaseOrder(**po) for po in pos]

@api_router.get("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def get_purchase_order(po_id: str):
    """Get a specific purchase order"""
    po = await db.purchase_orders.find_one({"$or": [{"id": po_id}, {"po_number": po_id}]})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrder(**po)

@api_router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order(data: PurchaseOrderCreate):
    """Create a new purchase order"""
    vendor = await db.vendors.find_one({"id": data.vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Build line items
    line_items = []
    subtotal = 0
    for item_data in data.line_items:
        item = await db.inventory_items.find_one({"id": item_data.get("item_id")})
        if item:
            line_item = PurchaseOrderLineItem(
                item_id=item["id"],
                item_name=item["name"],
                sku=item["sku"],
                quantity_ordered=item_data.get("quantity_ordered", 1),
                unit=item["unit"],
                unit_cost=item_data.get("unit_cost", item.get("unit_cost", 0)),
            )
            line_item.extended_cost = line_item.quantity_ordered * line_item.unit_cost
            subtotal += line_item.extended_cost
            line_items.append(line_item)
    
    # Get location name
    location_name = None
    if data.receive_to_location_id:
        location = await db.warehouses.find_one({"id": data.receive_to_location_id})
        if not location:
            truck = await db.trucks.find_one({"id": data.receive_to_location_id})
            location = truck
        location_name = location["name"] if location else None
    
    po = PurchaseOrder(
        vendor_id=data.vendor_id,
        vendor_name=vendor["name"],
        line_items=[li.dict() for li in line_items],
        subtotal=subtotal,
        total=subtotal,  # Tax and shipping can be added later
        expected_date=data.expected_date,
        receive_to_location_id=data.receive_to_location_id,
        receive_to_location_name=location_name,
        job_id=data.job_id,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
    )
    await db.purchase_orders.insert_one(po.dict())
    return po

@api_router.put("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, status: str):
    """Update purchase order status"""
    po = await db.purchase_orders.find_one({"$or": [{"id": po_id}, {"po_number": po_id}]})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    update_data = {
        "status": status,
        "status_changed_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    if status == "submitted":
        update_data["order_date"] = datetime.utcnow().strftime("%Y-%m-%d")
    elif status == "received":
        update_data["received_date"] = datetime.utcnow().strftime("%Y-%m-%d")
    
    await db.purchase_orders.update_one({"id": po["id"]}, {"$set": update_data})
    return {"message": f"PO status updated to {status}"}

# ==================== INVOICES API (RFC-002 Section 4.6.1) ====================

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    job_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all invoices"""
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if job_id:
        query["job_id"] = job_id
    
    invoices = await db.invoices.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [Invoice(**inv) for inv in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    """Get a specific invoice"""
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**invoice)

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(data: InvoiceCreate):
    """Create a new invoice"""
    # Build line items
    line_items = []
    labor_total = parts_total = trip_total = misc_total = 0
    
    for item_data in data.line_items:
        line_item = InvoiceLineItem(
            line_type=item_data.get("line_type", "parts"),
            description=sanitize_string(item_data.get("description", ""), 200),
            sku=item_data.get("sku"),
            quantity=item_data.get("quantity", 1),
            unit=item_data.get("unit", "each"),
            unit_price=item_data.get("unit_price", 0),
            cost=item_data.get("cost", 0),
        )
        line_item.extended_price = line_item.quantity * line_item.unit_price
        
        if line_item.line_type == "labor":
            labor_total += line_item.extended_price
        elif line_item.line_type == "parts":
            parts_total += line_item.extended_price
        elif line_item.line_type == "trip":
            trip_total += line_item.extended_price
        else:
            misc_total += line_item.extended_price
        
        line_items.append(line_item)
    
    subtotal = labor_total + parts_total + trip_total + misc_total
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount
    
    # Get job info
    job_number = None
    if data.job_id:
        job = await db.jobs.find_one({"id": data.job_id})
        job_number = job["job_number"] if job else None
    
    invoice = Invoice(
        job_id=data.job_id,
        job_number=job_number,
        customer_id=data.customer_id,
        customer_name=sanitize_string(data.customer_name, 200),
        customer_email=sanitize_string(data.customer_email, 255) if data.customer_email else None,
        billing_address=sanitize_string(data.billing_address, 500) if data.billing_address else None,
        line_items=[li.dict() for li in line_items],
        labor_total=labor_total,
        parts_total=parts_total,
        trip_total=trip_total,
        misc_total=misc_total,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        balance_due=total,
        due_date=data.due_date,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
    )
    await db.invoices.insert_one(invoice.dict())
    return invoice

@api_router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, status: str):
    """Update invoice status"""
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = {
        "status": status,
        "status_changed_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    if status == "paid":
        update_data["paid_date"] = datetime.utcnow().strftime("%Y-%m-%d")
        update_data["balance_due"] = 0
        update_data["amount_paid"] = invoice["total"]
    
    await db.invoices.update_one({"id": invoice["id"]}, {"$set": update_data})
    return {"message": f"Invoice status updated to {status}"}

# ==================== PAYMENTS API (RFC-002 Section 4.6.1) ====================

@api_router.get("/payments")
async def get_payments(
    invoice_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all payments"""
    query = {}
    if invoice_id:
        query["invoice_id"] = invoice_id
    if customer_id:
        query["customer_id"] = customer_id
    
    payments = await db.payments.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for p in payments:
        p.pop("_id", None)
    return payments

@api_router.post("/payments", response_model=Payment)
async def create_payment(data: PaymentCreate):
    """Record a payment"""
    invoice = await db.invoices.find_one({"id": data.invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment = Payment(
        invoice_id=data.invoice_id,
        invoice_number=invoice.get("invoice_number"),
        customer_id=invoice.get("customer_id"),
        customer_name=invoice.get("customer_name"),
        payment_method=data.payment_method,
        amount=data.amount,
        card_last_four=data.card_last_four,
        check_number=data.check_number,
        financing_provider=data.financing_provider,
        notes=sanitize_string(data.notes, 500) if data.notes else None,
    )
    await db.payments.insert_one(payment.dict())
    
    # Update invoice
    new_amount_paid = invoice.get("amount_paid", 0) + data.amount
    new_balance = invoice.get("total", 0) - new_amount_paid
    new_status = "paid" if new_balance <= 0 else "partially_paid"
    
    await db.invoices.update_one(
        {"id": data.invoice_id},
        {"$set": {
            "amount_paid": new_amount_paid,
            "balance_due": max(0, new_balance),
            "status": new_status,
            "status_changed_at": datetime.utcnow(),
            "paid_date": datetime.utcnow().strftime("%Y-%m-%d") if new_status == "paid" else invoice.get("paid_date"),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return payment

# ==================== CUSTOMER EQUIPMENT API (RFC-002 Section 4.7.4) ====================

@api_router.get("/customer-equipment")
async def get_customer_equipment(
    customer_id: Optional[str] = None,
    warranty_expiring: bool = False,
    limit: int = Query(default=100, le=500)
):
    """Get customer equipment records"""
    query = {"is_active": True}
    if customer_id:
        query["customer_id"] = customer_id
    if warranty_expiring:
        # Equipment with warranty expiring in next 30 days
        thirty_days = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        today = datetime.utcnow().strftime("%Y-%m-%d")
        query["warranty_end_date"] = {"$gte": today, "$lte": thirty_days}
    
    equipment = await db.customer_equipment.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for e in equipment:
        e.pop("_id", None)
        # Update warranty status
        if e.get("warranty_end_date"):
            today = datetime.utcnow().strftime("%Y-%m-%d")
            thirty_days = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
            e["is_in_warranty"] = e["warranty_end_date"] >= today
            e["warranty_expiring_soon"] = today <= e["warranty_end_date"] <= thirty_days
    
    return equipment

@api_router.get("/customer-equipment/{equipment_id}")
async def get_equipment(equipment_id: str):
    """Get a specific equipment record"""
    equipment = await db.customer_equipment.find_one({"id": equipment_id})
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    equipment.pop("_id", None)
    return equipment

@api_router.post("/customer-equipment")
async def create_customer_equipment(data: CustomerEquipmentCreate):
    """Create a customer equipment record"""
    # Get customer name
    customer_name = None
    customer = await db.customers.find_one({"id": data.customer_id})
    if customer:
        customer_name = customer.get("name")
    
    equipment = CustomerEquipment(
        customer_id=data.customer_id,
        customer_name=customer_name,
        site_address=sanitize_string(data.site_address, 500) if data.site_address else None,
        equipment_type=sanitize_string(data.equipment_type, 100),
        manufacturer=sanitize_string(data.manufacturer, 100) if data.manufacturer else None,
        model=sanitize_string(data.model, 100) if data.model else None,
        serial_number=sanitize_string(data.serial_number, 100) if data.serial_number else None,
        location_in_building=sanitize_string(data.location_in_building, 100) if data.location_in_building else None,
        install_date=data.install_date,
        warranty_start_date=data.warranty_start_date,
        warranty_end_date=data.warranty_end_date,
        warranty_type=data.warranty_type,
        warranty_terms=sanitize_string(data.warranty_terms, 1000) if data.warranty_terms else None,
        notes=sanitize_string(data.notes, 2000) if data.notes else None,
    )
    
    # Set warranty flags
    if equipment.warranty_end_date:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        thirty_days = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        equipment.is_in_warranty = equipment.warranty_end_date >= today
        equipment.warranty_expiring_soon = today <= equipment.warranty_end_date <= thirty_days
    
    await db.customer_equipment.insert_one(equipment.dict())
    return equipment

# ==================== IMPORT WIZARDS API ====================

@api_router.post("/import/validate")
async def validate_import(data: dict):
    """Validate import data before processing"""
    import_type = data.get("type")  # customers, leads, jobs, inventory, equipment
    records = data.get("records", [])
    
    if not import_type or not records:
        raise HTTPException(status_code=400, detail="Import type and records required")
    
    errors = []
    warnings = []
    valid_count = 0
    
    required_fields = {
        "customers": ["name"],
        "leads": ["contact_name", "source"],
        "jobs": ["customer_name", "job_type"],
        "inventory": ["name", "sku"],
        "equipment": ["customer_id", "equipment_type"],
    }
    
    fields = required_fields.get(import_type, [])
    
    for idx, record in enumerate(records):
        row_errors = []
        row_warnings = []
        
        # Check required fields
        for field in fields:
            if not record.get(field):
                row_errors.append(f"Missing required field: {field}")
        
        # Check for duplicates (basic check)
        if import_type == "customers" and record.get("email"):
            existing = await db.customers.find_one({"email": record["email"].lower()})
            if existing:
                row_warnings.append(f"Customer with email {record['email']} already exists")
        
        if import_type == "inventory" and record.get("sku"):
            existing = await db.inventory_items.find_one({"sku": record["sku"]})
            if existing:
                row_warnings.append(f"Item with SKU {record['sku']} already exists")
        
        if row_errors:
            errors.append({"row": idx + 1, "errors": row_errors})
        else:
            valid_count += 1
        
        if row_warnings:
            warnings.append({"row": idx + 1, "warnings": row_warnings})
    
    return {
        "total_records": len(records),
        "valid_records": valid_count,
        "invalid_records": len(errors),
        "errors": errors[:50],  # Limit errors shown
        "warnings": warnings[:50],
        "can_import": len(errors) == 0
    }

@api_router.post("/import/process")
async def process_import(data: dict):
    """Process and import validated data"""
    import_type = data.get("type")
    records = data.get("records", [])
    skip_duplicates = data.get("skip_duplicates", True)
    
    if not import_type or not records:
        raise HTTPException(status_code=400, detail="Import type and records required")
    
    imported = 0
    skipped = 0
    errors = []
    
    for idx, record in enumerate(records):
        try:
            if import_type == "customers":
                # Check duplicate
                if skip_duplicates and record.get("email"):
                    existing = await db.customers.find_one({"email": record["email"].lower()})
                    if existing:
                        skipped += 1
                        continue
                
                customer = {
                    "id": str(uuid.uuid4()),
                    "name": sanitize_string(record.get("name", ""), 200),
                    "email": record.get("email", "").lower() if record.get("email") else None,
                    "phone": record.get("phone"),
                    "address": record.get("address"),
                    "city": record.get("city"),
                    "state": record.get("state"),
                    "zip_code": record.get("zip_code"),
                    "created_at": datetime.utcnow(),
                }
                await db.customers.insert_one(customer)
                imported += 1
            
            elif import_type == "leads":
                lead = Lead(
                    contact_name=sanitize_string(record.get("contact_name", ""), 200),
                    contact_email=record.get("contact_email"),
                    contact_phone=record.get("contact_phone"),
                    company_name=record.get("company_name"),
                    address=record.get("address"),
                    city=record.get("city"),
                    state=record.get("state"),
                    zip_code=record.get("zip_code"),
                    source=record.get("source", "import"),
                    notes=record.get("notes"),
                    estimated_value=float(record.get("estimated_value", 0) or 0),
                )
                await db.leads.insert_one(lead.dict())
                imported += 1
            
            elif import_type == "jobs":
                job_count = await db.jobs.count_documents({})
                job = Job(
                    job_number=f"JOB-{job_count + 1001}",
                    customer_name=sanitize_string(record.get("customer_name", ""), 200),
                    customer_email=record.get("customer_email"),
                    customer_phone=record.get("customer_phone"),
                    site_address=record.get("site_address", record.get("address", "")),
                    job_type=record.get("job_type", "Service"),
                    title=record.get("title", "Imported Job"),
                    description=record.get("description"),
                    priority=record.get("priority", "normal"),
                )
                await db.jobs.insert_one(job.dict())
                imported += 1
            
            elif import_type == "inventory":
                if skip_duplicates and record.get("sku"):
                    existing = await db.inventory_items.find_one({"sku": record["sku"]})
                    if existing:
                        skipped += 1
                        continue
                
                item = InventoryItem(
                    name=sanitize_string(record.get("name", ""), 200),
                    sku=record.get("sku", str(uuid.uuid4())[:8].upper()),
                    category=record.get("category", "Parts"),
                    description=record.get("description"),
                    unit=record.get("unit", "each"),
                    unit_cost=float(record.get("unit_cost", 0) or 0),
                    unit_price=float(record.get("unit_price", 0) or 0),
                    quantity_on_hand=int(record.get("quantity_on_hand", 0) or 0),
                    min_quantity=int(record.get("min_quantity", 0) or 0),
                )
                await db.inventory_items.insert_one(item.dict())
                imported += 1
            
            elif import_type == "equipment":
                equipment = CustomerEquipment(
                    customer_id=record.get("customer_id"),
                    equipment_type=sanitize_string(record.get("equipment_type", ""), 100),
                    manufacturer=record.get("manufacturer"),
                    model=record.get("model"),
                    serial_number=record.get("serial_number"),
                    install_date=record.get("install_date"),
                    warranty_end_date=record.get("warranty_end_date"),
                    notes=record.get("notes"),
                )
                await db.customer_equipment.insert_one(equipment.dict())
                imported += 1
                
        except Exception as e:
            errors.append({"row": idx + 1, "error": str(e)})
    
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": len(errors),
        "error_details": errors[:20],
        "message": f"Successfully imported {imported} records"
    }

@api_router.get("/import/templates/{import_type}")
async def get_import_template(import_type: str):
    """Get CSV template for import type"""
    templates = {
        "customers": {
            "columns": ["name", "email", "phone", "address", "city", "state", "zip_code"],
            "sample_row": ["John Smith", "john@example.com", "555-123-4567", "123 Main St", "Austin", "TX", "78701"]
        },
        "leads": {
            "columns": ["contact_name", "contact_email", "contact_phone", "company_name", "address", "city", "state", "zip_code", "source", "notes", "estimated_value"],
            "sample_row": ["Jane Doe", "jane@company.com", "555-987-6543", "ABC Corp", "456 Oak Ave", "Houston", "TX", "77001", "website", "Interested in new AC", "5000"]
        },
        "jobs": {
            "columns": ["customer_name", "customer_email", "customer_phone", "site_address", "job_type", "title", "description", "priority"],
            "sample_row": ["John Smith", "john@example.com", "555-123-4567", "123 Main St, Austin TX", "Service", "AC Not Cooling", "System blowing warm air", "high"]
        },
        "inventory": {
            "columns": ["name", "sku", "category", "description", "unit", "unit_cost", "unit_price", "quantity_on_hand", "min_quantity"],
            "sample_row": ["Capacitor 45/5", "CAP-455", "Parts", "Run capacitor 45/5 MFD", "each", "15.00", "35.00", "10", "5"]
        },
        "equipment": {
            "columns": ["customer_id", "equipment_type", "manufacturer", "model", "serial_number", "install_date", "warranty_end_date", "notes"],
            "sample_row": ["customer-uuid-here", "AC Unit", "Carrier", "24ACC636A003", "1234567890", "2022-01-15", "2027-01-15", "Main unit"]
        }
    }
    
    if import_type not in templates:
        raise HTTPException(status_code=404, detail=f"Unknown import type: {import_type}")
    
    return templates[import_type]

# ==================== REPORTING & ANALYTICS API ====================

@api_router.get("/reports/summary")
async def get_reports_summary():
    """Get summary metrics for reporting dashboard"""
    # Job metrics
    total_jobs = await db.jobs.count_documents({})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    
    # Revenue metrics
    invoices = await db.invoices.find({"status": "paid"}).to_list(1000)
    total_revenue = sum(inv.get("total", 0) for inv in invoices)
    
    # Lead metrics
    total_leads = await db.leads.count_documents({})
    won_leads = await db.leads.count_documents({"status": "won"})
    
    # Technician metrics
    total_techs = await db.technicians.count_documents({})
    
    return {
        "jobs": {
            "total": total_jobs,
            "completed": completed_jobs,
            "completion_rate": round((completed_jobs / total_jobs * 100) if total_jobs > 0 else 0, 1)
        },
        "revenue": {
            "total": total_revenue,
            "invoice_count": len(invoices)
        },
        "leads": {
            "total": total_leads,
            "won": won_leads,
            "conversion_rate": round((won_leads / total_leads * 100) if total_leads > 0 else 0, 1)
        },
        "technicians": {
            "total": total_techs
        }
    }

@api_router.post("/reports/query")
async def query_reports(data: dict):
    """Ad-hoc report query builder - RFC-002 Section 4.8.2"""
    data_source = data.get("data_source") or data.get("entity")
    columns = data.get("columns", [])
    filters = data.get("filters", [])
    group_by = data.get("group_by")
    sort_by = data.get("sort_by")
    sort_order = data.get("sort_order", "desc")
    date_range = data.get("date_range", {})
    
    if not data_source:
        raise HTTPException(status_code=400, detail="data_source required")
    
    # Map entity to collection
    collection_map = {
        "jobs": db.jobs,
        "leads": db.leads,
        "invoices": db.invoices,
        "technicians": db.technicians,
        "customers": db.customers,
        "inventory": db.inventory_items,
        "pcbs": db.pcbs,
        "proposals": db.proposals,
    }
    
    collection = collection_map.get(data_source)
    if collection is None:
        raise HTTPException(status_code=400, detail=f"Unknown data source: {data_source}")
    
    # Build query
    query = {}
    
    # Apply filters
    for filter_item in filters:
        field = filter_item.get("field")
        operator = filter_item.get("operator", "equals")
        value = filter_item.get("value")
        
        if not field or value is None:
            continue
            
        if operator == "equals":
            query[field] = value
        elif operator == "not_equals":
            query[field] = {"$ne": value}
        elif operator == "contains":
            query[field] = {"$regex": value, "$options": "i"}
        elif operator == "greater_than":
            try:
                query[field] = {"$gt": float(value)}
            except ValueError:
                query[field] = {"$gt": value}
        elif operator == "less_than":
            try:
                query[field] = {"$lt": float(value)}
            except ValueError:
                query[field] = {"$lt": value}
    
    # Apply date range
    if date_range.get("start") or date_range.get("end"):
        date_query = {}
        if date_range.get("start"):
            date_query["$gte"] = datetime.fromisoformat(date_range["start"])
        if date_range.get("end"):
            date_query["$lte"] = datetime.fromisoformat(date_range["end"])
        if date_query:
            query["created_at"] = date_query
    
    # Build projection to include only requested columns
    projection = {"_id": 0}
    for col in columns:
        projection[col] = 1
    
    # Build sort
    sort_spec = []
    if sort_by:
        sort_direction = 1 if sort_order == "asc" else -1
        sort_spec = [(sort_by, sort_direction)]
    
    # Execute query
    cursor = collection.find(query, projection)
    if sort_spec:
        cursor = cursor.sort(sort_spec)
    
    results = await cursor.to_list(1000)
    
    # Calculate aggregations
    aggregations = {}
    if results:
        aggregations["total_count"] = len(results)
        
        # Sum numeric fields
        for col in columns:
            if col in results[0] and isinstance(results[0].get(col), (int, float)):
                total = sum(r.get(col, 0) or 0 for r in results)
                aggregations[f"{col}_total"] = total
                aggregations[f"{col}_avg"] = total / len(results) if results else 0
    
    return {
        "data_source": data_source,
        "results": results,
        "aggregations": aggregations,
        "total_count": len(results)
    }

# ==================== STRIPE PAYMENTS API ====================

from fastapi import Request

@api_router.post("/payments/checkout/create")
async def create_checkout_session(data: dict, request: Request):
    """Create Stripe checkout session for invoice payment"""
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")
    
    invoice_id = data.get("invoice_id")
    origin_url = data.get("origin_url")
    
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id required")
    if not origin_url:
        raise HTTPException(status_code=400, detail="origin_url required")
    
    # Get invoice from database
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
    
    # Get amount from server-side (never from frontend)
    amount = float(invoice.get("balance_due", invoice.get("total", 0)))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid invoice amount")
    
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        
        # Build webhook URL
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
        
        # Build success/cancel URLs from frontend origin
        success_url = f"{origin_url}/invoices?payment_success=true&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/invoices?payment_cancelled=true"
        
        # Create checkout request
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "invoice_id": invoice_id,
                "invoice_number": invoice.get("invoice_number", ""),
                "customer_email": invoice.get("customer_email", ""),
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "invoice_id": invoice_id,
            "amount": amount,
            "currency": "usd",
            "payment_status": "pending",
            "status": "initiated",
            "metadata": checkout_request.metadata,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
        }
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment service error: {str(e)}")

@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get status of a Stripe checkout session"""
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")
    
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url="")
        status_response = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction in database
        if status_response.payment_status == "paid":
            # Check if already processed
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            
            if transaction and transaction.get("payment_status") != "paid":
                # Update transaction
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "status": "completed",
                        "updated_at": datetime.now(timezone.utc),
                    }}
                )
                
                # Update invoice status
                invoice_id = transaction.get("invoice_id")
                if invoice_id:
                    invoice = await db.invoices.find_one({"id": invoice_id})
                    if invoice:
                        payment_amount = transaction.get("amount", 0)
                        new_balance = max(0, invoice.get("balance_due", 0) - payment_amount)
                        new_status = "paid" if new_balance == 0 else "partial"
                        
                        await db.invoices.update_one(
                            {"id": invoice_id},
                            {"$set": {
                                "status": new_status,
                                "balance_due": new_balance,
                                "paid_amount": invoice.get("paid_amount", 0) + payment_amount,
                                "updated_at": datetime.now(timezone.utc),
                            }}
                        )
                        
                        # Record payment
                        payment_record = {
                            "id": str(uuid.uuid4()),
                            "invoice_id": invoice_id,
                            "amount": payment_amount,
                            "payment_method": "card",
                            "payment_date": datetime.now(timezone.utc).isoformat(),
                            "reference_number": session_id,
                            "notes": "Online payment via Stripe",
                            "created_at": datetime.now(timezone.utc),
                        }
                        await db.payments.insert_one(payment_record)
        
        elif status_response.status == "expired":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "expired",
                    "status": "expired",
                    "updated_at": datetime.now(timezone.utc),
                }}
            )
        
        return {
            "status": status_response.status,
            "payment_status": status_response.payment_status,
            "amount_total": status_response.amount_total,
            "currency": status_response.currency,
            "metadata": status_response.metadata,
        }
        
    except Exception as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment service error: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Payment service not configured")
    
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "completed",
                    "updated_at": datetime.now(timezone.utc),
                }}
            )
            
            # Update invoice (same logic as status check)
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if transaction:
                invoice_id = transaction.get("invoice_id")
                if invoice_id:
                    invoice = await db.invoices.find_one({"id": invoice_id})
                    if invoice and invoice.get("status") != "paid":
                        payment_amount = transaction.get("amount", 0)
                        new_balance = max(0, invoice.get("balance_due", 0) - payment_amount)
                        new_status = "paid" if new_balance == 0 else "partial"
                        
                        await db.invoices.update_one(
                            {"id": invoice_id},
                            {"$set": {
                                "status": new_status,
                                "balance_due": new_balance,
                                "paid_amount": invoice.get("paid_amount", 0) + payment_amount,
                                "updated_at": datetime.now(timezone.utc),
                            }}
                        )
        
        return {"status": "success", "event_id": webhook_response.event_id}
        
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing error: {str(e)}")

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_database():
    """Seed database with comprehensive sample data for demo mode"""
    await db.technicians.delete_many({})
    await db.jobs.delete_many({})
    await db.tasks.delete_many({})
    await db.appointments.delete_many({})
    
    # ===== TECHNICIANS =====
    technicians_data = [
        TechnicianCreate(
            employee_number="TECH-1001",
            name="Mike Johnson",
            email="mike.johnson@example.com",
            phone="(555) 123-4567",
            role="Senior Technician",
            specialty="Residential Install",
            skills=["HVAC Installation", "Heat Pump", "AC Repair", "Ductwork", "Refrigerant Handling"],
            certifications=[
                {"name": "EPA 608 Universal", "issuer": "EPA", "expiry_date": "2027-12-31"},
                {"name": "NATE Certified", "issuer": "NATE", "expiry_date": "2026-06-30"},
            ],
            licenses=[
                {"name": "HVAC Contractor License", "license_number": "TX-HVAC-12345", "state": "TX", "expiry_date": "2026-12-31"},
            ],
            location="Dallas, TX",
            years_experience=8,
            bio="Experienced HVAC technician specializing in residential installations and repairs. Known for attention to detail and customer service.",
            availability_notes="Available Mon-Fri 7am-5pm, on-call weekends",
            emergency_contact_name="Sarah Johnson",
            emergency_contact_phone="(555) 123-9999",
        ),
        TechnicianCreate(
            employee_number="TECH-1002",
            name="Lisa Chen",
            email="lisa.chen@example.com",
            phone="(555) 234-5678",
            role="Lead Technician",
            specialty="Commercial Systems",
            skills=["Commercial HVAC", "RTU", "Chillers", "BAS", "VRF Systems", "Building Automation"],
            certifications=[
                {"name": "EPA 608 Universal", "issuer": "EPA", "expiry_date": "2027-06-30"},
                {"name": "Carrier Factory Authorized", "issuer": "Carrier", "expiry_date": "2026-12-31"},
            ],
            licenses=[
                {"name": "HVAC Contractor License", "license_number": "TX-HVAC-23456", "state": "TX", "expiry_date": "2027-06-30"},
            ],
            location="Plano, TX",
            years_experience=12,
            bio="Lead technician with extensive expertise in commercial HVAC systems. Specializes in complex troubleshooting and system optimization.",
            availability_notes="Commercial jobs only. Available for emergency calls.",
        ),
        TechnicianCreate(
            employee_number="TECH-1003",
            name="Tom Brown",
            email="tom.brown@example.com",
            phone="(555) 345-6789",
            role="Emergency Technician",
            specialty="Emergency Repair",
            skills=["Emergency Repair", "Gas Furnace", "Heat Pump", "Troubleshooting", "Electrical Diagnostics"],
            certifications=[
                {"name": "EPA 608 Universal", "issuer": "EPA", "expiry_date": "2026-12-31"},
            ],
            location="Richardson, TX",
            years_experience=5,
            bio="Skilled in emergency repairs and rapid diagnostics. Calm under pressure with excellent problem-solving abilities.",
            availability_notes="Primary on-call technician. 24/7 availability.",
        ),
        TechnicianCreate(
            employee_number="TECH-1004",
            name="Amy Davis",
            email="amy.davis@example.com",
            phone="(555) 456-7890",
            role="Maintenance Technician",
            specialty="Preventive Maintenance",
            skills=["Preventive Maintenance", "Filter Replacement", "System Inspection", "Coil Cleaning", "Agreement Visits"],
            certifications=[
                {"name": "EPA 608 Type II", "issuer": "EPA", "expiry_date": "2027-03-31"},
            ],
            location="Frisco, TX",
            years_experience=3,
            bio="Dedicated maintenance technician focused on keeping HVAC systems running efficiently. Excellent at customer communication.",
            availability_notes="Maintenance routes Mon-Thu. Fridays flexible.",
        ),
        TechnicianCreate(
            employee_number="TECH-1005",
            name="Carlos Mendez",
            email="carlos.mendez@example.com",
            phone="(555) 567-8901",
            role="Junior Technician",
            specialty="Residential Repair",
            skills=["AC Repair", "Thermostat Installation", "Basic Maintenance", "Filter Changes"],
            certifications=[
                {"name": "EPA 608 Type I", "issuer": "EPA", "expiry_date": "2027-09-30"},
            ],
            location="Allen, TX",
            years_experience=1,
            bio="Enthusiastic junior technician eager to learn and grow. Great attitude and strong work ethic.",
            availability_notes="Pairs with senior techs for complex jobs.",
        ),
        TechnicianCreate(
            employee_number="TECH-1006",
            name="Rachel Kim",
            email="rachel.kim@example.com",
            phone="(555) 678-9012",
            role="Install Crew Lead",
            specialty="Residential Install",
            skills=["System Installation", "Ductwork Design", "Load Calculations", "Crew Management"],
            certifications=[
                {"name": "EPA 608 Universal", "issuer": "EPA", "expiry_date": "2027-01-31"},
                {"name": "NATE Certified", "issuer": "NATE", "expiry_date": "2026-08-31"},
            ],
            location="McKinney, TX",
            years_experience=7,
            bio="Expert installer with strong leadership skills. Manages install crews and ensures quality workmanship.",
        ),
    ]
    
    tech_ids = []
    tech_statuses = ["available", "on_job", "en_route", "available", "on_job", "available"]
    for i, tech_data in enumerate(technicians_data):
        tech = Technician(**tech_data.dict())
        tech.rating = 4.5 + (hash(tech.name) % 5) / 10
        tech.total_jobs = 50 + (hash(tech.name) % 150)
        tech.status = tech_statuses[i % len(tech_statuses)]
        tech.status_label = tech.status.replace("_", " ").title()
        await db.technicians.insert_one(tech.dict())
        tech_ids.append(tech.id)
    
    # ===== JOBS =====
    jobs_data = [
        # Service Jobs
        JobCreate(
            customer_name="Sarah Mitchell",
            customer_phone="(555) 111-2222",
            customer_email="sarah.mitchell@email.com",
            site_address="1423 Oak Ave",
            site_city="Dallas",
            site_state="TX",
            site_zip="75201",
            job_type="Residential Repair",
            title="A/C Not Cooling - Compressor Check",
            description="Customer reports A/C not cooling properly. Unit is 8 years old. Need to check compressor and refrigerant levels.",
            priority="normal",
            scheduled_date="2026-03-02",
        ),
        JobCreate(
            customer_name="Acme Corp",
            customer_phone="(555) 222-3333",
            customer_email="facilities@acmecorp.com",
            site_address="500 Commerce St",
            site_city="Dallas",
            site_state="TX",
            site_zip="75202",
            job_type="Commercial Repair",
            title="RTU #3 Economizer Repair",
            description="Economizer actuator needs replacement on RTU #3. Building management system showing fault codes.",
            priority="high",
            scheduled_date="2026-03-02",
        ),
        JobCreate(
            customer_name="James Rivera",
            customer_phone="(555) 333-4444",
            customer_email="james.rivera@email.com",
            site_address="812 Elm St",
            site_city="Plano",
            site_state="TX",
            site_zip="75023",
            job_type="Emergency Repair",
            title="No Heat Emergency - Gas Furnace",
            description="Customer has no heat. Gas furnace not igniting. Has elderly parent at home. URGENT.",
            priority="urgent",
            scheduled_date="2026-03-02",
        ),
        # Install Jobs
        JobCreate(
            customer_name="Metro Office Park",
            customer_phone="(555) 444-5555",
            customer_email="property@metrooffice.com",
            site_address="2100 N Central Expy",
            site_city="Richardson",
            site_state="TX",
            site_zip="75080",
            job_type="Commercial Install",
            title="New RTU Installation - Building A",
            description="Install new 10-ton RTU on Building A rooftop. Includes crane rental and weekend work.",
            priority="normal",
            scheduled_date="2026-03-05",
            estimated_hours=24,
        ),
        JobCreate(
            customer_name="Thompson Family",
            customer_phone="(555) 555-6666",
            customer_email="mark.thompson@email.com",
            site_address="4521 Maple Dr",
            site_city="Frisco",
            site_state="TX",
            site_zip="75034",
            job_type="Residential Install",
            title="Complete System Replacement",
            description="Replace 15-year-old system with new 4-ton Carrier Infinity. Includes ductwork modifications.",
            priority="normal",
            scheduled_date="2026-03-04",
            estimated_hours=8,
        ),
        # Maintenance Jobs
        JobCreate(
            customer_name="Green Valley HOA",
            customer_phone="(555) 666-7777",
            customer_email="manager@greenvalleyhoa.com",
            site_address="100 Clubhouse Way",
            site_city="Allen",
            site_state="TX",
            site_zip="75013",
            job_type="Maintenance",
            title="Quarterly Maintenance - Clubhouse",
            description="Quarterly preventive maintenance for clubhouse HVAC systems. 3 units total.",
            priority="normal",
            scheduled_date="2026-03-03",
        ),
        JobCreate(
            customer_name="Dr. Patricia Wong",
            customer_phone="(555) 777-8888",
            customer_email="pwong@dentalcare.com",
            site_address="789 Medical Plaza",
            site_city="Plano",
            site_state="TX",
            site_zip="75024",
            job_type="Commercial Repair",
            title="AC Making Noise - Dental Office",
            description="Front office AC unit making grinding noise. Affecting patient experience.",
            priority="high",
            scheduled_date="2026-03-02",
        ),
        # Additional variety
        JobCreate(
            customer_name="Sunrise Assisted Living",
            customer_phone="(555) 888-9999",
            customer_email="maintenance@sunriseal.com",
            site_address="1200 Senior Way",
            site_city="McKinney",
            site_state="TX",
            site_zip="75070",
            job_type="Emergency Repair",
            title="No Cooling - Memory Care Wing",
            description="HVAC system down in memory care wing. Temperatures rising. Critical for resident health.",
            priority="urgent",
            scheduled_date="2026-03-02",
        ),
    ]
    
    job_ids = []
    job_statuses = ["open", "in_progress", "in_progress", "open", "pending", "open", "in_progress", "urgent"]
    for i, job_data in enumerate(jobs_data):
        job = Job(
            job_number=f"JOB-{1001 + i}",
            status=job_statuses[i % len(job_statuses)],
            **job_data.dict()
        )
        await db.jobs.insert_one(job.dict())
        job_ids.append(job.id)
    
    # ===== TASKS =====
    tasks_data = [
        # Job 1 - A/C Not Cooling
        TaskCreate(job_id=job_ids[0], title="Initial customer call", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[0], scheduled_date="2026-02-28", notes="Customer called reporting AC issues. System is 8 years old."),
        TaskCreate(job_id=job_ids[0], title="Diagnostic visit", task_type="tech_call", status="out_for_service", assigned_technician_id=tech_ids[0], scheduled_date="2026-03-02", estimated_duration="2 hours"),
        TaskCreate(job_id=job_ids[0], title="Present repair options", task_type="sales_call", status="sales_call_scheduled", scheduled_date="2026-03-03"),
        
        # Job 2 - RTU Economizer
        TaskCreate(job_id=job_ids[1], title="Site assessment", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[1], scheduled_date="2026-02-27"),
        TaskCreate(job_id=job_ids[1], title="Parts ordering", task_type="other", status="dispatched", notes="Ordered Belimo actuator from Ferguson"),
        TaskCreate(job_id=job_ids[1], title="Repair completion", task_type="service", status="lead", assigned_technician_id=tech_ids[1], scheduled_date="2026-03-02", estimated_duration="3 hours"),
        
        # Job 3 - Emergency No Heat
        TaskCreate(job_id=job_ids[2], title="Emergency dispatch", task_type="service", status="out_for_service", assigned_technician_id=tech_ids[2], priority="urgent", scheduled_date="2026-03-02", estimated_duration="2 hours", notes="Elderly resident - prioritize"),
        TaskCreate(job_id=job_ids[2], title="Quote for replacement", task_type="sales_call", status="lead", scheduled_date="2026-03-03"),
        
        # Job 4 - RTU Installation
        TaskCreate(job_id=job_ids[3], title="Site survey completed", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[5]),
        TaskCreate(job_id=job_ids[3], title="Equipment ordered", task_type="other", status="completed", notes="10-ton RTU ordered from supplier"),
        TaskCreate(job_id=job_ids[3], title="Crane scheduled", task_type="other", status="dispatched", notes="ABC Crane confirmed for 3/5"),
        TaskCreate(job_id=job_ids[3], title="Day 1: Old unit removal", task_type="service", status="lead", assigned_technician_id=tech_ids[5], scheduled_date="2026-03-05"),
        TaskCreate(job_id=job_ids[3], title="Day 2: New unit install", task_type="service", status="lead", assigned_technician_id=tech_ids[5], scheduled_date="2026-03-06"),
        TaskCreate(job_id=job_ids[3], title="Startup & commissioning", task_type="service", status="lead", assigned_technician_id=tech_ids[1], scheduled_date="2026-03-06"),
        
        # Job 5 - Residential Install
        TaskCreate(job_id=job_ids[4], title="Load calculation", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[5]),
        TaskCreate(job_id=job_ids[4], title="Equipment selection approved", task_type="sales_call", status="completed"),
        TaskCreate(job_id=job_ids[4], title="Installation day", task_type="service", status="dispatched", assigned_technician_id=tech_ids[5], scheduled_date="2026-03-04", estimated_duration="8 hours"),
        
        # Job 6 - Maintenance
        TaskCreate(job_id=job_ids[5], title="Filter changes - all units", task_type="service", status="lead", assigned_technician_id=tech_ids[3], scheduled_date="2026-03-03"),
        TaskCreate(job_id=job_ids[5], title="Coil cleaning", task_type="service", status="lead", assigned_technician_id=tech_ids[3], scheduled_date="2026-03-03"),
        TaskCreate(job_id=job_ids[5], title="Inspection report", task_type="other", status="lead", scheduled_date="2026-03-03"),
        
        # Job 7 - Dental Office
        TaskCreate(job_id=job_ids[6], title="Diagnose noise issue", task_type="tech_call", status="out_for_service", assigned_technician_id=tech_ids[0], scheduled_date="2026-03-02", notes="Grinding noise from front unit"),
        
        # Job 8 - Memory Care Emergency
        TaskCreate(job_id=job_ids[7], title="Emergency response", task_type="service", status="out_for_service", assigned_technician_id=tech_ids[2], priority="urgent", scheduled_date="2026-03-02", notes="CRITICAL - vulnerable population"),
    ]
    
    for i, task_data in enumerate(tasks_data):
        job = await db.jobs.find_one({"id": task_data.job_id})
        tech_name = None
        if task_data.assigned_technician_id:
            tech = await db.technicians.find_one({"id": task_data.assigned_technician_id})
            if tech:
                tech_name = tech["name"]
        
        task = Task(
            task_number=f"TASK-{1001 + i}",
            assigned_technician_name=tech_name,
            order=i % 4,
            **task_data.dict()
        )
        await db.tasks.insert_one(task.dict())
    
    # ===== APPOINTMENTS =====
    # Create sample appointments with confirmation tokens
    appointments_data = [
        AppointmentCreate(
            job_id=job_ids[0],
            technician_id=tech_ids[0],
            customer_name="Sarah Mitchell",
            customer_phone="(555) 111-2222",
            customer_email="sarah.mitchell@email.com",
            site_address="1423 Oak Ave, Dallas, TX 75201",
            scheduled_date="2026-03-02",
            scheduled_time="10:00 AM",
            estimated_duration="2 hours",
            job_type="Residential Repair",
            notes="A/C diagnostic visit. Please ensure access to outdoor unit.",
        ),
        AppointmentCreate(
            job_id=job_ids[4],
            technician_id=tech_ids[5],
            customer_name="Thompson Family",
            customer_phone="(555) 555-6666",
            customer_email="mark.thompson@email.com",
            site_address="4521 Maple Dr, Frisco, TX 75034",
            scheduled_date="2026-03-04",
            scheduled_time="8:00 AM",
            estimated_duration="8 hours",
            job_type="Residential Install",
            notes="Full system replacement. Crew will arrive at 8 AM. Please have garage cleared for equipment staging.",
        ),
    ]
    
    appointment_tokens = []
    for appt_data in appointments_data:
        appointment = Appointment(**appt_data.dict())
        await db.appointments.insert_one(appointment.dict())
        appointment_tokens.append(appointment.confirmation_token)
    
    await ensure_default_board_config()
    
    # ===== TRUCKS & INVENTORY =====
    await db.trucks.delete_many({})
    await db.truck_inventories.delete_many({})
    await db.inventory_items.delete_many({})
    
    # Ensure standard categories exist
    await ensure_standard_categories()
    categories = await db.inventory_categories.find().to_list(100)
    cat_map = {c["name"]: c["id"] for c in categories}
    
    # Create inventory items
    inventory_items_data = [
        # Filters
        {"sku": "FLT-20x25x1", "name": "Filter 20x25x1", "category": "Filters", "unit_cost": 5.50, "retail_price": 15.00, "min_threshold": 10},
        {"sku": "FLT-16x25x1", "name": "Filter 16x25x1", "category": "Filters", "unit_cost": 4.50, "retail_price": 12.00, "min_threshold": 10},
        {"sku": "FLT-20x20x1", "name": "Filter 20x20x1", "category": "Filters", "unit_cost": 4.00, "retail_price": 10.00, "min_threshold": 10},
        # Refrigerant
        {"sku": "REF-410A-25", "name": "R-410A Refrigerant 25lb", "category": "Refrigerant", "unit_cost": 125.00, "retail_price": 200.00, "min_threshold": 2},
        {"sku": "REF-22-30", "name": "R-22 Refrigerant 30lb", "category": "Refrigerant", "unit_cost": 450.00, "retail_price": 600.00, "min_threshold": 1},
        # Capacitors
        {"sku": "CAP-35-5", "name": "Dual Run Capacitor 35/5 MFD", "category": "Capacitors", "unit_cost": 12.00, "retail_price": 45.00, "min_threshold": 5},
        {"sku": "CAP-45-5", "name": "Dual Run Capacitor 45/5 MFD", "category": "Capacitors", "unit_cost": 14.00, "retail_price": 50.00, "min_threshold": 5},
        {"sku": "CAP-55-5", "name": "Dual Run Capacitor 55/5 MFD", "category": "Capacitors", "unit_cost": 16.00, "retail_price": 55.00, "min_threshold": 3},
        # Electrical
        {"sku": "CTR-1P-30A", "name": "Contactor 1-Pole 30A", "category": "Electrical", "unit_cost": 18.00, "retail_price": 65.00, "min_threshold": 3},
        {"sku": "CTR-2P-40A", "name": "Contactor 2-Pole 40A", "category": "Electrical", "unit_cost": 25.00, "retail_price": 85.00, "min_threshold": 2},
        # Copper & Fittings
        {"sku": "CU-38-50", "name": "Copper Tubing 3/8\" x 50ft", "category": "Copper & Fittings", "unit_cost": 85.00, "retail_price": 140.00, "min_threshold": 2},
        {"sku": "FIT-38-UNION", "name": "3/8\" Union Fitting", "category": "Copper & Fittings", "unit_cost": 8.00, "retail_price": 25.00, "min_threshold": 10},
        # Thermostats
        {"sku": "TSTAT-ECOBEE", "name": "Ecobee Smart Thermostat", "category": "Thermostats", "unit_cost": 180.00, "retail_price": 280.00, "min_threshold": 2},
        {"sku": "TSTAT-HONEY-T6", "name": "Honeywell T6 Pro", "category": "Thermostats", "unit_cost": 95.00, "retail_price": 160.00, "min_threshold": 3},
    ]
    
    created_items = []
    for item_data in inventory_items_data:
        cat_id = cat_map.get(item_data["category"], "")
        item = InventoryItem(
            sku=item_data["sku"],
            name=item_data["name"],
            category_id=cat_id,
            category_name=item_data["category"],
            unit="each",
            unit_cost=item_data["unit_cost"],
            retail_price=item_data["retail_price"],
            min_stock_threshold=item_data["min_threshold"]
        )
        await db.inventory_items.insert_one(item.dict())
        created_items.append(item)
    
    # Create trucks and assign to technicians
    trucks_data = [
        {"truck_number": "T-101", "name": "Service Van 1", "make": "Ford", "model": "Transit 250", "year": 2023, "tech_idx": 0},
        {"truck_number": "T-102", "name": "Service Van 2", "make": "Chevrolet", "model": "Express 2500", "year": 2022, "tech_idx": 1},
        {"truck_number": "T-103", "name": "Install Truck 1", "make": "Ford", "model": "F-250", "year": 2023, "tech_idx": 2},
        {"truck_number": "T-104", "name": "Maintenance Van", "make": "RAM", "model": "ProMaster 1500", "year": 2024, "tech_idx": 3},
    ]
    
    for truck_data in trucks_data:
        tech_id = tech_ids[truck_data["tech_idx"]] if truck_data["tech_idx"] < len(tech_ids) else None
        tech_name = None
        if tech_id:
            tech = await db.technicians.find_one({"id": tech_id})
            tech_name = tech["name"] if tech else None
        
        truck = Truck(
            truck_number=truck_data["truck_number"],
            name=truck_data["name"],
            make=truck_data["make"],
            model=truck_data["model"],
            year=truck_data["year"],
            assigned_technician_id=tech_id,
            assigned_technician_name=tech_name
        )
        await db.trucks.insert_one(truck.dict())
        
        # Create truck inventory with random stock levels
        import random
        truck_items = []
        for item in created_items:
            qty = random.randint(item.min_stock_threshold - 2, item.min_stock_threshold + 5)
            qty = max(0, qty)  # Ensure non-negative
            truck_items.append({
                "item_id": item.id,
                "item_name": item.name,
                "sku": item.sku,
                "category_id": item.category_id,
                "category_name": item.category_name,
                "quantity": qty,
                "min_threshold": item.min_stock_threshold,
                "unit": item.unit,
                "needs_restock": qty < item.min_stock_threshold
            })
        
        truck_inv = TruckInventory(
            truck_id=truck.id,
            truck_name=truck.name,
            technician_id=tech_id,
            technician_name=tech_name,
            items=truck_items,
            stock_check_required=True
        )
        await db.truck_inventories.insert_one(truck_inv.dict())
    
    return {
        "message": "Demo database seeded successfully",
        "technicians": len(technicians_data),
        "jobs": len(jobs_data),
        "tasks": len(tasks_data),
        "appointments": len(appointments_data),
        "trucks": len(trucks_data),
        "inventory_items": len(created_items),
        "sample_appointment_token": appointment_tokens[0] if appointment_tokens else None,
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize default data on startup"""
    await ensure_default_board_config()
    await ensure_default_roles()
    await ensure_default_job_types()
    await ensure_default_milestone_templates()
    await get_system_settings()  # Create default settings if not exists
    logger.info("Application started, default configurations ensured")

async def ensure_default_milestone_templates():
    """Ensure default milestone templates exist"""
    count = await db.milestone_templates.count_documents({})
    if count > 0:
        return
    
    # Create default templates
    default_templates = [
        {
            "id": str(uuid.uuid4()),
            "name": "Standard Install (30/40/30)",
            "description": "Standard 3-milestone structure: 30% deposit, 40% at rough-in, 30% on completion",
            "milestones": [
                {"id": str(uuid.uuid4()), "name": "Deposit", "percentage": 30, "description": "Due upon contract signing", "trigger": "project_start"},
                {"id": str(uuid.uuid4()), "name": "Rough-In Complete", "percentage": 40, "description": "Due when rough-in work is complete", "trigger": "manual"},
                {"id": str(uuid.uuid4()), "name": "Final Payment", "percentage": 30, "description": "Due upon project completion", "trigger": "project_complete"},
            ],
            "is_default": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Equipment Only (50/50)",
            "description": "2-milestone structure: 50% deposit, 50% on delivery/install",
            "milestones": [
                {"id": str(uuid.uuid4()), "name": "Deposit", "percentage": 50, "description": "Due upon order placement", "trigger": "project_start"},
                {"id": str(uuid.uuid4()), "name": "Balance", "percentage": 50, "description": "Due on delivery/installation", "trigger": "project_complete"},
            ],
            "is_default": False,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Large Project (20/30/30/20)",
            "description": "4-milestone structure for larger projects",
            "milestones": [
                {"id": str(uuid.uuid4()), "name": "Deposit", "percentage": 20, "description": "Due upon contract signing", "trigger": "project_start"},
                {"id": str(uuid.uuid4()), "name": "Materials Ordered", "percentage": 30, "description": "Due when materials are ordered", "trigger": "manual"},
                {"id": str(uuid.uuid4()), "name": "Rough-In Complete", "percentage": 30, "description": "Due when rough-in is complete", "trigger": "manual"},
                {"id": str(uuid.uuid4()), "name": "Final Payment", "percentage": 20, "description": "Due on final inspection", "trigger": "project_complete"},
            ],
            "is_default": False,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Full Payment on Completion",
            "description": "Single payment due on project completion",
            "milestones": [
                {"id": str(uuid.uuid4()), "name": "Full Payment", "percentage": 100, "description": "Due upon project completion", "trigger": "project_complete"},
            ],
            "is_default": False,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        },
    ]
    
    await db.milestone_templates.insert_many(default_templates)
    logger.info(f"Created {len(default_templates)} default milestone templates")

# ==================== PUSH NOTIFICATIONS API ====================

# Generate VAPID keys if not present
import base64
import os

def get_or_create_vapid_keys():
    """Get or create VAPID keys for push notifications"""
    # Check if keys exist in settings
    # For now, use environment variables or generate
    public_key = os.environ.get("VAPID_PUBLIC_KEY")
    private_key = os.environ.get("VAPID_PRIVATE_KEY")
    
    if not public_key or not private_key:
        # Generate new keys (in production, these should be stored securely)
        try:
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            
            private_key_obj = ec.generate_private_key(ec.SECP256R1(), default_backend())
            public_key_obj = private_key_obj.public_key()
            
            # Export keys in appropriate format
            private_bytes = private_key_obj.private_numbers().private_value.to_bytes(32, 'big')
            public_bytes = public_key_obj.public_bytes(
                serialization.Encoding.X962,
                serialization.PublicFormat.UncompressedPoint
            )
            
            private_key = base64.urlsafe_b64encode(private_bytes).decode('utf-8').rstrip('=')
            public_key = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
        except ImportError:
            # Fallback: use placeholder keys (won't work for actual push)
            public_key = "BEp_5DcTDxEKvbmr8zBGqq7YH5H3xAyYxqXvDRBQf9lJLzqsT8mvYKqkfKNRq4xBqS5z8WfvB_uY3lJdPKjKjKk"
            private_key = "placeholder_private_key"
    
    return public_key, private_key

@api_router.get("/push/vapid-key")
async def get_vapid_public_key(user: dict = Depends(require_auth)):
    """Get VAPID public key for push subscription"""
    settings = await get_system_settings()
    if not settings.push_notifications_enabled:
        raise HTTPException(status_code=400, detail="Push notifications are disabled")
    
    public_key, _ = get_or_create_vapid_keys()
    return {"publicKey": public_key}

@api_router.post("/push/subscribe")
async def subscribe_to_push(data: dict, request: Request, user: dict = Depends(require_auth)):
    """Subscribe a device to push notifications"""
    settings = await get_system_settings()
    if not settings.push_notifications_enabled:
        raise HTTPException(status_code=400, detail="Push notifications are disabled")
    
    subscription_data = data.get("subscription", {})
    
    # Check if subscription already exists
    existing = await db.push_subscriptions.find_one({
        "endpoint": subscription_data.get("endpoint")
    })
    
    if existing:
        # Update existing subscription
        await db.push_subscriptions.update_one(
            {"id": existing["id"]},
            {"$set": {
                "user_id": user["id"],
                "is_active": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Subscription updated", "id": existing["id"]}
    
    # Create new subscription
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "endpoint": subscription_data.get("endpoint"),
        "keys": subscription_data.get("keys", {}),
        "device_type": "web",
        "user_agent": request.headers.get("user-agent"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.push_subscriptions.insert_one(subscription)
    return {"message": "Subscribed successfully", "id": subscription["id"]}

@api_router.post("/push/unsubscribe")
async def unsubscribe_from_push(data: dict, user: dict = Depends(require_auth)):
    """Unsubscribe a device from push notifications"""
    endpoint = data.get("endpoint")
    
    if endpoint:
        await db.push_subscriptions.update_one(
            {"endpoint": endpoint, "user_id": user["id"]},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
        )
    
    return {"message": "Unsubscribed successfully"}

@api_router.get("/push/subscriptions")
async def get_my_subscriptions(user: dict = Depends(require_auth)):
    """Get user's push subscriptions"""
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0, "keys": 0}  # Don't expose keys
    ).to_list(10)
    return subscriptions

async def send_push_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict = None
):
    """Send push notification to a user's subscribed devices"""
    settings = await get_system_settings()
    if not settings.push_notifications_enabled:
        return
    
    # Check notification type settings
    if notification_type == "chat" and not settings.notify_on_chat_message:
        return
    if notification_type == "job_assignment" and not settings.notify_on_job_assignment:
        return
    if notification_type == "schedule_change" and not settings.notify_on_schedule_change:
        return
    if notification_type == "payment" and not settings.notify_on_payment_received:
        return
    
    # Get user's active subscriptions
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id, "is_active": True}
    ).to_list(10)
    
    if not subscriptions:
        return
    
    _, private_key = get_or_create_vapid_keys()
    
    for sub in subscriptions:
        try:
            # In production, use pywebpush library
            # For now, log the notification
            logger.info(f"Push notification to {user_id}: {title} - {body}")
            
            # Log the notification
            log_entry = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "subscription_id": sub["id"],
                "notification_type": notification_type,
                "title": title,
                "body": body,
                "data": data,
                "status": "sent",
                "sent_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc)
            }
            await db.notification_logs.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"Failed to send push to {sub['id']}: {e}")
            await db.push_subscriptions.update_one(
                {"id": sub["id"]},
                {"$inc": {"error_count": 1}}
            )

# ==================== AI FAILOVER SYSTEM ====================

async def get_ai_response_with_failover(prompt: str, session_id: str = "default") -> dict:
    """Get AI response with provider failover support"""
    settings = await get_system_settings()
    
    if not settings.ai_features_enabled:
        raise ValueError("AI features are disabled")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not configured")
    
    # Get AI config
    ai_config = await db.ai_provider_config.find_one({})
    if not ai_config:
        ai_config = {
            "primary_provider": settings.ai_provider,
            "primary_model": settings.ai_model,
            "failover_providers": [
                {"provider": "openai", "model": "gpt-4o-mini"},
                {"provider": "claude", "model": "claude-3-haiku-20240307"}
            ],
            "failover_enabled": settings.ai_failover_enabled,
            "fallback_to_simple": True
        }
    
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Build provider chain
    providers = [{"provider": ai_config["primary_provider"], "model": ai_config["primary_model"]}]
    if ai_config.get("failover_enabled", True):
        providers.extend(ai_config.get("failover_providers", []))
    
    last_error = None
    used_provider = None
    
    for provider_config in providers:
        try:
            client = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message="You are a helpful HVAC service assistant for BreezeFlow, an HVAC business operations platform."
            )
            
            client = client.with_model(
                provider=provider_config["provider"],
                model=provider_config["model"]
            )
            
            user_msg = UserMessage(text=prompt)
            response = await client.send_message(user_msg)
            
            used_provider = provider_config
            
            # Track success
            await db.ai_provider_config.update_one(
                {},
                {"$inc": {"total_requests": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                upsert=True
            )
            
            return {
                "response": response,
                "provider": provider_config["provider"],
                "model": provider_config["model"],
                "failover_used": provider_config != providers[0]
            }
            
        except Exception as e:
            last_error = e
            logger.warning(f"AI provider {provider_config['provider']} failed: {e}")
            
            # Track failure
            await db.ai_provider_config.update_one(
                {},
                {
                    "$inc": {"failed_requests": 1, "failover_count": 1},
                    "$set": {"last_failure_at": datetime.now(timezone.utc)}
                },
                upsert=True
            )
            continue
    
    # All providers failed - use simple fallback if enabled
    if ai_config.get("fallback_to_simple", True):
        return {
            "response": generate_simple_summary(prompt),
            "provider": "fallback",
            "model": "simple",
            "failover_used": True,
            "all_providers_failed": True
        }
    
    raise ValueError(f"All AI providers failed. Last error: {last_error}")

def generate_simple_summary(prompt: str) -> str:
    """Generate a simple summary without AI when all providers fail"""
    # Extract key information from prompt
    lines = prompt.split('\n')
    summary_parts = []
    
    for line in lines:
        line = line.strip()
        if line.startswith('-') or line.startswith('•'):
            summary_parts.append(line)
        elif ':' in line and len(line) < 100:
            summary_parts.append(line)
    
    if summary_parts:
        return "Summary (AI unavailable):\n" + "\n".join(summary_parts[:10])
    
    return "Unable to generate AI summary. Please review the details manually."

@api_router.get("/ai/config")
async def get_ai_config(user: dict = Depends(require_auth)):
    """Get AI provider configuration (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.ai_provider_config.find_one({}, {"_id": 0})
    if not config:
        config = {
            "primary_provider": "gemini",
            "primary_model": "gemini-2.0-flash",
            "failover_providers": [
                {"provider": "openai", "model": "gpt-4o-mini"},
                {"provider": "claude", "model": "claude-3-haiku-20240307"}
            ],
            "failover_enabled": True,
            "fallback_to_simple": True,
            "total_requests": 0,
            "failed_requests": 0,
            "failover_count": 0
        }
    return config

@api_router.put("/ai/config")
async def update_ai_config(data: dict, user: dict = Depends(require_auth)):
    """Update AI provider configuration (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    allowed_fields = [
        "primary_provider", "primary_model", "failover_providers",
        "failover_enabled", "fallback_to_simple", "max_retries"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by_id"] = user["id"]
    
    # Also update system settings
    settings_update = {}
    if "primary_provider" in update_data:
        settings_update["ai_provider"] = update_data["primary_provider"]
    if "primary_model" in update_data:
        settings_update["ai_model"] = update_data["primary_model"]
    if "failover_enabled" in update_data:
        settings_update["ai_failover_enabled"] = update_data["failover_enabled"]
    
    if settings_update:
        await db.system_settings.update_one({}, {"$set": settings_update})
    
    await db.ai_provider_config.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "AI configuration updated"}

# ==================== QUICKBOOKS INTEGRATION (SCAFFOLDING) ====================

@api_router.get("/integrations/quickbooks/status")
async def get_quickbooks_status(user: dict = Depends(require_auth)):
    """Get QuickBooks integration status"""
    settings = await get_system_settings()
    
    config = await db.quickbooks_config.find_one({}, {"_id": 0, "access_token": 0, "refresh_token": 0})
    
    return {
        "enabled": settings.quickbooks_enabled,
        "configured": settings.quickbooks_configured,
        "connected": config.get("is_connected", False) if config else False,
        "last_sync": settings.quickbooks_last_sync,
        "sync_settings": {
            "invoices": settings.quickbooks_sync_invoices,
            "payments": settings.quickbooks_sync_payments,
            "customers": settings.quickbooks_sync_customers
        }
    }

@api_router.put("/integrations/quickbooks/settings")
async def update_quickbooks_settings(data: dict, user: dict = Depends(require_auth)):
    """Update QuickBooks integration settings (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    allowed_fields = [
        "quickbooks_enabled", "quickbooks_sync_invoices",
        "quickbooks_sync_payments", "quickbooks_sync_customers"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.system_settings.update_one({}, {"$set": update_data})
    
    return {"message": "QuickBooks settings updated"}

@api_router.get("/integrations/quickbooks/auth-url")
async def get_quickbooks_auth_url(user: dict = Depends(require_auth)):
    """Get QuickBooks OAuth authorization URL"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await get_system_settings()
    if not settings.quickbooks_enabled:
        raise HTTPException(status_code=400, detail="QuickBooks integration is disabled. Enable it in settings first.")
    
    # Check if QuickBooks credentials are configured
    client_id = os.environ.get("QUICKBOOKS_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=400,
            detail="QuickBooks Client ID not configured. Add QUICKBOOKS_CLIENT_ID to environment variables."
        )
    
    # Build OAuth URL (QuickBooks Online)
    redirect_uri = os.environ.get("QUICKBOOKS_REDIRECT_URI", f"{os.environ.get('REACT_APP_BACKEND_URL', '')}/api/integrations/quickbooks/callback")
    scope = "com.intuit.quickbooks.accounting"
    
    auth_url = (
        f"https://appcenter.intuit.com/connect/oauth2"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&redirect_uri={redirect_uri}"
        f"&state={str(uuid.uuid4())}"
    )
    
    return {"auth_url": auth_url}

@api_router.get("/integrations/quickbooks/callback")
async def quickbooks_oauth_callback(code: str = None, state: str = None, realmId: str = None):
    """Handle QuickBooks OAuth callback"""
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code missing")
    
    client_id = os.environ.get("QUICKBOOKS_CLIENT_ID")
    client_secret = os.environ.get("QUICKBOOKS_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="QuickBooks credentials not configured")
    
    # Exchange code for tokens
    try:
        import httpx
        
        redirect_uri = os.environ.get("QUICKBOOKS_REDIRECT_URI", "")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri
                },
                auth=(client_id, client_secret),
                headers={"Accept": "application/json"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
            
            tokens = response.json()
            
            # Store tokens securely
            config = {
                "id": str(uuid.uuid4()),
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "realm_id": realmId,
                "token_expires_at": datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600)),
                "is_connected": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            await db.quickbooks_config.update_one(
                {},
                {"$set": config},
                upsert=True
            )
            
            # Update system settings
            await db.system_settings.update_one(
                {},
                {"$set": {"quickbooks_configured": True}}
            )
            
            # Redirect to settings page
            frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "").replace("/api", "")
            return {"message": "QuickBooks connected successfully", "redirect": f"{frontend_url}/settings?tab=integrations"}
            
    except Exception as e:
        logger.error(f"QuickBooks OAuth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/integrations/quickbooks/disconnect")
async def disconnect_quickbooks(user: dict = Depends(require_auth)):
    """Disconnect QuickBooks integration"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.quickbooks_config.update_one(
        {},
        {"$set": {
            "is_connected": False,
            "access_token": None,
            "refresh_token": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    await db.system_settings.update_one(
        {},
        {"$set": {"quickbooks_configured": False}}
    )
    
    return {"message": "QuickBooks disconnected"}

@api_router.post("/integrations/quickbooks/sync")
async def trigger_quickbooks_sync(data: dict, user: dict = Depends(require_auth)):
    """Trigger a QuickBooks sync operation"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await get_system_settings()
    if not settings.quickbooks_enabled:
        raise HTTPException(status_code=400, detail="QuickBooks integration is disabled")
    
    config = await db.quickbooks_config.find_one({})
    if not config or not config.get("is_connected"):
        raise HTTPException(status_code=400, detail="QuickBooks is not connected")
    
    sync_type = data.get("sync_type", "full")  # "full", "invoices", "payments", "customers"
    
    # Create sync log
    sync_log = {
        "id": str(uuid.uuid4()),
        "sync_type": sync_type,
        "direction": "bidirectional",
        "status": "started",
        "items_synced": 0,
        "items_failed": 0,
        "errors": [],
        "started_at": datetime.now(timezone.utc)
    }
    await db.quickbooks_sync_logs.insert_one(sync_log)
    
    # TODO: Implement actual sync logic when QuickBooks is connected
    # For now, return the sync log ID for tracking
    
    return {
        "message": "Sync started",
        "sync_id": sync_log["id"],
        "note": "QuickBooks sync requires valid OAuth connection. Configure credentials in environment variables."
    }

@api_router.get("/integrations/quickbooks/sync-logs")
async def get_quickbooks_sync_logs(user: dict = Depends(require_auth), limit: int = 10):
    """Get QuickBooks sync history"""
    logs = await db.quickbooks_sync_logs.find(
        {},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return logs

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
