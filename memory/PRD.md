# BreezeFlow 2.0 - HVAC Field Service Management System

## Original Problem Statement
Build a modern HVAC field service management system per RFC-002 with:
- Jira-style jobs board with draggable task cards across configurable statuses
- Technician profiles with images and relevant information
- Appointment confirmation pages for customers with technician info
- Role-based dashboards for Owner/GM, Dispatcher, Technician, and Sales
- Mobile-first technician UI with dual clock-in system
- J-Load calculator for HVAC sizing
- Truck inventory management with stock checks and audit trails
- Equipment usage tracking on job completion
- Lead-to-cash workflow with leads, PCBs, and Good/Better/Best proposals
- Evidence-based checklists with photo requirements
- Maintenance agreements with auto-scheduling
- Customer self-service portal

## User Personas
1. **Owner/GM**: Needs revenue metrics, business health KPIs, and team overview
2. **Dispatcher**: Needs to assign jobs, manage technician schedules, view urgent items
3. **Technician**: Needs mobile-friendly job management, time tracking, inventory access
4. **Sales**: Needs lead tracking, quote management, opportunity pipeline
5. **Accountant**: Needs invoicing, payments, and financial reports
6. **Lead Tech/Crew Chief**: Additional oversight capabilities for field teams

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

### RFC-002 Phase 1 - Core Data Models & Backend Foundation (Completed Mar 2, 2026)
- [x] Enhanced RBAC with 8 system roles: admin, owner, manager, dispatcher, technician, lead_tech, accountant, sales
- [x] System Settings API with configurable defaults
- [x] Google Maps integration toggle (configurable boolean, disabled when no API key)
- [x] AI features toggle
- [x] Job Type Templates with version control
- [x] Evidence-based checklist templates (before/after photos, notes, measurements, signatures)
- [x] Vendor management with payment terms
- [x] Purchase order management
- [x] Multi-location inventory model (warehouses, branches, trucks)
- [x] Invoice model with RFC-002 pricing formula
- [x] Payment model (card, ACH, check, cash, financing)
- [x] Customer equipment tracking with warranty management

### RFC-002 Phase 2 - Leads, PCBs & Sales Pipeline (Completed Mar 2, 2026)
- [x] Lead management with status workflow: New → Contacted → Qualified → Quoted → Won/Lost
- [x] Lead metrics (total, by status, by source, conversion rate)
- [x] Lead conversion to customer
- [x] PCB (Potential Callback) management with workflow: Created → Assigned → Follow-Up → Converted/Closed
- [x] PCB metrics with overdue tracking
- [x] PCB conversion to job
- [x] Good/Better/Best proposal system
- [x] Proposal options with line items
- [x] Proposal acceptance and job creation
- [x] Frontend pages for Leads, PCBs, Proposals
- [x] Settings page with tabs for General, Integrations, Pricing, Scheduling, Roles

### Previously Implemented Features (Backend Ready)
- [x] Google Maps route calculation (backend ready, requires API key)
- [x] Gantt chart for install projects
- [x] Maintenance agreements with auto-scheduling
- [x] Customer self-service portal
- [x] Offline sync mechanism

## API Endpoints

### System Settings (RFC-002)
- `GET /api/system/settings` - Get system settings (Google Maps toggle, AI toggle, default rates)
- `PUT /api/system/settings` - Update system settings

### RBAC (RFC-002 Section 4.9)
- `GET /api/roles` - Get all system roles (8 predefined)
- `POST /api/roles` - Create custom role
- `DELETE /api/roles/{id}` - Delete custom role

### Leads (RFC-002 Section 4.1.1)
- `GET /api/leads` - Get leads with filtering (status, source, assigned_to, search)
- `GET /api/leads/metrics` - Get lead metrics
- `GET /api/leads/{id}` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/{id}` - Update lead (status workflow)
- `POST /api/leads/{id}/convert` - Convert lead to customer
- `DELETE /api/leads/{id}` - Delete lead

### PCBs - Potential Callbacks (RFC-002 Section 4.1.2)
- `GET /api/pcbs` - Get PCBs with filtering
- `GET /api/pcbs/metrics` - Get PCB metrics (overdue count, conversion rate)
- `GET /api/pcbs/{id}` - Get single PCB
- `POST /api/pcbs` - Create PCB
- `PUT /api/pcbs/{id}` - Update PCB status
- `POST /api/pcbs/{id}/convert` - Convert PCB to job
- `DELETE /api/pcbs/{id}` - Delete PCB

### Proposals (RFC-002 Section 4.1.3)
- `GET /api/proposals` - Get proposals with filtering
- `GET /api/proposals/metrics` - Get proposal metrics (win rate, open quotes)
- `GET /api/proposals/{id}` - Get single proposal
- `POST /api/proposals` - Create proposal
- `PUT /api/proposals/{id}` - Update proposal
- `POST /api/proposals/{id}/options` - Add Good/Better/Best option
- `POST /api/proposals/{id}/accept` - Accept proposal and create job

### Job Types & Templates (RFC-002 Section 4.2.1)
- `GET /api/job-types` - Get job type templates (4 defaults with checklists)
- `POST /api/job-types` - Create custom job type
- `PUT /api/job-types/{id}` - Update job type (versioned)

### Job Checklists (RFC-002 Section 4.2.2)
- `GET /api/jobs/{id}/checklist` - Get job checklist
- `POST /api/jobs/{id}/checklist` - Create checklist from template
- `PUT /api/jobs/{id}/checklist/items/{item_id}` - Update checklist item (add evidence, mark complete)

### Vendors (RFC-002 Section 4.7.2)
- `GET /api/vendors` - Get vendors
- `GET /api/vendors/{id}` - Get single vendor
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/{id}` - Update vendor

### Purchase Orders (RFC-002 Section 4.7.2)
- `GET /api/purchase-orders` - Get POs
- `GET /api/purchase-orders/{id}` - Get single PO
- `POST /api/purchase-orders` - Create PO
- `PUT /api/purchase-orders/{id}/status` - Update PO status

### Invoices (RFC-002 Section 4.6.1)
- `GET /api/invoices` - Get invoices
- `GET /api/invoices/{id}` - Get single invoice
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/{id}/status` - Update invoice status

### Payments (RFC-002 Section 4.6.1)
- `GET /api/payments` - Get payments
- `POST /api/payments` - Record payment

### Customer Equipment (RFC-002 Section 4.7.4)
- `GET /api/customer-equipment` - Get equipment (with warranty expiring filter)
- `GET /api/customer-equipment/{id}` - Get single equipment
- `POST /api/customer-equipment` - Create equipment record

## Data Models (RFC-002)

### Lead
```
{id, lead_number, contact_name, contact_email, contact_phone, company_name, address, city, state, zip_code, source, status (new/contacted/qualified/quoted/won/lost), assigned_to_id, estimated_value, priority, tags[]}
```

### PCB (Potential Callback)
```
{id, pcb_number, lead_id, job_id, customer_id, customer_name, reason, reason_category (follow_up/upsell/warranty/complaint/question/other), status (created/assigned/follow_up/converted/closed), assigned_technician_id, follow_up_date, priority}
```

### Proposal
```
{id, proposal_number, lead_id, customer_name, site_address, title, options[], status (draft/sent/viewed/accepted/rejected/expired), valid_until}
```

### ProposalOption (Good/Better/Best)
```
{id, tier (good/better/best), name, description, line_items[], equipment_total, labor_total, subtotal, total, is_recommended}
```

### JobTypeTemplate
```
{id, name, category (residential_service/residential_install/commercial_service/commercial_install), checklist_items[], version, is_active}
```

### ChecklistItemTemplate
```
{id, order, description, requires_before_photo, requires_after_photo, requires_note, requires_measurement, requires_signature, is_required}
```

### Invoice
```
{id, invoice_number, job_id, customer_name, line_items[], labor_total, parts_total, trip_total, subtotal, tax_amount, total, status (draft/sent/partially_paid/paid/void), balance_due}
```

### Vendor
```
{id, vendor_number, name, contact_name, email, phone, address, payment_terms, is_active}
```

### CustomerEquipment
```
{id, customer_id, equipment_type, manufacturer, model, serial_number, install_date, warranty_end_date, is_in_warranty, warranty_expiring_soon}
```

## Prioritized Backlog

### P0 - Critical (DONE)
- [x] Dual clock-in system 
- [x] Mobile technician dashboard 
- [x] Truck inventory management 
- [x] Leads, PCBs, Proposals (RFC-002 Phase 2)

### P1 - High Priority
- [ ] Route & travel time calculation (needs Google Maps API key)
- [ ] AI feature implementation (smart scheduling, job summaries)
- [ ] Basic authentication/login system
- [ ] Frontend for evidence-based checklists on jobs

### P2 - Medium Priority
- [ ] Frontend for Gantt-style board (backend ready)
- [ ] Frontend for maintenance agreements (backend ready)
- [ ] Frontend for customer portal (backend ready)
- [ ] Invoice & payment UI
- [ ] Vendor & PO management UI

### P3 - Lower Priority
- [ ] Install project billing (milestone-based)
- [ ] Import wizards for data onboarding
- [ ] Ad-hoc reporting builder
- [ ] Multi-warehouse inventory support
- [ ] Change order management

## Known Limitations
1. **Google Maps**: Backend ready but disabled - requires GOOGLE_MAPS_API_KEY in backend/.env
2. **J-Load Calculations**: Uses simplified BTU/sq ft formulas, not full ACCA Manual J software
3. **Authentication**: No user login implemented yet (demo mode with role switching)
4. **AI Features**: Toggle exists but features not implemented

## File Structure
```
/app/
├── backend/
│   ├── models.py (2000+ lines - all data models including RFC-002)
│   ├── server.py (5200+ lines - all API endpoints)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── technician/
│   │   │   ├── kanban/
│   │   │   ├── ui/ (Shadcn components)
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── api.ts (2000+ lines - all API functions)
│   │   └── pages/
│   │       ├── Index.tsx (Dashboard)
│   │       ├── Jobs.tsx / JobDetail.tsx
│   │       ├── Leads.tsx (RFC-002)
│   │       ├── Proposals.tsx (RFC-002)
│   │       ├── Settings.tsx (RFC-002)
│   │       ├── GanttChart.tsx
│   │       ├── CustomerPortal.tsx
│   │       ├── MaintenanceAgreements.tsx
│   │       └── ...
│   └── package.json
├── memory/
│   └── PRD.md (this file)
└── test_reports/
    └── iteration_3.json
```

## Last Updated
March 2, 2026 - RFC-002 Phases 1 & 2 complete (RBAC, Settings, Leads, PCBs, Proposals)
