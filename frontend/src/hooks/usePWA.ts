import { useState, useEffect, useCallback } from 'react';
import {
  isOnline,
  onOnlineStatusChange,
  offlineStorage,
  syncOfflineActions,
  getPushNotificationStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  canInstallPWA,
  promptInstallPWA,
  isStandalone,
} from '@/lib/pwa';
import { useAuth } from '@/contexts/AuthContext';

// Hook for online/offline status
export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    return onOnlineStatusChange(setOnline);
  }, []);

  return online;
}

// Hook for offline data sync
export function useOfflineSync() {
  const { token } = useAuth();
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Check pending actions count
  const checkPending = useCallback(async () => {
    const actions = await offlineStorage.getPendingActions();
    setPendingCount(actions.length);
  }, []);

  // Sync when coming back online
  useEffect(() => {
    if (online && token && pendingCount > 0) {
      setSyncing(true);
      syncOfflineActions(token)
        .then((synced) => {
          console.log(`Synced ${synced} offline actions`);
          checkPending();
        })
        .finally(() => setSyncing(false));
    }
  }, [online, token, pendingCount, checkPending]);

  // Check pending on mount
  useEffect(() => {
    checkPending();
  }, [checkPending]);

  // Queue an action for offline
  const queueAction = useCallback(async (
    url: string,
    method: string,
    body?: unknown
  ) => {
    await offlineStorage.queueAction({
      url,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    checkPending();
  }, [checkPending]);

  return {
    online,
    syncing,
    pendingCount,
    queueAction,
    checkPending
  };
}

// Hook for push notifications
export function usePushNotifications() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  }>({
    supported: false,
    permission: 'default',
    subscribed: false
  });
  const [loading, setLoading] = useState(true);

  // Check status on mount
  useEffect(() => {
    getPushNotificationStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !token) return false;
    
    setLoading(true);
    const subscription = await subscribeToPushNotifications(user.id, token);
    const newStatus = await getPushNotificationStatus();
    setStatus(newStatus);
    setLoading(false);
    
    return !!subscription;
  }, [user, token]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!token) return false;
    
    setLoading(true);
    const success = await unsubscribeFromPushNotifications(token);
    const newStatus = await getPushNotificationStatus();
    setStatus(newStatus);
    setLoading(false);
    
    return success;
  }, [token]);

  return {
    ...status,
    loading,
    subscribe,
    unsubscribe
  };
}

// Hook for PWA install prompt
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(isStandalone());

    // Listen for install prompt availability
    const checkInstall = () => {
      setCanInstall(canInstallPWA());
    };

    window.addEventListener('beforeinstallprompt', checkInstall);
    
    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', checkInstall);
    };
  }, []);

  const install = useCallback(async () => {
    const accepted = await promptInstallPWA();
    if (accepted) {
      setIsInstalled(true);
      setCanInstall(false);
    }
    return accepted;
  }, []);

  return {
    canInstall,
    isInstalled,
    install
  };
}

// Hook for caching data offline
export function useOfflineCache<T>(key: string, type: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from cache on mount
  useEffect(() => {
    offlineStorage.getCachedData<T>(key)
      .then(setData)
      .finally(() => setLoading(false));
  }, [key]);

  // Save to cache
  const cache = useCallback(async (newData: T) => {
    await offlineStorage.cacheData(key, type, newData);
    setData(newData);
  }, [key, type]);

  // Clear from cache
  const clear = useCallback(async () => {
    // Note: Would need to add a delete method to offlineStorage
    setData(null);
  }, []);

  return {
    data,
    loading,
    cache,
    clear
  };
}
