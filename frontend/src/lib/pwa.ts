// PWA utilities - Service Worker registration, Push Notifications, Offline sync
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Service Worker Registration
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker registered:', registration.scope);
    
    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New version available!');
            // Optionally show update prompt to user
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Push Notification Subscription
export async function subscribeToPushNotifications(
  userId: string,
  authToken: string
): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get VAPID public key from server
    const vapidResponse = await fetch(`${API_BASE_URL}/api/push/vapid-key`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!vapidResponse.ok) {
      console.error('Failed to get VAPID key');
      return null;
    }
    
    const { publicKey } = await vapidResponse.json();
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server
    await fetch(`${API_BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        user_id: userId,
        subscription: subscription.toJSON()
      })
    });

    console.log('Push subscription successful');
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(authToken: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Notify server
      await fetch(`${API_BASE_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });
    }
    
    return true;
  } catch (error) {
    console.error('Push unsubscription failed:', error);
    return false;
  }
}

// Check if push notifications are supported and enabled
export async function getPushNotificationStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = 'PushManager' in window && 'Notification' in window;
  const permission = supported ? Notification.permission : 'denied';
  
  let subscribed = false;
  if (supported && permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    } catch {
      subscribed = false;
    }
  }

  return { supported, permission, subscribed };
}

// Offline Data Storage using IndexedDB
const DB_NAME = 'BreezeFlowOffline';
const DB_VERSION = 1;

interface OfflineAction {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

interface CachedData {
  key: string;
  type: string;
  data: unknown;
  timestamp: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Pending actions store
        if (!db.objectStoreNames.contains('pendingActions')) {
          db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
        }

        // Cached data store
        if (!db.objectStoreNames.contains('cachedData')) {
          const store = db.createObjectStore('cachedData', { keyPath: 'key' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Queue an action for when we're back online
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingActions', 'readwrite');
      const store = tx.objectStore('pendingActions');
      
      const fullAction: OfflineAction = {
        ...action,
        timestamp: Date.now(),
        retryCount: 0
      };
      
      const request = store.add(fullAction);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Get all pending actions
  async getPendingActions(): Promise<OfflineAction[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingActions', 'readonly');
      const store = tx.objectStore('pendingActions');
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Remove a pending action
  async removeAction(id: number): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingActions', 'readwrite');
      const store = tx.objectStore('pendingActions');
      const request = store.delete(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Cache data for offline access
  async cacheData(key: string, type: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedData', 'readwrite');
      const store = tx.objectStore('cachedData');
      
      const cached: CachedData = {
        key,
        type,
        data,
        timestamp: Date.now()
      };
      
      const request = store.put(cached);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Get cached data
  async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedData', 'readonly');
      const store = tx.objectStore('cachedData');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedData | undefined;
        resolve(result ? result.data as T : null);
      };
    });
  }

  // Get all cached data of a type
  async getCachedByType<T>(type: string): Promise<T[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedData', 'readonly');
      const store = tx.objectStore('cachedData');
      const index = store.index('type');
      const request = index.getAll(type);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result as CachedData[];
        resolve(results.map(r => r.data as T));
      };
    });
  }

  // Clear old cached data
  async clearOldCache(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();
    
    const cutoff = Date.now() - maxAgeMs;
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedData', 'readwrite');
      const store = tx.objectStore('cachedData');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      
      const request = index.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

export const offlineStorage = new OfflineStorage();

// Sync pending actions when back online
export async function syncOfflineActions(authToken: string): Promise<number> {
  const actions = await offlineStorage.getPendingActions();
  let synced = 0;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: {
          ...action.headers,
          'Authorization': `Bearer ${authToken}`
        },
        body: action.body
      });

      if (response.ok) {
        await offlineStorage.removeAction(action.id!);
        synced++;
      }
    } catch (error) {
      console.error('Failed to sync action:', action.id, error);
    }
  }

  return synced;
}

// Check online status
export function isOnline(): boolean {
  return navigator.onLine;
}

// Online/Offline event listeners
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Install prompt handling
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function setupInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    console.log('Install prompt ready');
  });
}

export function canInstallPWA(): boolean {
  return deferredInstallPrompt !== null;
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  
  return outcome === 'accepted';
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}
