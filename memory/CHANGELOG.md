# BreezeFlow Changelog

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
