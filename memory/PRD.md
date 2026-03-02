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
- **Authentication**: JWT + Google OAuth
- **AI Features**: Gemini 3 Flash for job summaries, scheduling suggestions, predictive maintenance
- **Data Import**: CSV import wizards for customers, leads, jobs, inventory, equipment

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
- **Authentication**: JWT (PyJWT, passlib) + Emergent Google OAuth
- **AI**: Gemini 2.0 Flash via emergentintegrations library

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

### Phase 2 - Technician Mobile Experience (Completed)
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

### RFC-002 Phase 1 - Core Data Models & Backend Foundation (Completed)
- [x] Enhanced RBAC with 8 system roles
- [x] System Settings API with configurable defaults
- [x] Google Maps integration toggle (configurable boolean, disabled when no API key)
- [x] AI features toggle
- [x] Job Type Templates with version control
- [x] Evidence-based checklist templates
- [x] Vendor management with payment terms
- [x] Purchase order management
- [x] Multi-location inventory model
- [x] Invoice model with RFC-002 pricing formula
- [x] Payment model (card, ACH, check, cash, financing)
- [x] Customer equipment tracking with warranty management

### RFC-002 Phase 2 - Leads, PCBs & Sales Pipeline (Completed)
- [x] Lead management with status workflow
- [x] Lead metrics and conversion
- [x] PCB (Potential Callback) management
- [x] Good/Better/Best proposal system
- [x] Frontend pages for Leads, PCBs, Proposals
- [x] Settings page with configuration tabs

### RFC-002 Phase 3 - Authentication & AI (Completed Mar 2, 2026)
- [x] **JWT Authentication**: Register, login, password change, user management
- [x] **Google OAuth**: Emergent-managed Google social login
- [x] **Auth Context**: Global auth state management with token persistence
- [x] **Protected Routes**: Unauthenticated users redirected to login
- [x] **Login Page**: Email/password form, Google OAuth button, demo account buttons
- [x] **Logout**: Sidebar logout button with session cleanup
- [x] **AI Job Summary**: Generate professional summaries for completed jobs
- [x] **AI Scheduling Suggestions**: Smart technician/time slot recommendations
- [x] **AI Predictive Maintenance**: Equipment maintenance forecasting

### RFC-002 Phase 4 - Data Management (Completed Mar 2, 2026)
- [x] **Import Wizard UI**: 4-step wizard (type → upload → validate → import)
- [x] **CSV Templates**: Download templates for all import types
- [x] **Import Validation**: Pre-import validation with error/warning reporting
- [x] **Import Processing**: Bulk import with duplicate handling
- [x] **Supported Types**: Customers, Leads, Jobs, Inventory, Equipment
- [x] **Invoices Page**: Full UI with metrics, search, filtering, payment recording
- [x] **Vendors Page**: Full UI with vendor cards, purchase order management

## API Endpoints

### Authentication (RFC-002 Section 4.9)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - JWT login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/users` - List users (admin)
- `PUT /api/auth/users/{id}/role` - Update user role (admin)
- `POST /api/auth/google/session` - Exchange Google OAuth session

### AI Features (RFC-002 Section 4.3)
- `POST /api/ai/job-summary` - Generate job summary (Gemini 2.0 Flash)
- `POST /api/ai/scheduling-suggestions` - Get scheduling recommendations
- `POST /api/ai/predictive-maintenance` - Get maintenance predictions

### Data Import (RFC-002 Section 4.10)
- `GET /api/import/templates/{type}` - Get CSV template
- `POST /api/import/validate` - Validate records before import
- `POST /api/import/process` - Process and import records

### System Settings
- `GET /api/system/settings` - Get settings (AI toggle, rates, etc.)
- `PUT /api/system/settings` - Update settings

## Test Credentials
- **Demo Admin**: Click "Admin" button on login page
- **Demo Dispatcher**: Click "Dispatcher" button
- **Demo Technician**: Click "Technician" button
- **Demo Sales**: Click "Sales" button
- **Test Account**: test@example.com / testpass123

## Prioritized Backlog

### P0 - Critical (DONE)
- [x] Authentication (JWT + Google OAuth)
- [x] AI Features (Gemini 2.0 Flash)
- [x] Data Import Wizards
- [x] Invoices UI
- [x] Vendors UI

### P1 - High Priority
- [ ] Route & travel time calculation (needs Google Maps API key)
- [ ] Evidence-based checklists UI (backend ready)
- [ ] Ad-hoc Reporting Builder

### P2 - Medium Priority
- [ ] Scheduling Boards (drag-and-drop Gantt)
- [ ] Install project billing (milestone-based)
- [ ] Deeper accounting integration

### P3 - Lower Priority
- [ ] Customer portal enhancements
- [ ] Internal communication (job-scoped chat)
- [ ] Multi-warehouse inventory support

## Known Issues
1. **ESLint Config**: False-positive TypeScript parsing errors (build works, lint shows errors)
2. **Google Maps**: Blocked until user provides API key

## File Structure
```
/app/
├── backend/
│   ├── models.py (2000+ lines)
│   ├── server.py (6000+ lines)
│   ├── requirements.txt
│   └── tests/
│       └── test_rfc002_auth_ai_import.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/ (Shadcn)
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── lib/
│   │   │   └── api.ts (2300+ lines)
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── ImportWizard.tsx
│   │       ├── Invoices.tsx
│   │       ├── Vendors.tsx
│   │       └── ...
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_4.json
```

## Last Updated
March 2, 2026 - RFC-002 Phases 3 & 4 complete (Authentication, AI Features, Import Wizards)
