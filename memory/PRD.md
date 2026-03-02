# BreezeFlow 2.0 - HVAC Field Service Management System

## Original Problem Statement
Build a modern HVAC field service management system per RFC-002 with comprehensive features for lead-to-cash workflow, field service operations, and business analytics.

## User Personas
1. **Owner/GM**: Needs revenue metrics, business health KPIs, and team overview
2. **Dispatcher**: Needs to assign jobs, manage technician schedules, view urgent items
3. **Technician**: Needs mobile-friendly job management, time tracking, inventory access
4. **Sales**: Needs lead tracking, quote management, opportunity pipeline
5. **Accountant**: Needs invoicing, payments, and financial reports

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI (Python 3.11), Pydantic
- **Database**: MongoDB (via Motor async driver)
- **Authentication**: JWT + Emergent Google OAuth
- **AI**: Gemini 2.0 Flash via emergentintegrations
- **Payments**: Stripe via emergentintegrations

## Implemented Features

### Core Platform (Complete)
- [x] Role-based dashboards
- [x] Jira-style jobs board with drag-and-drop
- [x] Technician profiles with image upload
- [x] Customer management
- [x] Mobile-responsive layout
- [x] Breadcrumb navigation

### Authentication (Complete - RFC-002 Section 4.9)
- [x] JWT authentication (register, login, password change)
- [x] Emergent-managed Google OAuth
- [x] Protected routes with auth context
- [x] Demo account quick-login (Admin, Dispatcher, Technician, Sales)
- [x] Session management and logout

### Leads & Sales Pipeline (Complete - RFC-002 Section 4.1)
- [x] Lead management with status workflow
- [x] PCB (Potential Callback) management
- [x] Good/Better/Best proposal system
- [x] Lead metrics and conversion tracking

### Evidence-Based Checklists (Complete - RFC-002 Section 4.2.2)
- [x] Checklist page with job selection
- [x] Photo evidence upload (before/after)
- [x] Measurement and note capture
- [x] Progress tracking per checklist item
- [x] Template-based checklist creation

### Scheduling & Dispatch (Complete - RFC-002 Section 4.4)
- [x] Drag-and-drop Scheduling Board
- [x] Day and Week view modes
- [x] Technician columns with specialties
- [x] Time slot-based job placement
- [x] Job color coding by type
- [x] Search and filter technicians

### Financials & Invoicing (Complete - RFC-002 Section 4.5)
- [x] Invoice management with status workflow
- [x] Payment recording (card, ACH, check, cash)
- [x] **Stripe online payments** - Pay invoices via card
- [x] Invoice metrics dashboard
- [x] Due date and overdue tracking

### AI Features (Complete - RFC-002 Section 4.3)
- [x] Job summary generation (Gemini 2.0 Flash)
- [x] Scheduling suggestions AI
- [x] Predictive maintenance recommendations
- [x] Configurable AI toggle in settings

### Ad-hoc Reporting (Complete - RFC-002 Section 4.8.2)
- [x] Custom report builder
- [x] Multiple data sources (Jobs, Customers, Invoices, Leads, etc.)
- [x] Column selection
- [x] Filter configuration
- [x] Date range filtering
- [x] Group by and sorting
- [x] Export to CSV
- [x] Summary metrics dashboard

### Data Import (Complete - RFC-002 Section 4.10)
- [x] CSV import wizard (4-step process)
- [x] Template download for each type
- [x] Pre-import validation
- [x] Support for: Customers, Leads, Jobs, Inventory, Equipment

### Inventory & Vendors (Complete)
- [x] Vendor management
- [x] Purchase order tracking
- [x] Inventory items with stock levels
- [x] Multi-location support model

### System Settings (Complete)
- [x] Google Maps integration toggle
- [x] AI features toggle
- [x] Business info configuration
- [x] Default rates and terms

## API Endpoints Summary

### Authentication
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/google/session`
- `GET/PUT /api/auth/me`, `POST /api/auth/change-password`

### AI Features
- `POST /api/ai/job-summary`, `/api/ai/scheduling-suggestions`, `/api/ai/predictive-maintenance`

### Payments (Stripe)
- `POST /api/payments/checkout/create` - Create checkout session
- `GET /api/payments/checkout/status/{session_id}` - Poll payment status
- `POST /api/webhook/stripe` - Webhook handler

### Reports
- `GET /api/reports/summary` - Dashboard metrics
- `POST /api/reports/query` - Ad-hoc report builder

### Data Import
- `GET /api/import/templates/{type}` - Get CSV template
- `POST /api/import/validate`, `/api/import/process`

## Test Credentials
- **Demo Admin**: Click "Admin" button on login page
- **Demo Dispatcher**: Click "Dispatcher" button
- **Demo Technician**: Click "Technician" button
- **Test Account**: test@example.com / testpass123

## Remaining/Future Tasks

### P1 - High Priority
- [ ] Google Maps route calculation (needs user API key)
- [ ] Install project billing (milestone-based)

### P2 - Medium Priority
- [ ] Customer portal enhancements (reschedule requests)
- [ ] Internal job-scoped chat
- [ ] ESLint config fix for TypeScript

### P3 - Lower Priority
- [ ] Multi-warehouse inventory sync
- [ ] Deeper accounting integration
- [ ] Mobile app (React Native)

## File Structure
```
/app/
├── backend/
│   ├── server.py (~6200 lines)
│   ├── models.py (~2000 lines)
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/AuthContext.tsx
│   │   ├── lib/api.ts (~2400 lines)
│   │   └── pages/
│   │       ├── Checklists.tsx (NEW)
│   │       ├── ReportsBuilder.tsx (NEW)
│   │       ├── SchedulingBoard.tsx (NEW)
│   │       ├── Invoices.tsx (UPDATED - Stripe)
│   │       └── ...
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_5.json
```

## Last Updated
March 2, 2026 - Implemented Checklists, Reports Builder, Scheduling Board, Stripe Payments
