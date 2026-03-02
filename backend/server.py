from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime

from models import (
    # User & Auth
    User, UserCreate, UserResponse,
    # Technician
    Technician, TechnicianCreate, TechnicianUpdate, TechnicianPublicProfile,
    Certification, License, WorkHistoryEntry,
    # Board Config
    BoardConfig, BoardConfigCreate, BoardConfigUpdate, StatusColumn,
    # Tasks
    Task, TaskCreate, TaskUpdate, TaskMoveRequest,
    # Jobs
    Job, JobCreate, JobUpdate,
    # Appointments
    Appointment, AppointmentCreate, AppointmentConfirmation,
    # Image
    ImageUploadRequest, ImageUploadResponse,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'field_service_db')]

# Create the main app without a prefix
app = FastAPI(title="Field Service Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Field Service Management API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

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
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=user_data.password,  # In production, hash this!
    )
    await db.users.insert_one(user.dict())
    return UserResponse(**user.dict())

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(role: Optional[str] = None):
    query = {}
    if role:
        query["role"] = role
    users = await db.users.find(query).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

# ==================== TECHNICIANS API ====================

@api_router.post("/technicians", response_model=Technician)
async def create_technician(tech_data: TechnicianCreate):
    # Generate employee number if not provided
    count = await db.technicians.count_documents({})
    tech = Technician(
        employee_number=tech_data.employee_number or f"TECH-{count + 1001}",
        **tech_data.dict(exclude={"employee_number"} if not tech_data.employee_number else set())
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
        query["status"] = status
    if specialty:
        query["specialty"] = {"$regex": specialty, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"employee_number": {"$regex": search, "$options": "i"}},
        ]
    
    technicians = await db.technicians.find(query).to_list(1000)
    return [Technician(**t) for t in technicians]

@api_router.get("/technicians/{tech_id}", response_model=Technician)
async def get_technician(tech_id: str):
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return Technician(**tech)

@api_router.get("/technicians/{tech_id}/public", response_model=TechnicianPublicProfile)
async def get_technician_public_profile(tech_id: str):
    """Get public-facing technician profile for customers"""
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
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    update_data = {k: v for k, v in tech_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.technicians.update_one({"id": tech_id}, {"$set": update_data})
    updated_tech = await db.technicians.find_one({"id": tech_id})
    return Technician(**updated_tech)

@api_router.delete("/technicians/{tech_id}")
async def delete_technician(tech_id: str):
    result = await db.technicians.delete_one({"id": tech_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"message": "Technician deleted successfully"}

@api_router.post("/technicians/{tech_id}/image", response_model=ImageUploadResponse)
async def upload_technician_image(tech_id: str, image_data: ImageUploadRequest):
    """Upload technician profile image as base64"""
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    # Validate base64 image (basic check)
    if not image_data.image_data:
        raise HTTPException(status_code=400, detail="Image data is required")
    
    # Check if it's a valid base64 data URL or raw base64
    if not image_data.image_data.startswith("data:image"):
        # Assume it's raw base64, add data URL prefix
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
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    await db.technicians.update_one(
        {"id": tech_id},
        {"$set": {"status": status, "status_label": status_label, "updated_at": datetime.utcnow()}}
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
    config = await db.board_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Board config not found")
    return BoardConfig(**config)

@api_router.post("/board-configs", response_model=BoardConfig)
async def create_board_config(config_data: BoardConfigCreate):
    config = BoardConfig(**config_data.dict())
    await db.board_configs.insert_one(config.dict())
    return config

@api_router.put("/board-configs/{config_id}", response_model=BoardConfig)
async def update_board_config(config_id: str, config_data: BoardConfigUpdate):
    config = await db.board_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Board config not found")
    
    # Prevent modification of default config's core settings
    if config.get("is_default") and config_data.columns:
        # Allow column updates but ensure default columns remain
        pass
    
    update_data = {k: v for k, v in config_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.board_configs.update_one({"id": config_id}, {"$set": update_data})
    updated = await db.board_configs.find_one({"id": config_id})
    return BoardConfig(**updated)

@api_router.delete("/board-configs/{config_id}")
async def delete_board_config(config_id: str):
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
    job = Job(
        job_number=f"JOB-{count + 1001}",
        **job_data.dict()
    )
    await db.jobs.insert_one(job.dict())
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0
):
    query = {}
    if status:
        if status == "active":
            query["status"] = {"$in": ["open", "in_progress", "urgent"]}
        else:
            query["status"] = status
    if priority:
        query["priority"] = priority
    if customer_id:
        query["customer_id"] = customer_id
    if search:
        query["$or"] = [
            {"job_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"site_address": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
        ]
    
    jobs = await db.jobs.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [Job(**j) for j in jobs]

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return Job(**job)

@api_router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_data: JobUpdate):
    job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {k: v for k, v in job_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.jobs.update_one({"id": job["id"]}, {"$set": update_data})
    updated = await db.jobs.find_one({"id": job["id"]})
    return Job(**updated)

@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    result = await db.jobs.delete_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    # Also delete associated tasks
    await db.tasks.delete_many({"job_id": job_id})
    return {"message": "Job deleted successfully"}

# ==================== TASKS API ====================

@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate):
    # Verify job exists
    job = await db.jobs.find_one({"$or": [{"id": task_data.job_id}, {"job_number": task_data.job_id}]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get technician name if assigned
    tech_name = None
    if task_data.assigned_technician_id:
        tech = await db.technicians.find_one({"id": task_data.assigned_technician_id})
        if tech:
            tech_name = tech["name"]
    
    # Get max order in the status column
    max_order = await db.tasks.find(
        {"job_id": job["id"], "status": task_data.status}
    ).sort("order", -1).limit(1).to_list(1)
    order = (max_order[0]["order"] + 1) if max_order else 0
    
    count = await db.tasks.count_documents({})
    task = Task(
        task_number=f"TASK-{count + 1001}",
        job_id=job["id"],
        assigned_technician_name=tech_name,
        order=order,
        **{k: v for k, v in task_data.dict().items() if k not in ["job_id"]}
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
        # Support both job ID and job number
        job = await db.jobs.find_one({"$or": [{"id": job_id}, {"job_number": job_id}]})
        if job:
            query["job_id"] = job["id"]
        else:
            query["job_id"] = job_id
    if status:
        query["status"] = status
    if technician_id:
        query["assigned_technician_id"] = technician_id
    if task_type:
        query["task_type"] = task_type
    
    tasks = await db.tasks.find(query).sort([("status", 1), ("order", 1)]).to_list(1000)
    return [Task(**t) for t in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    task = await db.tasks.find_one({"$or": [{"id": task_id}, {"task_number": task_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_data: TaskUpdate):
    task = await db.tasks.find_one({"$or": [{"id": task_id}, {"task_number": task_id}]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in task_data.dict().items() if v is not None}
    
    # Update technician name if ID changed
    if "assigned_technician_id" in update_data:
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
    task = await db.tasks.find_one({"id": move_data.task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_status = task["status"]
    old_order = task["order"]
    
    # Update orders of other tasks in the old column (shift up)
    if old_status != move_data.new_status:
        await db.tasks.update_many(
            {"job_id": task["job_id"], "status": old_status, "order": {"$gt": old_order}},
            {"$inc": {"order": -1}}
        )
    
    # Update orders of tasks in new column (shift down)
    await db.tasks.update_many(
        {"job_id": task["job_id"], "status": move_data.new_status, "order": {"$gte": move_data.new_order}},
        {"$inc": {"order": 1}}
    )
    
    # Update the task
    await db.tasks.update_one(
        {"id": move_data.task_id},
        {"$set": {
            "status": move_data.new_status,
            "order": move_data.new_order,
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated = await db.tasks.find_one({"id": move_data.task_id})
    return Task(**updated)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = await db.tasks.delete_one({"$or": [{"id": task_id}, {"task_number": task_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ==================== APPOINTMENTS API ====================

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt_data: AppointmentCreate):
    # Verify technician exists
    tech = await db.technicians.find_one({"id": appt_data.technician_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    appointment = Appointment(**appt_data.dict())
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
        query["job_id"] = job_id
    if technician_id:
        query["technician_id"] = technician_id
    if status:
        query["status"] = status
    if date:
        query["scheduled_date"] = date
    
    appointments = await db.appointments.find(query).sort("scheduled_date", 1).to_list(1000)
    return [Appointment(**a) for a in appointments]

@api_router.get("/appointments/{appt_id}", response_model=Appointment)
async def get_appointment(appt_id: str):
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return Appointment(**appointment)

@api_router.get("/appointments/confirmation/{token}", response_model=AppointmentConfirmation)
async def get_appointment_confirmation(token: str):
    """Get customer-facing appointment confirmation by token"""
    appointment = await db.appointments.find_one({"confirmation_token": token})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get job details
    job = await db.jobs.find_one({"id": appointment["job_id"]})
    job_number = job["job_number"] if job else "N/A"
    
    # Get technician public profile
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
    appointment = await db.appointments.find_one({"id": appt_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Appointment status updated"}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_database():
    """Seed database with sample data for development"""
    # Clear existing data
    await db.technicians.delete_many({})
    await db.jobs.delete_many({})
    await db.tasks.delete_many({})
    await db.appointments.delete_many({})
    
    # Create sample technicians
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
    
    # Create sample jobs
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
    
    # Create sample tasks for each job
    tasks_data = [
        # Job 1 tasks
        TaskCreate(job_id=job_ids[0], title="Initial customer call", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[0], scheduled_date="2026-02-25", notes="Customer called reporting AC issues"),
        TaskCreate(job_id=job_ids[0], title="Diagnostic visit", task_type="tech_call", status="out_for_service", assigned_technician_id=tech_ids[0], scheduled_date="2026-02-27", estimated_duration="2 hours"),
        TaskCreate(job_id=job_ids[0], title="Present repair options", task_type="sales_call", status="sales_call_scheduled", scheduled_date="2026-02-28"),
        # Job 2 tasks
        TaskCreate(job_id=job_ids[1], title="Economizer assessment", task_type="tech_call", status="completed", assigned_technician_id=tech_ids[1], scheduled_date="2026-02-26"),
        TaskCreate(job_id=job_ids[1], title="Parts ordering", task_type="other", status="dispatched"),
        # Job 3 tasks
        TaskCreate(job_id=job_ids[2], title="Emergency dispatch", task_type="service", status="out_for_service", assigned_technician_id=tech_ids[2], priority="urgent", scheduled_date="2026-02-27"),
        TaskCreate(job_id=job_ids[2], title="Quote for replacement", task_type="sales_call", status="lead", scheduled_date="2026-02-28"),
        # Job 4 tasks
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
    
    # Ensure default board config exists
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
