from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
import uuid

# ==================== ENUMS ====================

RoleType = Literal["admin", "manager", "dispatcher", "technician"]
TaskStatus = Literal["lead", "diagnostic_call", "sales_call_scheduled", "dispatched", "out_for_service", "completed"]
TechnicianStatus = Literal["available", "on_job", "en_route", "off_duty", "emergency"]

# ==================== USER & AUTH ====================

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: RoleType
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: str
    name: str
    role: RoleType
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: RoleType
    created_at: datetime

# ==================== TECHNICIAN PROFILE ====================

class Certification(BaseModel):
    name: str
    issuer: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    certificate_number: Optional[str] = None

class License(BaseModel):
    name: str
    license_number: str
    state: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None

class WorkHistoryEntry(BaseModel):
    job_id: str
    job_title: str
    completed_date: str
    rating: Optional[float] = None
    notes: Optional[str] = None

class Technician(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    employee_number: str
    name: str
    email: str
    phone: str
    role: str = "Technician"  # Job title like "Senior Technician", "Lead Technician"
    specialty: str
    skills: List[str] = []
    certifications: List[Certification] = []
    licenses: List[License] = []
    profile_image: Optional[str] = None  # Base64 encoded image
    status: TechnicianStatus = "available"
    status_label: str = "Available"
    location: str
    rating: float = 5.0
    total_jobs: int = 0
    years_experience: int = 0
    bio: Optional[str] = None
    availability_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    work_history: List[WorkHistoryEntry] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TechnicianCreate(BaseModel):
    employee_number: str
    name: str
    email: str
    phone: str
    role: str = "Technician"
    specialty: str
    skills: List[str] = []
    certifications: List[Certification] = []
    licenses: List[License] = []
    location: str
    years_experience: int = 0
    bio: Optional[str] = None
    availability_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class TechnicianUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    skills: Optional[List[str]] = None
    certifications: Optional[List[Certification]] = None
    licenses: Optional[List[License]] = None
    status: Optional[TechnicianStatus] = None
    status_label: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    availability_notes: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class TechnicianPublicProfile(BaseModel):
    """Subset of technician info for customer-facing views"""
    id: str
    name: str
    role: str
    specialty: str
    profile_image: Optional[str] = None
    rating: float
    years_experience: int
    bio: Optional[str] = None

# ==================== TIME TRACKING ====================

class GeoLocation(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    accuracy: Optional[float] = None  # GPS accuracy in meters

class TimeEntry(BaseModel):
    """Individual time entry for a technician"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technician_id: str
    job_id: Optional[str] = None
    entry_type: Literal["shift_start", "shift_end", "job_start", "job_end"]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    location: Optional[GeoLocation] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TimeEntryCreate(BaseModel):
    technician_id: str
    job_id: Optional[str] = None
    entry_type: Literal["shift_start", "shift_end", "job_start", "job_end"]
    location: Optional[GeoLocation] = None
    notes: Optional[str] = None

class ShiftSession(BaseModel):
    """A complete shift from clock-in to clock-out"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technician_id: str
    shift_start: datetime
    shift_start_location: Optional[GeoLocation] = None
    shift_end: Optional[datetime] = None
    shift_end_location: Optional[GeoLocation] = None
    total_shift_minutes: Optional[float] = None
    jobs_completed: int = 0
    status: Literal["active", "completed"] = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class JobTimeEntry(BaseModel):
    """Time tracking for a specific job"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technician_id: str
    job_id: str
    job_number: Optional[str] = None
    job_type: Optional[str] = None
    shift_session_id: Optional[str] = None
    
    # Travel tracking
    dispatch_time: Optional[datetime] = None
    dispatch_location: Optional[GeoLocation] = None
    estimated_travel_minutes: Optional[float] = None
    estimated_route_distance_miles: Optional[float] = None
    
    # Job site arrival
    job_start: Optional[datetime] = None
    job_start_location: Optional[GeoLocation] = None
    actual_travel_minutes: Optional[float] = None
    
    # Job completion
    job_end: Optional[datetime] = None
    job_end_location: Optional[GeoLocation] = None
    actual_job_minutes: Optional[float] = None
    
    # Calculated metrics
    travel_variance_minutes: Optional[float] = None  # actual - estimated
    status: Literal["dispatched", "traveling", "on_site", "completed", "cancelled"] = "dispatched"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobTimeEntryCreate(BaseModel):
    technician_id: str
    job_id: str
    dispatch_location: Optional[GeoLocation] = None

class TechnicianMetrics(BaseModel):
    """Aggregated metrics for a technician"""
    technician_id: str
    technician_name: str
    
    # Travel metrics
    avg_travel_minutes: float = 0
    total_travel_minutes: float = 0
    travel_entries_count: int = 0
    travel_variance_avg: float = 0  # How accurate their travel estimates are
    
    # Job duration metrics by type
    avg_job_minutes_residential_repair: float = 0
    avg_job_minutes_commercial_repair: float = 0
    avg_job_minutes_residential_install: float = 0
    avg_job_minutes_commercial_install: float = 0
    avg_job_minutes_maintenance: float = 0
    avg_job_minutes_emergency: float = 0
    
    # Overall metrics
    total_jobs_tracked: int = 0
    total_job_minutes: float = 0
    jobs_on_time_percentage: float = 0
    
    # Recent performance (last 30 days)
    recent_avg_travel_minutes: float = 0
    recent_travel_variance: float = 0
    
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class RouteEstimate(BaseModel):
    """Route estimation result"""
    origin: GeoLocation
    destination: GeoLocation
    estimated_minutes: float
    estimated_miles: float
    route_count: int = 3  # Number of routes averaged
    confidence: Literal["high", "medium", "low"] = "medium"

# ==================== BOARD CONFIGURATION ====================

class StatusColumn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    key: str  # Unique identifier like "lead", "diagnostic_call"
    color: str = "#6366f1"  # Default indigo
    order: int
    is_default: bool = False  # Is this a system default column

class BoardConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Default Board"
    description: Optional[str] = None
    columns: List[StatusColumn] = []
    created_by: Optional[str] = None  # User ID
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BoardConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    columns: List[StatusColumn]

class BoardConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    columns: Optional[List[StatusColumn]] = None

# ==================== TASKS ====================

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    task_number: str
    title: str
    description: Optional[str] = None
    task_type: Literal["tech_call", "sales_call", "service", "follow_up", "other"] = "service"
    status: str = "lead"  # Column key from BoardConfig
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    estimated_duration: Optional[str] = None
    actual_duration: Optional[str] = None
    notes: Optional[str] = None
    discovery_notes: Optional[str] = None
    order: int = 0  # Order within column
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TaskCreate(BaseModel):
    job_id: str
    title: str
    description: Optional[str] = None
    task_type: Literal["tech_call", "sales_call", "service", "follow_up", "other"] = "service"
    status: str = "lead"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    assigned_technician_id: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    estimated_duration: Optional[str] = None
    notes: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[Literal["tech_call", "sales_call", "service", "follow_up", "other"]] = None
    status: Optional[str] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    assigned_technician_id: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    estimated_duration: Optional[str] = None
    actual_duration: Optional[str] = None
    notes: Optional[str] = None
    discovery_notes: Optional[str] = None
    order: Optional[int] = None

class TaskMoveRequest(BaseModel):
    task_id: str
    new_status: str
    new_order: int

# ==================== JOBS (Enhanced) ====================

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_number: str
    customer_name: str
    customer_id: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    site_address: str
    site_city: Optional[str] = None
    site_state: Optional[str] = None
    site_zip: Optional[str] = None
    job_type: str
    title: str
    description: Optional[str] = None
    status: Literal["open", "in_progress", "complete", "cancelled", "urgent", "pending"] = "open"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    board_config_id: Optional[str] = None  # Which board config to use
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobCreate(BaseModel):
    customer_name: str
    customer_id: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    site_address: str
    site_city: Optional[str] = None
    site_state: Optional[str] = None
    site_zip: Optional[str] = None
    job_type: str
    title: str
    description: Optional[str] = None
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    scheduled_date: Optional[str] = None
    estimated_hours: Optional[float] = None

class JobUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    site_address: Optional[str] = None
    site_city: Optional[str] = None
    site_state: Optional[str] = None
    site_zip: Optional[str] = None
    job_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["open", "in_progress", "complete", "cancelled", "urgent", "pending"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    board_config_id: Optional[str] = None

# ==================== APPOINTMENTS ====================

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    task_id: Optional[str] = None
    technician_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    site_address: str
    scheduled_date: str
    scheduled_time: str
    estimated_duration: Optional[str] = None
    job_type: str
    notes: Optional[str] = None
    confirmation_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["scheduled", "confirmed", "en_route", "arrived", "completed", "cancelled"] = "scheduled"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AppointmentCreate(BaseModel):
    job_id: str
    task_id: Optional[str] = None
    technician_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    site_address: str
    scheduled_date: str
    scheduled_time: str
    estimated_duration: Optional[str] = None
    job_type: str
    notes: Optional[str] = None

class AppointmentConfirmation(BaseModel):
    """Customer-facing appointment confirmation"""
    appointment_id: str
    job_number: str
    scheduled_date: str
    scheduled_time: str
    estimated_duration: Optional[str] = None
    job_type: str
    site_address: str
    technician: TechnicianPublicProfile
    notes: Optional[str] = None
    status: str

# ==================== IMAGE UPLOAD ====================

class ImageUploadRequest(BaseModel):
    image_data: str  # Base64 encoded image
    
class ImageUploadResponse(BaseModel):
    success: bool
    message: str

# ==================== INVENTORY MANAGEMENT ====================

class InventoryCategory(BaseModel):
    """Category for inventory items"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    is_standard: bool = True  # Standard categories vs custom
    icon: Optional[str] = None  # Icon identifier for UI
    sort_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0

class InventoryItem(BaseModel):
    """Master inventory item definition"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    description: Optional[str] = None
    category_id: str
    category_name: Optional[str] = None
    unit: str = "each"  # each, ft, lb, oz, gallon, etc.
    unit_cost: float = 0.0
    retail_price: float = 0.0
    min_stock_threshold: int = 1  # Minimum qty to trigger restock
    is_serialized: bool = False  # Track by serial number
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryItemCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category_id: str
    unit: str = "each"
    unit_cost: float = 0.0
    retail_price: float = 0.0
    min_stock_threshold: int = 1
    is_serialized: bool = False

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    retail_price: Optional[float] = None
    min_stock_threshold: Optional[int] = None
    is_serialized: Optional[bool] = None
    is_active: Optional[bool] = None

class TruckInventory(BaseModel):
    """Inventory assigned to a specific truck"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    truck_name: str
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None
    items: List[dict] = []  # List of {item_id, item_name, sku, quantity, last_counted}
    last_stock_check: Optional[datetime] = None
    stock_check_required: bool = True
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TruckInventoryItem(BaseModel):
    """Individual item in truck inventory"""
    item_id: str
    item_name: str
    sku: str
    category_id: str
    category_name: str
    quantity: int
    min_threshold: int
    unit: str
    last_counted: Optional[datetime] = None
    needs_restock: bool = False

class TruckStockCheck(BaseModel):
    """Stock check submission"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    technician_id: str
    technician_name: str
    shift_session_id: Optional[str] = None
    check_type: Literal["shift_start", "shift_end", "audit"] = "shift_start"
    items_checked: List[dict] = []  # {item_id, expected_qty, actual_qty, variance}
    items_below_threshold: List[dict] = []  # Items needing restock
    notes: Optional[str] = None
    status: Literal["pending", "completed", "reviewed"] = "completed"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TruckStockCheckCreate(BaseModel):
    truck_id: str
    technician_id: str
    shift_session_id: Optional[str] = None
    check_type: Literal["shift_start", "shift_end", "audit"] = "shift_start"
    items_checked: List[dict]
    notes: Optional[str] = None

class RestockRequest(BaseModel):
    """Request to restock truck inventory"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    truck_name: str
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None
    request_type: Literal["auto", "manual"] = "auto"
    items: List[dict] = []  # {item_id, item_name, sku, current_qty, requested_qty, reason}
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    status: Literal["pending", "approved", "in_progress", "completed", "cancelled"] = "pending"
    notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RestockRequestCreate(BaseModel):
    truck_id: str
    technician_id: Optional[str] = None
    request_type: Literal["auto", "manual"] = "manual"
    items: List[dict]
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    notes: Optional[str] = None

# ==================== EQUIPMENT USAGE & AUDIT ====================

class JobEquipmentUsage(BaseModel):
    """Equipment used on a job - for audit trail"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    job_number: str
    task_id: Optional[str] = None
    technician_id: str
    technician_name: str
    truck_id: str
    
    # Equipment details
    planned_items: List[dict] = []  # From job estimate {item_id, item_name, sku, quantity, unit_cost}
    actual_items: List[dict] = []   # Tech confirmed {item_id, item_name, sku, quantity, unit_cost, serial_number}
    
    # Approval flow
    status: Literal["pending_approval", "approved", "adjusted", "disputed"] = "pending_approval"
    tech_approved: bool = False
    tech_approved_at: Optional[datetime] = None
    tech_notes: Optional[str] = None
    
    # Variance tracking
    has_variance: bool = False
    variance_notes: Optional[str] = None
    
    # Inventory updated
    inventory_deducted: bool = False
    inventory_deducted_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobEquipmentApproval(BaseModel):
    """Tech approval of equipment used"""
    actual_items: List[dict]  # {item_id, quantity, serial_number (optional)}
    notes: Optional[str] = None

class InventoryAuditLog(BaseModel):
    """Audit trail for inventory changes"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    item_id: str
    item_name: str
    sku: str
    
    action: Literal["add", "remove", "adjust", "restock", "job_usage", "transfer"]
    quantity_before: int
    quantity_change: int  # Positive for add, negative for remove
    quantity_after: int
    
    # Reference
    job_id: Optional[str] = None
    job_number: Optional[str] = None
    restock_request_id: Optional[str] = None
    stock_check_id: Optional[str] = None
    
    performed_by_id: str
    performed_by_name: str
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== J-LOAD CALCULATOR ====================

class JLoadQuickEstimate(BaseModel):
    """Quick load estimate based on sq ft"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: Optional[str] = None
    site_id: Optional[str] = None
    quote_id: Optional[str] = None
    
    # Input parameters
    square_footage: float
    climate_zone: Literal["1", "2", "3", "4", "5", "6", "7"]  # IECC climate zones
    building_type: Literal["residential", "commercial", "mixed"]
    building_age: Literal["new", "10_years", "20_years", "30_plus"]
    insulation_quality: Literal["poor", "average", "good", "excellent"]
    num_floors: int = 1
    ceiling_height: float = 8.0  # feet
    num_windows: int = 0
    window_type: Literal["single", "double", "triple", "low_e"] = "double"
    
    # Calculated results
    cooling_btuh: float = 0
    heating_btuh: float = 0
    recommended_tonnage: float = 0
    recommended_furnace_btuh: float = 0
    
    # Equipment recommendations
    recommended_equipment: List[dict] = []  # {type, size, model_suggestion}
    
    notes: Optional[str] = None
    calculated_by_id: Optional[str] = None
    calculated_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class JLoadQuickEstimateCreate(BaseModel):
    job_id: Optional[str] = None
    site_id: Optional[str] = None
    quote_id: Optional[str] = None
    square_footage: float
    climate_zone: Literal["1", "2", "3", "4", "5", "6", "7"]
    building_type: Literal["residential", "commercial", "mixed"] = "residential"
    building_age: Literal["new", "10_years", "20_years", "30_plus"] = "20_years"
    insulation_quality: Literal["poor", "average", "good", "excellent"] = "average"
    num_floors: int = 1
    ceiling_height: float = 8.0
    num_windows: int = 0
    window_type: Literal["single", "double", "triple", "low_e"] = "double"
    notes: Optional[str] = None

class ManualJLoadCalculation(BaseModel):
    """Full Manual J ACCA load calculation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: Optional[str] = None
    site_id: Optional[str] = None
    quote_id: Optional[str] = None
    
    # Building Information
    project_name: str
    address: str
    city: str
    state: str
    zip_code: str
    climate_zone: str
    design_temps: dict = {}  # {outdoor_summer, outdoor_winter, indoor_summer, indoor_winter}
    
    # Building Envelope
    total_square_footage: float
    conditioned_volume: float  # cubic feet
    
    # Wall data
    walls: List[dict] = []  # {orientation, area_sqft, r_value, construction_type}
    
    # Window data
    windows: List[dict] = []  # {orientation, area_sqft, u_factor, shgc, shading}
    
    # Door data
    doors: List[dict] = []  # {type, area_sqft, u_factor}
    
    # Ceiling/Roof data
    ceilings: List[dict] = []  # {type, area_sqft, r_value, attic_type}
    
    # Floor data
    floors: List[dict] = []  # {type, area_sqft, r_value, over_what}
    
    # Infiltration
    infiltration_ach: float = 0.5  # Air changes per hour
    
    # Internal gains
    occupants: int = 2
    appliance_load_btuh: float = 0
    lighting_load_btuh: float = 0
    
    # Duct system
    duct_location: Literal["conditioned", "unconditioned_attic", "unconditioned_basement", "crawlspace"] = "unconditioned_attic"
    duct_insulation_r: float = 6.0
    duct_leakage_percent: float = 10.0
    
    # Calculated Loads
    sensible_cooling_load: float = 0
    latent_cooling_load: float = 0
    total_cooling_load: float = 0
    heating_load: float = 0
    
    # Equipment sizing
    recommended_cooling_tons: float = 0
    recommended_heating_btuh: float = 0
    equipment_recommendations: List[dict] = []
    
    # Metadata
    calculation_method: str = "Manual J (ACCA)"
    software_version: str = "BreezeFlow 2.0"
    calculated_by_id: Optional[str] = None
    calculated_by_name: Optional[str] = None
    verified_by_id: Optional[str] = None
    verified_by_name: Optional[str] = None
    
    status: Literal["draft", "calculated", "verified", "approved"] = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ManualJLoadCreate(BaseModel):
    job_id: Optional[str] = None
    site_id: Optional[str] = None
    quote_id: Optional[str] = None
    project_name: str
    address: str
    city: str
    state: str
    zip_code: str
    climate_zone: str
    total_square_footage: float
    num_floors: int = 1
    ceiling_height: float = 8.0

# ==================== TRUCK MANAGEMENT ====================

class Truck(BaseModel):
    """Company truck/vehicle"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_number: str
    name: str
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    
    status: Literal["active", "maintenance", "inactive"] = "active"
    last_inspection_date: Optional[str] = None
    next_inspection_date: Optional[str] = None
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TruckCreate(BaseModel):
    truck_number: str
    name: str
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    assigned_technician_id: Optional[str] = None

class TruckUpdate(BaseModel):
    name: Optional[str] = None
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    assigned_technician_id: Optional[str] = None
    status: Optional[Literal["active", "maintenance", "inactive"]] = None
    last_inspection_date: Optional[str] = None
    next_inspection_date: Optional[str] = None
    notes: Optional[str] = None
