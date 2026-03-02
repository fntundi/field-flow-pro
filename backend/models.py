from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
import uuid

# ==================== ENUMS ====================

# Enhanced role types per RFC-002
RoleType = Literal["admin", "owner", "manager", "dispatcher", "technician", "lead_tech", "accountant", "sales"]
TaskStatus = Literal["lead", "diagnostic_call", "sales_call_scheduled", "dispatched", "out_for_service", "completed"]
TechnicianStatus = Literal["available", "on_job", "en_route", "off_duty", "emergency", "lunch"]

# Lead status workflow per RFC-002 section 4.1.1
LeadStatus = Literal["new", "contacted", "qualified", "quoted", "won", "lost"]

# PCB status workflow per RFC-002 section 4.1.2
PCBStatus = Literal["created", "assigned", "follow_up", "converted", "closed"]

# Job type categories per RFC-002 section 4.2.1
JobTypeCategory = Literal["residential_service", "residential_install", "commercial_service", "commercial_install"]

# Checklist evidence types per RFC-002 section 4.2.2
EvidenceType = Literal["before_photo", "after_photo", "note", "signature", "measurement"]

# Proposal status per RFC-002 section 4.1.3
ProposalStatus = Literal["draft", "sent", "viewed", "accepted", "rejected", "expired"]

# Invoice status per RFC-002 section 4.6.1
InvoiceStatus = Literal["draft", "sent", "partially_paid", "paid", "void", "overdue"]

# Vendor PO status per RFC-002 section 4.7.2
POStatus = Literal["draft", "submitted", "confirmed", "partial", "received", "cancelled"]

# ==================== USER & AUTH ====================

class UserAuth(BaseModel):
    """User with authentication data"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    password_hash: Optional[str] = None
    role: RoleType = "technician"
    is_active: bool = True
    
    # OAuth fields
    google_id: Optional[str] = None
    auth_provider: Literal["local", "google"] = "local"
    
    # Profile
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    
    # Linked records
    technician_id: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: RoleType = "technician"

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

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

# ==================== RBAC - ROLES & PERMISSIONS (RFC-002 Section 4.9) ====================

class Permission(BaseModel):
    """Fine-grained permission for RBAC"""
    module: str  # e.g., "jobs", "leads", "inventory", "financials"
    action: str  # e.g., "create", "read", "update", "delete", "approve"
    allowed: bool = True

class Role(BaseModel):
    """Role definition with permissions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Technician", "Lead Tech", "Dispatcher", "Manager", "Admin"
    display_name: str
    description: Optional[str] = None
    permissions: List[Permission] = []
    is_system: bool = False  # System roles cannot be deleted
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    permissions: List[Permission] = []

# Default system roles per RFC-002
DEFAULT_ROLES = [
    {"name": "technician", "display_name": "Technician", "description": "Field technician with basic job access"},
    {"name": "lead_tech", "display_name": "Lead Technician", "description": "Senior tech with crew oversight"},
    {"name": "dispatcher", "display_name": "Dispatcher", "description": "Manages scheduling and dispatch"},
    {"name": "manager", "display_name": "Manager", "description": "Branch/department manager"},
    {"name": "admin", "display_name": "Administrator", "description": "Full system access"},
    {"name": "accountant", "display_name": "Accountant", "description": "Financial access only"},
    {"name": "sales", "display_name": "Sales Representative", "description": "Leads, quotes, and proposals"},
    {"name": "owner", "display_name": "Owner/GM", "description": "Business owner with all access"},
]

# ==================== LEADS (RFC-002 Section 4.1.1) ====================

class Lead(BaseModel):
    """Lead management per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_number: str = Field(default_factory=lambda: f"LEAD-{str(uuid.uuid4())[:8].upper()}")
    
    # Contact info
    contact_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    
    # Lead details
    source: str  # e.g., "website", "referral", "google_ads", "facebook", "walk_in", "phone"
    source_detail: Optional[str] = None  # Campaign name, referrer name, etc.
    preferred_contact_method: Literal["phone", "email", "text", "any"] = "any"
    
    # Status workflow per RFC-002: New → Contacted → Qualified → Quoted → Won/Lost
    status: LeadStatus = "new"
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Assignment
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    
    # Tracking
    first_contact_at: Optional[datetime] = None
    qualified_at: Optional[datetime] = None
    quoted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    close_reason: Optional[str] = None  # Won/Lost reason
    
    # Related records
    converted_customer_id: Optional[str] = None
    converted_job_id: Optional[str] = None
    proposal_ids: List[str] = []
    
    # Metadata
    notes: Optional[str] = None
    tags: List[str] = []
    estimated_value: float = 0
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LeadCreate(BaseModel):
    contact_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    source: str = "website"
    source_detail: Optional[str] = None
    preferred_contact_method: Literal["phone", "email", "text", "any"] = "any"
    notes: Optional[str] = None
    tags: List[str] = []
    estimated_value: float = 0
    priority: Literal["low", "normal", "high", "urgent"] = "normal"

class LeadUpdate(BaseModel):
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    preferred_contact_method: Optional[Literal["phone", "email", "text", "any"]] = None
    status: Optional[LeadStatus] = None
    assigned_to_id: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    estimated_value: Optional[float] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    close_reason: Optional[str] = None

# ==================== PCB - POTENTIAL CALLBACKS (RFC-002 Section 4.1.2) ====================

class PCB(BaseModel):
    """Potential Callback per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pcb_number: str = Field(default_factory=lambda: f"PCB-{str(uuid.uuid4())[:8].upper()}")
    
    # Linked records
    lead_id: Optional[str] = None
    job_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    
    # PCB details
    reason: str  # Why a callback is needed
    reason_category: Literal["follow_up", "upsell", "warranty", "complaint", "question", "other"] = "follow_up"
    
    # Status workflow per RFC-002: Created → Assigned → Follow-Up → Converted/Closed
    status: PCBStatus = "created"
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Assignment
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    assigned_owner_id: Optional[str] = None
    assigned_owner_name: Optional[str] = None
    
    # Follow-up scheduling
    follow_up_date: Optional[str] = None
    follow_up_time: Optional[str] = None
    reminder_sent: bool = False
    reminder_count: int = 0
    
    # Resolution
    converted_to_job_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # Metadata
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PCBCreate(BaseModel):
    lead_id: Optional[str] = None
    job_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    reason: str
    reason_category: Literal["follow_up", "upsell", "warranty", "complaint", "question", "other"] = "follow_up"
    assigned_technician_id: Optional[str] = None
    assigned_owner_id: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_time: Optional[str] = None
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    notes: Optional[str] = None

class PCBUpdate(BaseModel):
    reason: Optional[str] = None
    reason_category: Optional[Literal["follow_up", "upsell", "warranty", "complaint", "question", "other"]] = None
    status: Optional[PCBStatus] = None
    assigned_technician_id: Optional[str] = None
    assigned_owner_id: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_time: Optional[str] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    notes: Optional[str] = None
    resolution_notes: Optional[str] = None

# ==================== PROPOSALS (RFC-002 Section 4.1.3) ====================

class ProposalLineItem(BaseModel):
    """Line item in a proposal"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_type: Literal["equipment", "labor", "material", "misc", "discount"] = "equipment"
    
    # Item details
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    
    # Equipment specific
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    warranty_years: Optional[int] = None
    
    # Pricing
    quantity: float = 1
    unit: str = "each"
    unit_price: float = 0
    extended_price: float = 0  # quantity * unit_price
    
    # Cost tracking
    unit_cost: float = 0
    margin_percent: float = 0

class ProposalOption(BaseModel):
    """Good/Better/Best proposal option per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tier: Literal["good", "better", "best"] = "good"
    name: str  # e.g., "Standard System", "High Efficiency", "Premium"
    description: Optional[str] = None
    
    line_items: List[ProposalLineItem] = []
    
    # Pricing summary
    equipment_total: float = 0
    labor_total: float = 0
    materials_total: float = 0
    misc_total: float = 0
    subtotal: float = 0
    discount_amount: float = 0
    tax_amount: float = 0
    total: float = 0
    
    # Financing
    financing_available: bool = False
    monthly_payment: Optional[float] = None
    financing_term_months: Optional[int] = None
    financing_apr: Optional[float] = None
    
    is_recommended: bool = False

class Proposal(BaseModel):
    """Sales proposal per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    proposal_number: str = Field(default_factory=lambda: f"PROP-{str(uuid.uuid4())[:8].upper()}")
    
    # Related records
    lead_id: Optional[str] = None
    job_id: Optional[str] = None
    customer_id: Optional[str] = None
    
    # Customer info
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    site_address: str
    
    # Proposal details
    title: str
    description: Optional[str] = None
    
    # Good/Better/Best options
    options: List[ProposalOption] = []
    selected_option_id: Optional[str] = None
    
    # Status per RFC-002
    status: ProposalStatus = "draft"
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Dates
    valid_until: Optional[str] = None
    sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    
    # Created by
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    
    # Signatures
    customer_signature: Optional[str] = None
    customer_signed_at: Optional[datetime] = None
    
    # Converted
    converted_job_id: Optional[str] = None
    
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProposalCreate(BaseModel):
    lead_id: Optional[str] = None
    job_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    site_address: str
    title: str
    description: Optional[str] = None
    valid_until: Optional[str] = None
    notes: Optional[str] = None

# ==================== JOB TYPES & TEMPLATES (RFC-002 Section 4.2.1) ====================

class ChecklistItemTemplate(BaseModel):
    """Checklist item definition per RFC-002 Section 4.2.2"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order: int = 0
    description: str  # Minimum 10 words recommended
    
    # Required evidence flags
    requires_before_photo: bool = False
    requires_after_photo: bool = False
    requires_note: bool = False
    requires_measurement: bool = False
    requires_signature: bool = False
    
    # Options
    is_required: bool = True
    allow_exception: bool = True  # "Forgot before picture" exception
    exception_requires_reason: bool = True

class JobTypeTemplate(BaseModel):
    """Job type template per RFC-002 Section 4.2.1"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    name: str  # e.g., "Residential AC Install", "Commercial RTU Service"
    category: JobTypeCategory
    description: Optional[str] = None
    
    # Default settings
    default_priority: Literal["low", "normal", "high", "urgent"] = "normal"
    estimated_duration_hours: float = 2.0
    requires_permit: bool = False
    requires_inspection: bool = False
    
    # Pricing defaults
    base_labor_rate: float = 0
    trip_charge: float = 0
    
    # Checklist template
    checklist_items: List[ChecklistItemTemplate] = []
    
    # Version control per RFC-002
    version: int = 1
    is_active: bool = True
    previous_version_id: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobTypeTemplateCreate(BaseModel):
    name: str
    category: JobTypeCategory
    description: Optional[str] = None
    default_priority: Literal["low", "normal", "high", "urgent"] = "normal"
    estimated_duration_hours: float = 2.0
    requires_permit: bool = False
    requires_inspection: bool = False
    base_labor_rate: float = 0
    trip_charge: float = 0
    checklist_items: List[ChecklistItemTemplate] = []

# ==================== EVIDENCE-BASED CHECKLISTS (RFC-002 Section 4.2.2) ====================

class ChecklistItemEvidence(BaseModel):
    """Evidence attached to a checklist item"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    evidence_type: EvidenceType
    
    # Photo evidence
    photo_url: Optional[str] = None
    photo_data: Optional[str] = None  # Base64 for mobile upload
    photo_taken_at: Optional[datetime] = None
    
    # Measurement evidence
    measurement_value: Optional[float] = None
    measurement_unit: Optional[str] = None
    
    # Note evidence
    note_text: Optional[str] = None
    
    # Signature evidence
    signature_data: Optional[str] = None
    signature_name: Optional[str] = None
    
    # Metadata
    captured_by_id: Optional[str] = None
    captured_by_name: Optional[str] = None
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    
    # GPS location
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class JobChecklistItem(BaseModel):
    """Individual checklist item on a job"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_item_id: Optional[str] = None
    order: int = 0
    description: str
    
    # Requirements (from template)
    requires_before_photo: bool = False
    requires_after_photo: bool = False
    requires_note: bool = False
    requires_measurement: bool = False
    requires_signature: bool = False
    is_required: bool = True
    
    # Status per RFC-002: Not Started / In Progress / Done / Exception
    status: Literal["not_started", "in_progress", "completed", "exception"] = "not_started"
    
    # Evidence collected
    evidence: List[ChecklistItemEvidence] = []
    
    # Exception handling per RFC-002 "Forgot before picture"
    has_exception: bool = False
    exception_reason: Optional[str] = None
    exception_approved_by: Optional[str] = None
    
    # Completion
    completed_at: Optional[datetime] = None
    completed_by_id: Optional[str] = None
    completed_by_name: Optional[str] = None

class JobChecklist(BaseModel):
    """Complete checklist for a job"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    
    items: List[JobChecklistItem] = []
    
    # Overall progress
    total_items: int = 0
    completed_items: int = 0
    exception_items: int = 0
    percent_complete: int = 0
    
    # Per RFC-002: Jobs cannot be set to "Complete" until required items satisfied
    can_complete_job: bool = False
    blocking_items: List[str] = []  # IDs of items blocking completion
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== VENDORS & PURCHASE ORDERS (RFC-002 Section 4.7.2) ====================

class Vendor(BaseModel):
    """Vendor/supplier record per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_number: str = Field(default_factory=lambda: f"VND-{str(uuid.uuid4())[:8].upper()}")
    
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    
    # Payment terms
    payment_terms: str = "Net 30"  # e.g., "Net 30", "Net 15", "COD"
    credit_limit: Optional[float] = None
    
    # Catalog
    default_items: List[str] = []  # Item IDs commonly ordered
    
    # Metadata
    account_number: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class VendorCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    payment_terms: str = "Net 30"
    account_number: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrderLineItem(BaseModel):
    """Line item on a purchase order"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    item_name: str
    sku: str
    
    quantity_ordered: int
    quantity_received: int = 0
    unit: str = "each"
    unit_cost: float = 0
    extended_cost: float = 0
    
    # Received tracking
    received_at: Optional[datetime] = None
    received_by_id: Optional[str] = None
    received_to_location: Optional[str] = None  # Warehouse or truck ID

class PurchaseOrder(BaseModel):
    """Purchase order per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    po_number: str = Field(default_factory=lambda: f"PO-{str(uuid.uuid4())[:8].upper()}")
    
    vendor_id: str
    vendor_name: str
    
    # Line items
    line_items: List[PurchaseOrderLineItem] = []
    
    # Totals
    subtotal: float = 0
    tax_amount: float = 0
    shipping_amount: float = 0
    total: float = 0
    
    # Status
    status: POStatus = "draft"
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Dates
    order_date: Optional[str] = None
    expected_date: Optional[str] = None
    received_date: Optional[str] = None
    
    # Receive to location
    receive_to_location_id: Optional[str] = None  # Warehouse or truck
    receive_to_location_name: Optional[str] = None
    
    # Linked records
    job_id: Optional[str] = None
    restock_request_id: Optional[str] = None
    
    notes: Optional[str] = None
    
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    line_items: List[dict] = []  # [{item_id, quantity_ordered, unit_cost}]
    expected_date: Optional[str] = None
    receive_to_location_id: Optional[str] = None
    job_id: Optional[str] = None
    notes: Optional[str] = None

# ==================== WAREHOUSE/LOCATION INVENTORY (RFC-002 Section 4.7.1) ====================

class WarehouseLocation(BaseModel):
    """Warehouse/branch location for multi-location inventory"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    name: str
    location_type: Literal["warehouse", "branch", "truck"] = "warehouse"
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    
    # Manager
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    
    # Settings
    is_primary: bool = False
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LocationInventoryItem(BaseModel):
    """Inventory quantity at a specific location"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: str
    location_name: str
    item_id: str
    item_name: str
    sku: str
    
    quantity: int = 0
    min_threshold: int = 0
    max_threshold: int = 100
    
    # Last activity
    last_counted_at: Optional[datetime] = None
    last_adjusted_at: Optional[datetime] = None
    
    # Serialized items
    serial_numbers: List[str] = []

class InventoryTransfer(BaseModel):
    """Transfer between locations per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transfer_number: str = Field(default_factory=lambda: f"TRF-{str(uuid.uuid4())[:8].upper()}")
    
    from_location_id: str
    from_location_name: str
    to_location_id: str
    to_location_name: str
    
    items: List[dict] = []  # [{item_id, item_name, quantity, serial_numbers}]
    
    status: Literal["pending", "in_transit", "received", "cancelled"] = "pending"
    
    requested_by_id: Optional[str] = None
    requested_by_name: Optional[str] = None
    received_by_id: Optional[str] = None
    received_by_name: Optional[str] = None
    
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    shipped_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    
    notes: Optional[str] = None

# ==================== INVOICES (RFC-002 Section 4.6.1) ====================

class InvoiceLineItem(BaseModel):
    """Invoice line item"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    line_type: Literal["labor", "parts", "trip", "misc", "discount", "tax"] = "parts"
    
    description: str
    sku: Optional[str] = None
    
    quantity: float = 1
    unit: str = "each"
    unit_price: float = 0
    extended_price: float = 0
    
    # Markup tracking per RFC-002 formula
    cost: float = 0
    markup_percent: float = 0

class Invoice(BaseModel):
    """Invoice per RFC-002 Section 4.6.1"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = Field(default_factory=lambda: f"INV-{str(uuid.uuid4())[:8].upper()}")
    
    # Linked records
    job_id: Optional[str] = None
    job_number: Optional[str] = None
    customer_id: Optional[str] = None
    
    # Customer info
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    billing_address: Optional[str] = None
    
    # Line items
    line_items: List[InvoiceLineItem] = []
    
    # Totals per RFC-002 formula: Price = (LaborRate × Hours) + (PartsCost × Markup) + TripFee
    labor_total: float = 0
    parts_total: float = 0
    trip_total: float = 0
    misc_total: float = 0
    subtotal: float = 0
    discount_amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    
    # Status per RFC-002: Draft / Sent / Partially Paid / Paid / Void
    status: InvoiceStatus = "draft"
    status_changed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Payment tracking
    amount_paid: float = 0
    balance_due: float = 0
    
    # Dates
    invoice_date: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"))
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    
    # Notifications per RFC-002
    reminder_sent: bool = False
    past_due_alert_sent: bool = False
    
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InvoiceCreate(BaseModel):
    job_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    billing_address: Optional[str] = None
    line_items: List[dict] = []
    tax_rate: float = 0
    due_date: Optional[str] = None
    notes: Optional[str] = None

# ==================== PAYMENTS (RFC-002 Section 4.6.1) ====================

class Payment(BaseModel):
    """Payment record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    payment_number: str = Field(default_factory=lambda: f"PAY-{str(uuid.uuid4())[:8].upper()}")
    
    invoice_id: str
    invoice_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    
    # Payment details per RFC-002: Card, ACH, check, cash, financing; split payments
    payment_method: Literal["card", "ach", "check", "cash", "financing", "other"] = "card"
    amount: float
    
    # Card details (masked)
    card_last_four: Optional[str] = None
    card_brand: Optional[str] = None
    
    # Check details
    check_number: Optional[str] = None
    
    # Financing
    financing_provider: Optional[str] = None
    financing_reference: Optional[str] = None
    
    # Transaction
    transaction_id: Optional[str] = None
    processed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Status
    status: Literal["pending", "completed", "failed", "refunded"] = "completed"
    
    notes: Optional[str] = None
    
    collected_by_id: Optional[str] = None
    collected_by_name: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentCreate(BaseModel):
    invoice_id: str
    payment_method: Literal["card", "ach", "check", "cash", "financing", "other"] = "card"
    amount: float
    card_last_four: Optional[str] = None
    check_number: Optional[str] = None
    financing_provider: Optional[str] = None
    notes: Optional[str] = None

# ==================== CUSTOMER EQUIPMENT (RFC-002 Section 4.7.4) ====================

class CustomerEquipment(BaseModel):
    """Customer equipment/asset record per RFC-002"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    customer_id: str
    customer_name: Optional[str] = None
    site_address: Optional[str] = None
    
    # Equipment details
    equipment_type: str  # e.g., "AC Unit", "Furnace", "Heat Pump"
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    
    # Location
    location_in_building: Optional[str] = None  # e.g., "Attic", "Basement", "Roof"
    
    # Installation
    install_date: Optional[str] = None
    installed_by_company: Optional[str] = None
    
    # Warranty tracking per RFC-002
    warranty_start_date: Optional[str] = None
    warranty_end_date: Optional[str] = None
    warranty_type: Literal["manufacturer", "extended", "labor", "parts", "full"] = "manufacturer"
    warranty_provider: Optional[str] = None
    warranty_terms: Optional[str] = None
    
    # Status flags per RFC-002
    is_in_warranty: bool = False
    warranty_expiring_soon: bool = False  # Within 30 days
    
    # Service history
    last_service_date: Optional[str] = None
    next_service_date: Optional[str] = None
    service_job_ids: List[str] = []
    
    notes: Optional[str] = None
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerEquipmentCreate(BaseModel):
    customer_id: str
    site_address: Optional[str] = None
    equipment_type: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location_in_building: Optional[str] = None
    install_date: Optional[str] = None
    warranty_start_date: Optional[str] = None
    warranty_end_date: Optional[str] = None
    warranty_type: Literal["manufacturer", "extended", "labor", "parts", "full"] = "manufacturer"
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None

# ==================== SYSTEM SETTINGS (RFC-002 Google Maps Toggle) ====================

class SystemSettings(BaseModel):
    """System-wide settings"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Google Maps integration toggle
    google_maps_enabled: bool = False
    google_maps_api_key_set: bool = False
    
    # AI features toggle
    ai_features_enabled: bool = False
    ai_provider: Literal["gemini", "openai", "claude"] = "gemini"
    ai_model: str = "gemini-2.0-flash"
    ai_failover_enabled: bool = True  # Failover to simple summaries if AI fails
    
    # QuickBooks integration toggle
    quickbooks_enabled: bool = False
    quickbooks_configured: bool = False
    quickbooks_sync_invoices: bool = True
    quickbooks_sync_payments: bool = True
    quickbooks_sync_customers: bool = True
    quickbooks_last_sync: Optional[datetime] = None
    
    # Push notifications
    push_notifications_enabled: bool = True
    push_vapid_public_key: Optional[str] = None
    push_vapid_private_key: Optional[str] = None
    
    # Notification triggers
    notify_on_chat_message: bool = True
    notify_on_job_assignment: bool = True
    notify_on_schedule_change: bool = True
    notify_on_payment_received: bool = True
    
    # Default tax rate
    default_tax_rate: float = 0
    
    # Labor rates
    default_labor_rate: float = 95.0
    overtime_multiplier: float = 1.5
    
    # Trip charges
    default_trip_charge: float = 89.0
    
    # Parts markup
    default_parts_markup: float = 1.35  # 35% markup
    
    # Scheduling
    default_job_duration_hours: float = 2.0
    buffer_time_percent: float = 15  # 15% buffer per RFC-002
    
    # Stock check
    require_shift_start_stock_check: bool = True
    require_shift_end_stock_check: bool = False
    
    # Customer portal
    customer_portal_enabled: bool = True
    allow_customer_scheduling: bool = True
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by_id: Optional[str] = None

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

# ==================== ROUTING & MAPS ====================

class RouteCalculation(BaseModel):
    """Calculated route between two points"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    origin_address: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_address: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    
    # Calculated values
    distance_meters: int = 0
    distance_miles: float = 0
    duration_seconds: int = 0
    duration_minutes: float = 0
    duration_in_traffic_seconds: Optional[int] = None
    duration_in_traffic_minutes: Optional[float] = None
    
    # Route details
    polyline: Optional[str] = None  # Encoded polyline for map display
    summary: Optional[str] = None  # Route summary (e.g., "via I-35 N")
    warnings: List[str] = []
    
    # Metadata
    calculated_at: datetime = Field(default_factory=datetime.utcnow)
    api_status: str = "OK"

class RouteRequest(BaseModel):
    origin: str  # Address or "lat,lng"
    destination: str
    departure_time: Optional[str] = None  # ISO format for traffic

# ==================== MAINTENANCE AGREEMENTS ====================

class MaintenanceAgreementTemplate(BaseModel):
    """Template for maintenance agreement types"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Annual HVAC Maintenance", "Quarterly Service"
    description: Optional[str] = None
    frequency: Literal["monthly", "quarterly", "semi_annual", "annual"]
    visits_per_year: int = 1
    
    # Pricing
    base_price: float = 0
    price_per_unit: float = 0  # For multiple units
    
    # Included services
    included_services: List[str] = []  # e.g., ["Filter replacement", "Coil cleaning"]
    
    # Parts coverage
    parts_discount_percent: float = 0  # e.g., 10% off parts
    labor_discount_percent: float = 0
    priority_response: bool = False  # Priority scheduling
    
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MaintenanceAgreement(BaseModel):
    """Active maintenance agreement with a customer"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agreement_number: str = Field(default_factory=lambda: f"MA-{str(uuid.uuid4())[:8].upper()}")
    
    # Customer info
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    service_address: str
    
    # Template reference
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    frequency: Literal["monthly", "quarterly", "semi_annual", "annual"]
    
    # Equipment covered
    equipment: List[dict] = []  # [{type, model, serial_number, location}]
    
    # Dates
    start_date: str
    end_date: str
    next_service_date: Optional[str] = None
    last_service_date: Optional[str] = None
    
    # Pricing
    annual_price: float = 0
    payment_frequency: Literal["monthly", "quarterly", "annual"] = "annual"
    
    # Status
    status: Literal["active", "pending", "expired", "cancelled"] = "active"
    auto_renew: bool = True
    renewal_reminder_sent: bool = False
    
    # Generated jobs
    generated_job_ids: List[str] = []
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MaintenanceAgreementCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    service_address: str
    template_id: Optional[str] = None
    frequency: Literal["monthly", "quarterly", "semi_annual", "annual"] = "annual"
    equipment: List[dict] = []
    start_date: str
    end_date: Optional[str] = None  # Auto-calculate if not provided
    annual_price: float = 0
    payment_frequency: Literal["monthly", "quarterly", "annual"] = "annual"
    auto_renew: bool = True
    notes: Optional[str] = None

# ==================== GANTT / PROJECT MANAGEMENT ====================

class ProjectPhase(BaseModel):
    """Phase within a multi-day install project"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: str
    duration_days: int = 1
    
    # Dependencies
    depends_on: List[str] = []  # Phase IDs this depends on
    
    # Assignment
    assigned_technician_ids: List[str] = []
    
    # Status
    status: Literal["not_started", "in_progress", "completed", "blocked"] = "not_started"
    percent_complete: int = 0
    
    # Milestones
    milestones: List[dict] = []  # [{name, date, completed}]
    
    # Tasks within phase
    task_ids: List[str] = []
    
    color: Optional[str] = None  # For Gantt display
    notes: Optional[str] = None

class InstallProject(BaseModel):
    """Multi-day install project with Gantt tracking"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_number: str = Field(default_factory=lambda: f"PRJ-{str(uuid.uuid4())[:8].upper()}")
    job_id: str  # Link to parent job
    
    name: str
    description: Optional[str] = None
    
    # Customer
    customer_name: str
    site_address: str
    
    # Timeline
    planned_start_date: str
    planned_end_date: str
    actual_start_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    
    # Phases
    phases: List[ProjectPhase] = []
    
    # Resources
    assigned_technician_ids: List[str] = []
    equipment_required: List[dict] = []  # [{item_id, quantity}]
    
    # Budget
    estimated_hours: float = 0
    actual_hours: float = 0
    estimated_cost: float = 0
    actual_cost: float = 0
    
    # Status
    status: Literal["planning", "scheduled", "in_progress", "completed", "on_hold", "cancelled"] = "planning"
    percent_complete: int = 0
    
    # Billing milestones
    billing_milestones: List[dict] = []  # [{name, percent, amount, invoiced}]
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InstallProjectCreate(BaseModel):
    job_id: str
    name: str
    description: Optional[str] = None
    customer_name: str
    site_address: str
    planned_start_date: str
    planned_end_date: str
    estimated_hours: float = 0
    estimated_cost: float = 0
    notes: Optional[str] = None

class ProjectPhaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: str
    depends_on: List[str] = []
    assigned_technician_ids: List[str] = []
    color: Optional[str] = None

# ==================== CUSTOMER PORTAL ====================

class CustomerAccount(BaseModel):
    """Customer account for self-service portal"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: Optional[str] = None  # Hashed password
    
    # Profile
    name: str
    phone: Optional[str] = None
    addresses: List[dict] = []  # [{address, is_primary}]
    
    # Authentication
    email_verified: bool = False
    verification_token: Optional[str] = None
    verification_token_expires: Optional[datetime] = None
    magic_link_token: Optional[str] = None
    magic_link_expires: Optional[datetime] = None
    
    # Session
    last_login: Optional[datetime] = None
    
    # Preferences
    notification_preferences: dict = {
        "email_reminders": True,
        "sms_reminders": False,
        "marketing": False
    }
    
    # Status
    status: Literal["active", "inactive", "suspended"] = "active"
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerAccountCreate(BaseModel):
    email: str
    password: Optional[str] = None  # Optional if using magic link
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None

class CustomerLogin(BaseModel):
    email: str
    password: Optional[str] = None

class MagicLinkRequest(BaseModel):
    email: str

class ServiceRequest(BaseModel):
    """Customer service request from portal"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_number: str = Field(default_factory=lambda: f"SR-{str(uuid.uuid4())[:8].upper()}")
    
    customer_id: str
    customer_name: str
    customer_email: str
    
    # Request details
    service_type: Literal["repair", "maintenance", "installation", "inspection", "other"]
    description: str
    urgency: Literal["low", "normal", "high", "emergency"] = "normal"
    
    # Preferred times
    preferred_dates: List[str] = []  # ISO date strings
    preferred_time_of_day: Literal["morning", "afternoon", "evening", "anytime"] = "anytime"
    
    # Location
    service_address: str
    access_instructions: Optional[str] = None
    
    # Status
    status: Literal["pending", "confirmed", "scheduled", "completed", "cancelled"] = "pending"
    assigned_job_id: Optional[str] = None
    
    # Communication
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ServiceRequestCreate(BaseModel):
    service_type: Literal["repair", "maintenance", "installation", "inspection", "other"]
    description: str
    urgency: Literal["low", "normal", "high", "emergency"] = "normal"
    preferred_dates: List[str] = []
    preferred_time_of_day: Literal["morning", "afternoon", "evening", "anytime"] = "anytime"
    service_address: str
    access_instructions: Optional[str] = None

# ==================== OFFLINE SYNC ====================

class OfflineSyncQueue(BaseModel):
    """Queue item for offline sync"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Client info
    client_id: str  # Device/browser identifier
    user_id: Optional[str] = None
    user_type: Literal["technician", "customer", "admin"] = "technician"
    
    # Operation
    operation: Literal["create", "update", "delete"]
    entity_type: str  # e.g., "job", "task", "time_entry"
    entity_id: Optional[str] = None
    
    # Data
    payload: dict = {}  # The data to sync
    
    # Timestamps
    client_timestamp: datetime  # When action was taken offline
    server_received_at: Optional[datetime] = None
    
    # Conflict resolution
    status: Literal["pending", "synced", "conflict", "failed"] = "pending"
    conflict_type: Optional[Literal["version_mismatch", "deleted", "concurrent_edit"]] = None
    conflict_data: Optional[dict] = None  # Server version if conflict
    resolution: Optional[Literal["client_wins", "server_wins", "merged", "manual"]] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    
    # Retry tracking
    retry_count: int = 0
    last_error: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SyncBatch(BaseModel):
    """Batch of offline changes to sync"""
    client_id: str
    user_id: Optional[str] = None
    user_type: Literal["technician", "customer", "admin"] = "technician"
    changes: List[dict]  # List of {operation, entity_type, entity_id, payload, client_timestamp}

class ConflictResolution(BaseModel):
    """Resolution for a sync conflict"""
    queue_id: str
    resolution: Literal["client_wins", "server_wins", "merged", "manual"]
    merged_data: Optional[dict] = None  # If resolution is "merged"

class SyncStatus(BaseModel):
    """Status of sync operations for a client"""
    client_id: str
    pending_count: int = 0
    synced_count: int = 0
    conflict_count: int = 0
    failed_count: int = 0
    last_sync: Optional[datetime] = None
    conflicts: List[dict] = []  # List of unresolved conflicts


# ==================== MILESTONE TEMPLATES ====================

class BillingMilestone(BaseModel):
    """Individual billing milestone within a template"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Deposit", "Rough-In Complete", "Final Payment"
    percentage: float  # Percentage of total project cost
    description: Optional[str] = None
    trigger: Literal["manual", "phase_complete", "project_start", "project_complete"] = "manual"
    trigger_phase_id: Optional[str] = None  # If trigger is phase_complete

class MilestoneTemplate(BaseModel):
    """Predefined template for billing milestones"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Standard Install 30/40/30"
    description: Optional[str] = None
    milestones: List[BillingMilestone] = []
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MilestoneTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    milestones: List[dict] = []  # [{name, percentage, description, trigger}]
    is_default: bool = False

class ProjectBillingMilestone(BaseModel):
    """Actual billing milestone instance on a project"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_milestone_id: Optional[str] = None  # Reference to template
    name: str
    percentage: float
    amount: float  # Calculated from project total
    description: Optional[str] = None
    
    # Status
    status: Literal["pending", "ready_to_bill", "invoiced", "paid"] = "pending"
    
    # Invoice linkage
    invoice_id: Optional[str] = None
    invoiced_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    
    # Trigger
    trigger: str = "manual"
    trigger_phase_id: Optional[str] = None
    triggered_at: Optional[datetime] = None

# ==================== RESCHEDULE REQUESTS ====================

class RescheduleRequest(BaseModel):
    """Customer request to reschedule an appointment"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_number: str = Field(default_factory=lambda: f"RSC-{str(uuid.uuid4())[:8].upper()}")
    
    # Job reference
    job_id: str
    job_number: str
    
    # Customer info
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: Optional[str] = None
    
    # Original schedule
    original_date: str
    original_time: Optional[str] = None
    
    # Requested new schedule
    requested_date: str
    requested_time_preference: Optional[str] = None  # "morning", "afternoon", "evening", or specific time
    
    # Reason
    reason: Optional[str] = None
    
    # Status
    status: Literal["pending", "approved", "rejected", "cancelled"] = "pending"
    
    # Dispatcher response
    approved_date: Optional[str] = None
    approved_time: Optional[str] = None
    rejection_reason: Optional[str] = None
    processed_by_id: Optional[str] = None
    processed_at: Optional[datetime] = None
    
    # Notes
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RescheduleRequestCreate(BaseModel):
    job_id: str
    requested_date: str
    requested_time_preference: Optional[str] = None
    reason: Optional[str] = None

class SupportRequest(BaseModel):
    """Customer support/service request from portal"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_number: str = Field(default_factory=lambda: f"SUP-{str(uuid.uuid4())[:8].upper()}")
    
    # Customer info
    customer_id: str
    customer_name: str
    customer_email: str
    
    # Request details
    request_type: Literal["service", "repair", "maintenance", "question", "complaint", "other"] = "service"
    subject: str
    description: str
    
    # Location
    service_address: Optional[str] = None
    
    # Equipment (if applicable)
    equipment_id: Optional[str] = None
    equipment_type: Optional[str] = None
    
    # Urgency
    priority: Literal["low", "normal", "high", "emergency"] = "normal"
    
    # Status
    status: Literal["new", "reviewed", "scheduled", "in_progress", "resolved", "closed"] = "new"
    
    # Response
    assigned_to_id: Optional[str] = None
    job_id: Optional[str] = None  # If converted to job
    response_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SupportRequestCreate(BaseModel):
    request_type: str = "service"
    subject: str
    description: str
    service_address: Optional[str] = None
    equipment_id: Optional[str] = None
    priority: str = "normal"


# ==================== JOB CHAT ====================

class ChatMessage(BaseModel):
    """Chat message in a job conversation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    channel: Literal["internal", "customer"] = "internal"  # internal = office/tech only, customer = includes customer
    
    # Sender
    sender_id: str
    sender_name: str
    sender_role: str  # "admin", "dispatcher", "technician", "customer"
    sender_avatar_url: Optional[str] = None
    
    # Message content
    message_type: Literal["text", "image", "system"] = "text"
    content: str
    image_url: Optional[str] = None  # For image messages
    
    # Metadata
    is_read: bool = False
    read_by: List[str] = []  # User IDs who have read
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatThread(BaseModel):
    """Chat thread for a job"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    channel: Literal["internal", "customer"] = "internal"
    
    # Participants
    participants: List[dict] = []  # [{user_id, name, role, joined_at}]
    
    # Message count
    message_count: int = 0
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    
    # Status
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ==================== MULTI-WAREHOUSE INVENTORY ====================

class InventoryLocation(BaseModel):
    """Inventory storage location (warehouse, truck, etc.)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location_type: Literal["warehouse", "truck", "satellite", "vendor"] = "warehouse"
    
    # Address (for warehouses/satellites)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    
    # For trucks
    truck_id: Optional[str] = None
    assigned_technician_id: Optional[str] = None
    
    # Contact
    manager_name: Optional[str] = None
    phone: Optional[str] = None
    
    # Status
    is_active: bool = True
    is_primary: bool = False  # Primary warehouse
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LocationInventory(BaseModel):
    """Inventory stock at a specific location"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: str
    item_id: str  # Reference to inventory_items
    
    # Stock levels
    quantity_on_hand: int = 0
    quantity_reserved: int = 0  # Reserved for jobs
    quantity_available: int = 0  # on_hand - reserved
    
    # Thresholds
    min_quantity: int = 0
    max_quantity: int = 100
    reorder_point: int = 0
    
    # Cost tracking
    average_cost: float = 0
    total_value: float = 0
    
    last_counted_at: Optional[datetime] = None
    last_restocked_at: Optional[datetime] = None
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryTransfer(BaseModel):
    """Transfer of inventory between locations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transfer_number: str = Field(default_factory=lambda: f"TRF-{str(uuid.uuid4())[:8].upper()}")
    
    # Locations
    from_location_id: str
    from_location_name: str
    to_location_id: str
    to_location_name: str
    
    # Items
    items: List[dict] = []  # [{item_id, item_name, quantity, unit_cost}]
    
    # Status
    status: Literal["pending", "in_transit", "received", "cancelled"] = "pending"
    
    # People
    requested_by_id: str
    requested_by_name: str
    approved_by_id: Optional[str] = None
    received_by_id: Optional[str] = None
    
    # Dates
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryMovement(BaseModel):
    """Record of inventory movement/transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: str
    item_id: str
    
    # Movement details
    movement_type: Literal["receipt", "issue", "transfer_in", "transfer_out", "adjustment", "count"] = "receipt"
    quantity: int  # Positive for additions, negative for removals
    
    # Reference
    reference_type: Optional[str] = None  # "job", "transfer", "purchase_order", "manual"
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    
    # Before/after
    quantity_before: int = 0
    quantity_after: int = 0
    
    # Who and when
    performed_by_id: str
    performed_by_name: str
    performed_at: datetime = Field(default_factory=datetime.utcnow)
    
    notes: Optional[str] = None
