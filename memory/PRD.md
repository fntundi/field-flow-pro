# BreezeFlow 2.0 - HVAC Field Service Management System

## Original Problem Statement
Build a modern HVAC field service management system with:
- Jira-style jobs board with draggable task cards across configurable statuses
- Technician profiles with images and relevant information
- Appointment confirmation pages for customers with technician info
- Role-based dashboards for Owner/GM, Dispatcher, Technician, and Sales
- Mobile-first technician UI with dual clock-in system
- J-Load calculator for HVAC sizing
- Truck inventory management with stock checks and audit trails
- Equipment usage tracking on job completion

## User Personas
1. **Owner/GM**: Needs revenue metrics, business health KPIs, and team overview
2. **Dispatcher**: Needs to assign jobs, manage technician schedules, view urgent items
3. **Technician**: Needs mobile-friendly job management, time tracking, inventory access
4. **Sales**: Needs lead tracking, quote management, opportunity pipeline

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI (Python 3.11), Pydantic
- **Database**: MongoDB (via Motor async driver)
- **State Management**: React Query

## Core Features Implemented

### Phase 1 - Foundation (Completed)
- [x] Jira-style jobs board with drag-and-drop tasks
- [x] Technician profiles with image upload
- [x] Role-based dashboards
- [x] Breadcrumb navigation
- [x] Mobile-responsive layout with collapsible sidebar
- [x] Appointment confirmation page for customers
- [x] Comprehensive demo data seeding
- [x] AI features toggle (admin only)

### Phase 2 - Technician Mobile Experience (Completed Mar 2, 2026)
- [x] Dual clock-in system (shift + job-level)
- [x] Mobile-first technician dashboard
- [x] J-Load Quick Estimate calculator
- [x] Manual J calculation framework
- [x] Truck management (assignment, status)
- [x] Truck inventory with categories
- [x] Shift-start stock check requirement
- [x] Auto-generated restock requests (threshold-based)
- [x] Manual restock requests
- [x] Equipment usage tracking on job completion
- [x] Tech approval of equipment actually used
- [x] Automatic inventory deduction from truck
- [x] Audit trail linking usage to jobs

## API Endpoints

### Time Tracking
- `POST /api/time-tracking/shift/start` - Start shift with location
- `POST /api/time-tracking/shift/end` - End shift
- `GET /api/time-tracking/shift/active/{tech_id}` - Get active shift
- `POST /api/time-tracking/job/dispatch` - Dispatch to job
- `POST /api/time-tracking/job/arrive/{entry_id}` - Arrive at job
- `POST /api/time-tracking/job/complete/{entry_id}` - Complete job
- `GET /api/time-tracking/metrics/{tech_id}` - Get technician metrics

### Inventory Management
- `GET /api/inventory/categories` - Get all categories (10 standard + custom)
- `POST /api/inventory/categories` - Create custom category
- `GET /api/inventory/items` - Get all inventory items
- `POST /api/inventory/items` - Create new item
- `PUT /api/inventory/items/{id}` - Update item
- `GET /api/inventory/audit-log` - Get audit trail

### Truck Management
- `GET /api/trucks` - Get all trucks
- `GET /api/trucks/{id}` - Get truck details
- `GET /api/trucks/by-technician/{tech_id}` - Get tech's assigned truck
- `POST /api/trucks` - Create truck
- `PUT /api/trucks/{id}` - Update truck
- `GET /api/truck-inventory/{truck_id}` - Get truck inventory
- `POST /api/truck-inventory/{truck_id}/add-item` - Add item to truck

### Stock Check & Restock
- `GET /api/stock-check/required/{tech_id}` - Check if stock check needed
- `POST /api/stock-check` - Submit stock check
- `GET /api/stock-checks` - Get stock check history
- `GET /api/restock-requests` - Get restock requests
- `POST /api/restock-requests` - Create manual restock
- `PUT /api/restock-requests/{id}/status` - Update restock status

### J-Load Calculator
- `POST /api/jload/quick-estimate` - Quick BTU/tonnage estimate
- `POST /api/jload/manual-j` - Create Manual J draft
- `GET /api/jload/manual-j/{id}` - Get Manual J calculation
- `PUT /api/jload/manual-j/{id}` - Update calculation data
- `POST /api/jload/manual-j/{id}/calculate` - Run full calculation
- `GET /api/jload/by-job/{job_id}` - Get calculations for job

### Equipment Usage
- `POST /api/jobs/{job_id}/equipment-usage` - Create usage record
- `GET /api/jobs/{job_id}/equipment-usage` - Get usage for job
- `POST /api/jobs/{job_id}/equipment-usage/approve` - Tech approval

## Data Models

### Inventory Category
```
{id, name, description, is_standard, icon, sort_order}
```

### Inventory Item
```
{id, sku, name, description, category_id, unit, unit_cost, retail_price, min_stock_threshold, is_serialized}
```

### Truck
```
{id, truck_number, name, vin, make, model, year, license_plate, assigned_technician_id, status}
```

### Truck Inventory
```
{id, truck_id, technician_id, items[], last_stock_check, stock_check_required}
```

### Stock Check
```
{id, truck_id, technician_id, check_type, items_checked[], items_below_threshold[], status}
```

### Restock Request
```
{id, truck_id, request_type (auto/manual), items[], priority, status, approved_by}
```

### Job Equipment Usage
```
{id, job_id, technician_id, truck_id, planned_items[], actual_items[], tech_approved, inventory_deducted}
```

### Inventory Audit Log
```
{id, truck_id, item_id, action, quantity_before, quantity_change, quantity_after, job_id, performed_by_id}
```

### J-Load Quick Estimate
```
{id, job_id, square_footage, climate_zone, building_type, cooling_btuh, heating_btuh, recommended_tonnage}
```

## Prioritized Backlog

### P0 - Critical
- [x] Dual clock-in system (DONE)
- [x] Mobile technician dashboard (DONE)
- [x] Truck inventory management (DONE)
- [ ] Route & travel time calculation (needs mapping API integration)

### P1 - High Priority
- [ ] AI feature implementation (smart scheduling, job summaries)
- [ ] Basic authentication/login system
- [ ] Customer-facing job status tracking

### P2 - Medium Priority
- [ ] Gantt-style board for multi-day installs
- [ ] Recurring maintenance & agreements
- [ ] Deeper accounting integration
- [ ] Offline conflict resolution
- [ ] Customer self-service portal

### P3 - Lower Priority
- [ ] Install project billing (milestone-based)
- [ ] Import wizards for data onboarding
- [ ] Ad-hoc reporting builder
- [ ] Multi-warehouse inventory support
- [ ] Vendor management

## Known Limitations / Mocked Features
1. **Route Estimation**: Uses Haversine distance formula with average speed, not actual routing API
2. **J-Load Calculations**: Uses simplified BTU/sq ft formulas, not full ACCA Manual J software
3. **Authentication**: No user login implemented yet (demo mode with role switching)

## Demo Data
Seed data includes:
- 6 technicians with varied specialties
- 8+ jobs across service and install types
- 4 trucks assigned to technicians
- 14 inventory items across 10 categories
- Stock levels randomized around thresholds

## File Structure
```
/app/
├── backend/
│   ├── models.py (830+ lines - all data models)
│   ├── server.py (2700+ lines - all API endpoints)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── technician/
│   │   │   │   ├── TechnicianMobileDashboard.tsx
│   │   │   │   └── EquipmentApprovalSheet.tsx
│   │   │   ├── kanban/
│   │   │   ├── ui/ (Shadcn components)
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   └── Breadcrumbs.tsx
│   │   ├── lib/
│   │   │   └── api.ts (780+ lines - all API functions)
│   │   └── pages/
│   │       ├── Index.tsx (Dashboard)
│   │       ├── Jobs.tsx
│   │       ├── JobDetail.tsx (Kanban)
│   │       ├── Technicians.tsx
│   │       ├── TechnicianDetail.tsx
│   │       ├── CallIntake.tsx
│   │       └── AppointmentConfirmation.tsx
│   └── package.json
├── memory/
│   └── PRD.md (this file)
└── test_reports/
    └── iteration_1.json
```

## Last Updated
March 2, 2026 - Phase 2 complete (inventory, mobile dashboard, J-Load)
