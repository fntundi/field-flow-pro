# BreezeFlow 2.0 - HVAC Field Service Management System

## Original Problem Statement
Build a modern HVAC field service management system per RFC-002 with comprehensive features for lead-to-cash workflow, field service operations, and business analytics.

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI (Python 3.11), Pydantic
- **Database**: MongoDB (via Motor async driver)
- **Authentication**: JWT + Emergent Google OAuth
- **AI**: Gemini 2.0 Flash via emergentintegrations
- **Payments**: Stripe via emergentintegrations

## Implemented Features (All Complete)

### Core Platform
- [x] Role-based dashboards (Owner, Dispatcher, Technician, Sales)
- [x] Jira-style jobs board with drag-and-drop
- [x] Technician profiles with image upload
- [x] Customer management
- [x] Mobile-responsive layout

### Authentication (RFC-002 Section 4.9)
- [x] JWT authentication (register, login, password change)
- [x] Emergent-managed Google OAuth
- [x] Protected routes with auth context
- [x] Demo account quick-login

### Leads & Sales Pipeline (RFC-002 Section 4.1)
- [x] Lead management with status workflow
- [x] PCB (Potential Callback) management
- [x] Good/Better/Best proposal system

### Evidence-Based Checklists (RFC-002 Section 4.2.2)
- [x] Photo evidence upload (before/after)
- [x] Measurement and note capture
- [x] Progress tracking per checklist item

### Scheduling & Dispatch (RFC-002 Section 4.4)
- [x] Drag-and-drop Scheduling Board
- [x] Day and Week view modes
- [x] Technician columns with specialties

### Install Project Billing (RFC-002 Section 4.5.3) - NEW
- [x] **Milestone Templates** - 4 predefined configurable templates:
  - Standard Install (30/40/30)
  - Equipment Only (50/50)
  - Large Project (20/30/30/20)
  - Full Payment on Completion
- [x] **Template Management** - Create, edit, configure templates
- [x] **Project Billing Page** - Apply templates, track milestones
- [x] **Milestone Invoicing** - Auto-generate invoices from milestones
- [x] **Stripe Integration** - Online invoice payments

### Financials & Invoicing (RFC-002 Section 4.5)
- [x] Invoice management with status workflow
- [x] Payment recording (card, ACH, check, cash)
- [x] Stripe online payments - Pay invoices via card
- [x] Invoice metrics dashboard

### AI Features (RFC-002 Section 4.3)
- [x] Job summary generation (Gemini 2.0 Flash)
- [x] Scheduling suggestions AI
- [x] Predictive maintenance recommendations

### Ad-hoc Reporting (RFC-002 Section 4.8.2)
- [x] Custom report builder
- [x] Multiple data sources
- [x] Export to CSV

### Data Import (RFC-002 Section 4.10)
- [x] CSV import wizard (4-step process)
- [x] Support for: Customers, Leads, Jobs, Inventory, Equipment

### Customer Portal Enhancements - NEW
- [x] **Reschedule Requests** - Request appointment changes (requires dispatcher approval)
- [x] **Multiple Auth Options** - Password login AND magic link authentication
- [x] **Service History** - View past jobs and invoices
- [x] **Equipment List** - See registered equipment with warranty
- [x] **Online Payment** - Pay outstanding invoices via Stripe
- [x] **Support Requests** - Submit new service requests

## API Endpoints Summary

### Milestone Templates
- `GET /api/milestone-templates` - List all templates
- `POST /api/milestone-templates` - Create new template
- `PUT /api/milestone-templates/{id}` - Update template
- `DELETE /api/milestone-templates/{id}` - Deactivate template

### Project Billing
- `POST /api/projects/{id}/apply-template/{template_id}` - Apply billing template
- `PUT /api/projects/{id}/milestones/{milestone_id}` - Update milestone status
- `POST /api/projects/{id}/milestones/{milestone_id}/invoice` - Generate invoice

### Reschedule Requests
- `GET /api/reschedule-requests` - List all requests (dispatcher view)
- `POST /api/reschedule-requests` - Create request (customer portal)
- `PUT /api/reschedule-requests/{id}/approve` - Approve with date/time
- `PUT /api/reschedule-requests/{id}/reject` - Reject with reason

### Support Requests
- `GET /api/support-requests` - List all support requests
- `POST /api/customer/{id}/support-request` - Create support request
- `PUT /api/support-requests/{id}` - Update status/assignment

## Test Credentials
- **Demo Admin**: Click "Admin" button on login page
- **Customer Portal**: https://hvac-dispatch-hub.preview.emergentagent.com/customer

## Remaining/Future Tasks

### P2 - Medium Priority
- [ ] Google Maps route calculation (needs user API key)
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
│   ├── server.py (~6800 lines)
│   ├── models.py (~2300 lines)
│   └── tests/
│       └── test_milestone_reschedule.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ProjectBilling.tsx (NEW)
│   │   │   ├── Checklists.tsx
│   │   │   ├── ReportsBuilder.tsx
│   │   │   ├── SchedulingBoard.tsx
│   │   │   ├── CustomerPortal.tsx (ENHANCED)
│   │   │   └── ...
│   │   └── lib/api.ts (~2600 lines)
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_6.json
```

## Last Updated
March 2, 2026 - Install Project Billing and Customer Portal Enhancements complete
