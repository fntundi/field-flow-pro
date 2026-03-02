# BreezeFlow Changelog

## [2025-03-02] - Sites & Projects Pages Complete

### Added
- **Sites Management Page** (`/sites`)
  - Full CRUD for service locations
  - Stats cards: Total Sites, Residential, Commercial, With Pets
  - Site cards with customer name, address, job count, type badge
  - Site detail sheet with tabs: Info, Jobs history, Equipment
  - Migration endpoint: Import sites from existing job addresses
  - Access info: gate codes, parking notes, building hours, pet warnings
- **Projects Management Page** (`/projects`)
  - Project list with stats: Total, In Progress, Scheduled, Completed
  - Project cards showing progress bars, timeline status, phase count, budget
  - Status actions: Planning → Scheduled → In Progress → On Hold → Completed
  - Create project dialog linked to install jobs
  - Gantt button navigates to `/projects/{id}` for detailed view
- **Customers API** - New `/api/customers` endpoint with search support
- **Sites API** - Full CRUD + `/api/sites/migrate-from-jobs`

### Files Created
- `/app/frontend/src/pages/Sites.tsx`
- `/app/frontend/src/pages/Projects.tsx`
- `/app/backend/tests/test_sites_projects.py`

### Files Modified
- `/app/backend/server.py` - Added customers and sites API endpoints (~330 lines)
- `/app/backend/models.py` - Added Site, SiteCreate, SiteUpdate, SiteContact models
- `/app/frontend/src/lib/api.ts` - Added sitesApi and customersApi
- `/app/frontend/src/App.tsx` - Replaced placeholder routes with new pages

---

## [2025-03-02] - PWA Implementation Complete

### Added
- **Service Worker Registration** - Automatic registration on app startup via `initializePWA()` in App.tsx
- **PWA Icons** - Generated 8 icon sizes (72x72 to 512x512) using BreezeFlow branding
- **Offline Storage** - IndexedDB-based caching system for offline data persistence
- **PWA Install Banner** - Dismissable banner component showing when app is installable
- **Your Device Section** - New card in Settings > Integrations showing:
  - Online/offline status with visual indicator
  - PWA installation status and install button
  - Push notification subscription toggle
  - Browser permission status with helpful guidance

### Files Modified
- `/app/frontend/src/App.tsx` - Added PWA initialization on mount
- `/app/frontend/src/components/AppLayout.tsx` - Added PWAInstallBanner component
- `/app/frontend/src/pages/Settings.tsx` - Added "Your Device" section with PWA hooks

### Files Created
- `/app/frontend/src/components/PWAInstallBanner.tsx` - Install prompt banner component
- `/app/frontend/public/icons/*.png` - 8 PWA icon files

---

## [2025-03-02] - P0 Backend Fix & Settings UI

### Fixed
- **Backend 404 Error** - Moved `app.include_router(api_router)` to end of server.py to fix routing issues

### Added
- Full Settings > Integrations UI for AI, QuickBooks, and Push Notifications
- System settings interface updates for new backend capabilities

### Removed
- Obsolete `/app/frontend/src/pages/Inventory.tsx` (mock data page)

---

## [2025-02-XX] - Multi-Warehouse Inventory System

### Added
- Location management (warehouses, trucks, satellites, vendors)
- Stock tracking with min/max thresholds
- Inventory transfer workflow (create, approve, receive)
- Transfer status tracking

---

## [2025-02-XX] - WebSocket Job Chat System

### Added
- Real-time chat via WebSocket with REST fallback
- Internal and customer channels per job
- Message threading and sender info display
- Integration in Job Detail page as "Chat" tab
