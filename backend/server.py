from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime

from models import (
    User, UserCreate, UserResponse,
    Technician, TechnicianCreate, TechnicianUpdate, TechnicianPublicProfile,
    Certification, License, WorkHistoryEntry,
    BoardConfig, BoardConfigCreate, BoardConfigUpdate, StatusColumn,
    Task, TaskCreate, TaskUpdate, TaskMoveRequest,
    Job, JobCreate, JobUpdate,
    Appointment, AppointmentCreate, AppointmentConfirmation,
    ImageUploadRequest, ImageUploadResponse,
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
    # Remove any control characters
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

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample data for development"""
    await db.technicians.delete_many({})
    await db.jobs.delete_many({})
    await db.tasks.delete_many({})
    await db.appointments.delete_many({})
    
    technicians_data = [
        TechnicianCreate(
            employee_number="TECH-1001",
            name="Mike Johnson",
            email="mike.johnson@example.com",
            phone="(555) 123-4567",
            role="Senior Technician",
            specialty="Residential Install",
            skills=["HVAC Installation", "Heat Pump", "AC Repair", "Ductwork"],
            location="Dallas, TX",
            years_experience=8,
            bio="Experienced HVAC technician specializing in residential installations and repairs.",
        ),
        TechnicianCreate(
            employee_number="TECH-1002",
            name="Lisa Chen",
            email="lisa.chen@example.com",
            phone="(555) 234-5678",
            role="Lead Technician",
            specialty="Commercial Systems",
            skills=["Commercial HVAC", "RTU", "Chillers", "BAS"],
            location="Plano, TX",
            years_experience=12,
            bio="Lead technician with expertise in commercial HVAC systems.",
        ),
        TechnicianCreate(
            employee_number="TECH-1003",
            name="Tom Brown",
            email="tom.brown@example.com",
            phone="(555) 345-6789",
            role="Technician",
            specialty="Emergency Repair",
            skills=["Emergency Repair", "Gas Furnace", "Heat Pump", "Troubleshooting"],
            location="Richardson, TX",
            years_experience=5,
            bio="Skilled in emergency repairs and diagnostics.",
        ),
        TechnicianCreate(
            employee_number="TECH-1004",
            name="Amy Davis",
            email="amy.davis@example.com",
            phone="(555) 456-7890",
            role="Technician",
            specialty="Maintenance",
            skills=["Preventive Maintenance", "Filter Replacement", "System Inspection"],
            location="Frisco, TX",
            years_experience=3,
            bio="Dedicated to keeping HVAC systems running efficiently.",
        ),
        TechnicianCreate(
            employee_number="TECH-1005",
            name="Carlos Mendez",
            email="carlos.mendez@example.com",
            phone="(555) 567-8901",
            role="Junior Technician",
            specialty="Residential Repair",
            skills=["AC Repair", "Thermostat Installation", "Basic Maintenance"],
            location="Allen, TX",
            years_experience=1,
            bio="Enthusiastic junior technician eager to learn and grow.",
        ),
    ]
    
    tech_ids = []
    for tech_data in technicians_data:
        tech = Technician(**tech_data.dict())
        tech.rating = 4.5 + (hash(tech.name) % 5) / 10
        tech.total_jobs = 50 + (hash(tech.name) % 150)
        await db.technicians.insert_one(tech.dict())
        tech_ids.append(tech.id)
    
    jobs_data = [
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
            description="Customer reports A/C not cooling properly. Need to check compressor.",
            priority="normal",
            scheduled_date="2026-02-27",
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
            description="Economizer actuator needs replacement on RTU #3.",
            priority="high",
            scheduled_date="2026-02-27",
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
            description="Customer has no heat. Gas furnace not igniting.",
            priority="urgent",
            scheduled_date="2026-02-27",
        ),
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
            description="Install new 10-ton RTU on Building A rooftop.",
            priority="normal",
            scheduled_date="2026-02-28",
        ),
    ]
    
    job_ids = []
    for job_data in jobs_data:
        job = Job(
            job_number=f"JOB-{1001 + len(job_ids)}",
            **job_data.dict()
        )
        await db.jobs.insert_one(job.dict())
        job_ids.append(job.id)
    
    tasks_data = [
        TaskCreate(job_id=job_ids[0], title="Initial customer call", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[0], scheduled_date="2026-02-25", notes="Customer called reporting AC issues"),
        TaskCreate(job_id=job_ids[0], title="Diagnostic visit", task_type="tech_call", status="out_for_service", assigned_technician_id=tech_ids[0], scheduled_date="2026-02-27", estimated_duration="2 hours"),
        TaskCreate(job_id=job_ids[0], title="Present repair options", task_type="sales_call", status="sales_call_scheduled", scheduled_date="2026-02-28"),
        TaskCreate(job_id=job_ids[1], title="Economizer assessment", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[1], scheduled_date="2026-02-26"),
        TaskCreate(job_id=job_ids[1], title="Parts ordering", task_type="other", status="dispatched"),
        TaskCreate(job_id=job_ids[2], title="Emergency dispatch", task_type="service", status="out_for_service", assigned_technician_id=tech_ids[2], priority="urgent", scheduled_date="2026-02-27"),
        TaskCreate(job_id=job_ids[2], title="Quote for replacement", task_type="sales_call", status="lead", scheduled_date="2026-02-28"),
        TaskCreate(job_id=job_ids[3], title="Site survey", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[3]),
        TaskCreate(job_id=job_ids[3], title="Equipment delivery", task_type="other", status="dispatched"),
        TaskCreate(job_id=job_ids[3], title="Day 1: Prep work", task_type="service", status="lead", assigned_technician_id=tech_ids[3], scheduled_date="2026-02-28"),
        TaskCreate(job_id=job_ids[3], title="Day 2: Installation", task_type="service", status="lead", assigned_technician_id=tech_ids[3], scheduled_date="2026-03-01"),
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
            order=i % 3,
            **task_data.dict()
        )
        await db.tasks.insert_one(task.dict())
    
    await ensure_default_board_config()
    
    return {
        "message": "Database seeded successfully",
        "technicians": len(technicians_data),
        "jobs": len(jobs_data),
        "tasks": len(tasks_data),
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
