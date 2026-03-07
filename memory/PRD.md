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

### Job Chat System (RFC-002 Section 4.3) - NEW
- [x] **WebSocket-based real-time chat** - With REST fallback
- [x] **Internal channel** - Staff-to-technician communication
- [x] **Customer channel** - Staff-to-customer communication (with visibility warning)
- [x] **Chat threads** - Per-job conversation tracking
- [x] **Message types** - Text, system messages
- [x] **Sender info** - Name, role badge, avatar, timestamp
- [x] Integrated into Job Detail page as new "Chat" tab

### Multi-Warehouse Inventory (RFC-002 Section 4.6) - NEW
- [x] **Location Management** - Warehouses, trucks, satellites, vendors
- [x] **Location Types** - Primary warehouse designation
- [x] **Stock View** - Per-location inventory tracking
- [x] **Stock Levels** - On-hand, reserved, available quantities
- [x] **Min/Max Thresholds** - Reorder points with alerts
- [x] **Inventory Transfers** - Create, approve, receive workflow
- [x] **Transfer Status** - Pending, In Transit, Received, Cancelled
- [x] New "Warehouse" page in sidebar navigation

### PWA & Integrations (RFC-002 Section 4.9+) - COMPLETE
- [x] **Backend Router Fix** - Resolved P0 404 error for all new endpoints
- [x] **Push Notifications API** - VAPID key generation, subscription management
- [x] **QuickBooks Integration API** - Status, connect, disconnect, sync endpoints
- [x] **AI Configuration API** - Provider/model selection via system settings
- [x] **Settings UI Enhancement** - Full integrations tab with:
  - Google Maps toggle (with API key status)
  - AI Features: Provider dropdown, model input, failover toggle
  - QuickBooks: Enable, connect, sync controls
  - Push Notifications: Enable, trigger configuration
- [x] **Inventory Cleanup** - Removed obsolete Inventory.tsx, consolidated to single route
- [x] **PWA Frontend Integration** - Service Worker registration on app startup
- [x] **PWA Icons** - Generated 8 icon sizes (72x72 to 512x512) for manifest
- [x] **Offline Storage** - IndexedDB-based offline data caching and sync
- [x] **PWA Install Banner** - Dismissable banner prompting users to install the app
- [x] **Your Device Section** - Settings > Integrations shows:
  - Online/offline status indicator
  - PWA installation status and button
  - Push notification subscription toggle for current device
  - Browser permission status with help text

### Sites Management (RFC-002 Multi-Site Locations) - NEW
- [x] **Site Model** - Full data model with contacts, access codes, equipment links
- [x] **Sites CRUD API** - Create, read, update, delete (soft) endpoints
- [x] **Sites Migration** - Auto-create sites from existing job addresses
- [x] **Sites Page UI** - Stats cards, site cards grid, search/filter
- [x] **Site Detail Sheet** - Tabs for Info, Jobs history, Equipment
- [x] **Customers API** - New /api/customers endpoint for customer lookup

### Projects Page (RFC-002 Install Projects) - NEW
- [x] **Projects List Page** - Stats cards, project cards with progress/timeline
- [x] **Project Cards** - Show status, customer, progress bar, days, phases, budget
- [x] **Project Status Actions** - Dropdown menu to change status (Planning → Scheduled → In Progress → Completed)
- [x] **Create Project Dialog** - Link to job, set dates, hours, cost estimates
- [x] **Gantt Chart Link** - Navigate to existing Gantt view for each project

### VoIP Integration (Phone.com) - NEW
- [x] **VoIP Models** - VoIPCallLog, VoIPSMS, VoIPPhoneNumber, VoIPSettings
- [x] **Phone.com Service** - Service class with API integration (make_call, send_sms, get_call_logs, etc.)
- [x] **VoIP API Endpoints** - /api/voip/status, calls, sms, analytics, webhooks
- [x] **Demo Mode** - Full functionality with simulated calls when not configured
- [x] **Communications Page** - Call logs table, SMS messages, analytics dashboard
- [x] **Click-to-Call** - Initiate calls with customer/job linking
- [x] **SMS Messaging** - Send/receive SMS with customer auto-matching
- [x] **Call Analytics** - Stats cards, calls by status, calls by hour chart
- [x] **Webhook Endpoints** - Receive call/SMS events from Phone.com
- [x] **Settings Integration** - VoIP configuration section with feature toggles
- [x] **Seed Data** - 8 demo calls, 3 demo SMS for testing

### Backend Refactoring - COMPLETED (Dec 2025)
- [x] **Routes Directory Structure** - Created /app/backend/routes/ with modular files
- [x] **Shared Utilities** - Created shared.py with DB, auth, and validation helpers
- [x] **Jobs Routes** - Migrated Jobs CRUD, checklists, equipment usage, chat
- [x] **Customers Routes** - Migrated Customers CRUD
- [x] **Technicians Routes** - Migrated Technicians CRUD, image upload, status
- [x] **Scheduling Routes** - Migrated Appointments CRUD
- [x] **Financials Routes** - Migrated Invoices, Payments, Stripe checkout
- [x] **Leads Routes** - Migrated Leads, PCBs, Proposals
- [x] **Inventory Routes** - Migrated Inventory items/categories, Trucks, Stock checks, Transfers
- [x] **Tasks Routes** - Migrated Tasks CRUD and reordering
- [x] **Sites Routes** - Migrated Sites CRUD, equipment linking, job history
- [x] **Vendors Routes** - Migrated Vendors and Purchase Orders
- [x] **VoIP Routes** - Migrated Phone.com integration, calls, SMS, analytics
- [x] **Reports Routes** - Migrated business summary, queries, analytics
- [x] **Settings Routes** - Migrated system settings, AI config, maps config, push notifications, roles
- [x] **Projects Routes** - Migrated Install projects, phases, milestones, billing
- [x] **Integrations Routes** - Migrated QuickBooks, customer equipment
- [x] **Route Switchover Complete** - All modular routes now live at /api prefix

**Migrated Routes Summary** (all functional under /api/):
- `/api/jobs/*` - Jobs CRUD, checklists, equipment, chat
- `/api/customers/*` - Customers CRUD
- `/api/technicians/*` - Technicians CRUD, images, status
- `/api/appointments/*` - Appointments/Scheduling CRUD
- `/api/financials/invoices/*` - Invoices CRUD, status updates
- `/api/financials/payments/*` - Payments CRUD
- `/api/financials/checkout/*` - Stripe checkout integration
- `/api/leads/*` - Leads CRUD, metrics, conversion
- `/api/leads/pcbs/*` - PCBs CRUD, conversion to job
- `/api/leads/proposals/*` - Proposals CRUD, options, acceptance
- `/api/inventory/*` - Items, categories, trucks, stock, transfers
- `/api/tasks/*` - Task CRUD and reordering
- `/api/sites/*` - Sites CRUD, equipment, job history
- `/api/vendors/*` - Vendors and purchase orders
- `/api/voip/*` - Calls, SMS, analytics, webhooks
- `/api/reports/*` - Summary, queries, analytics
- `/api/settings/*` - System, AI, maps, push, roles
- `/api/projects/*` - Install projects, phases, milestones
- `/api/integrations/*` - QuickBooks, customer equipment

**Legacy routes remaining in server.py:**
- Auth routes (/api/auth/*) - Login, register, JWT, Google OAuth
- WebSocket Chat (/api/ws/*) - Real-time job chat
- Seed Data (/api/seed) - Demo database population
- Time Tracking - Clock in/out, GPS tracking
- Board Config - Kanban board configuration
- J-Load Calculator - HVAC load calculations
- AI Features - Smart scheduling, summaries
- Google Maps Routing - Route optimization
- Maintenance Agreements - Service contracts
- Customer Portal - Self-service portal
- Offline Sync - Mobile offline support
- Import Wizards - Data import tools

### Mobile-Friendly Web Enhancements - PARTIAL
- [x] **Scheduling Board** - Added responsive controls, mobile scroll hint, full-width inputs
- [x] **Existing Pages** - Jobs, Dashboard, Customers, Invoices already have good mobile layouts
- [ ] **Additional responsive improvements** - As needed per user feedback

### Install Project Billing (RFC-002 Section 4.5.3)
- [x] **Milestone Templates** - 4 predefined configurable templates
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

### Customer Portal Enhancements
- [x] **Reschedule Requests** - Request appointment changes (requires dispatcher approval)
- [x] **Multiple Auth Options** - Password login AND magic link authentication
- [x] **Service History** - View past jobs and invoices
- [x] **Equipment List** - See registered equipment with warranty
- [x] **Online Payment** - Pay outstanding invoices via Stripe
- [x] **Support Requests** - Submit new service requests

## API Endpoints Summary

### Job Chat
- `GET /api/jobs/{job_id}/chat/{channel}/messages` - Get messages for channel
- `POST /api/jobs/{job_id}/chat/{channel}/message` - Post a message
- `GET /api/jobs/{job_id}/chat/threads` - Get chat threads
- `GET /api/chat/unread-counts` - Get unread message counts
- `WS /ws/chat/{job_id}/{channel}` - WebSocket connection

### Multi-Warehouse Inventory
- `GET /api/inventory/locations` - List all locations
- `POST /api/inventory/locations` - Create new location
- `PUT /api/inventory/locations/{id}` - Update location
- `GET /api/inventory/locations/{id}/stock` - Get stock for location
- `PUT /api/inventory/locations/{id}/stock/{item_id}` - Update stock levels
- `GET /api/inventory/transfers` - List all transfers
- `POST /api/inventory/transfers` - Create new transfer
- `PUT /api/inventory/transfers/{id}/approve` - Approve transfer
- `PUT /api/inventory/transfers/{id}/receive` - Mark transfer received

### Push Notifications & PWA
- `GET /api/push/vapid-key` - Get VAPID public key for subscription
- `POST /api/push/subscribe` - Subscribe device to push notifications
- `POST /api/push/unsubscribe` - Unsubscribe device
- `GET /api/push/subscriptions` - List user's subscriptions

### QuickBooks Integration
- `GET /api/integrations/quickbooks/status` - Get connection status
- `GET /api/integrations/quickbooks/auth-url` - Get OAuth URL
- `GET /api/integrations/quickbooks/callback` - OAuth callback handler
- `POST /api/integrations/quickbooks/disconnect` - Disconnect QuickBooks
- `POST /api/integrations/quickbooks/sync` - Trigger sync operation
- `GET /api/integrations/quickbooks/sync-logs` - Get sync history

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

## Test Credentials
- **Demo Admin**: Click "Admin" button on login page
- **Test User**: test@test.com / test123
- **Customer Portal**: https://hvac-ops-platform.preview.emergentagent.com/customer

## Remaining/Future Tasks

### P1 - In Progress
- [ ] Complete backend route migration (switch v2 routes to primary /api)
- [ ] PWA full implementation (service worker registration, offline support)
- [ ] QuickBooks OAuth flow testing with real credentials

### P2 - Medium Priority
- [ ] Google Maps route calculation (BLOCKED - needs user API key)
- [ ] Mobile app (React Native) - scaffolded but not tested
- [ ] Deeper accounting integration (bi-directional sync)
- [ ] VoIP live mode (requires Phone.com API key)

### P3 - Lower Priority
- [ ] Read receipts for chat
- [ ] Typing indicators for chat
- [ ] Advanced inventory reporting
- [ ] Sites page UX fixes (AlertDialog for delete, Edit functionality)

## File Structure
```
/app/
├── backend/
│   ├── server.py (~7450 lines)
│   ├── models.py (~2440 lines)
│   └── tests/
│       ├── test_milestone_reschedule.py
│       └── test_chat_inventory.py
│       └── test_p0_integrations.py (NEW)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── JobChat.tsx
│   │   ├── pages/
│   │   │   ├── InventoryManagement.tsx
│   │   │   ├── Settings.tsx (ENHANCED)
│   │   │   ├── ProjectBilling.tsx
│   │   │   ├── Checklists.tsx
│   │   │   ├── ReportsBuilder.tsx
│   │   │   ├── SchedulingBoard.tsx
│   │   │   ├── CustomerPortal.tsx
│   │   │   └── ...
│   │   └── lib/api.ts (~2850 lines)
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    ├── iteration_7.json
    └── iteration_8.json (NEW)
```

## Last Updated
March 2, 2026 - P0 Backend Router Fix, Settings UI Enhancement with AI/QuickBooks/Push integrations
