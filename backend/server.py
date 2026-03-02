from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
import math
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

from models import (
    User, UserCreate, UserResponse,
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
    
    return {
        "message": "Demo database seeded successfully",
        "technicians": len(technicians_data),
        "jobs": len(jobs_data),
        "tasks": len(tasks_data),
        "appointments": len(appointments_data),
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
    logger.info("Application started, default board config ensured")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
