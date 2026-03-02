import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, AuthUser } from '@/lib/api';
import { toast } from 'sonner';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const googleAuthProcessed = useRef(false);

  const login = useCallback((user: AuthUser, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  }, []);

  const handleGoogleCallback = useCallback(async () => {
    // Prevent double processing
    if (googleAuthProcessed.current) return false;
    
    // Check for Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (!sessionId) return false;
    
    googleAuthProcessed.current = true;
    
    try {
      const response = await authApi.googleSessionExchange(sessionId);
      login(response.user, response.access_token);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      toast.success(`Welcome, ${response.user.name}!`);
      return true;
    } catch (error: any) {
      console.error('Google auth error:', error);
      toast.error(error?.message || 'Google authentication failed');
      // Clean up URL even on error
      window.history.replaceState({}, document.title, window.location.pathname);
      return false;
    }
  }, [login]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    // First check for Google OAuth callback
    const googleAuthResult = await handleGoogleCallback();
    if (googleAuthResult) {
      setIsLoading(false);
      return true;
    }
    
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (!storedToken) {
      setIsLoading(false);
      return false;
    }

    setToken(storedToken);

    // Try to use cached user first
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Invalid JSON, will try to fetch from API
      }
    }

    // Validate token with backend
    try {
      const freshUser = await authApi.getMe();
      setUser(freshUser);
      localStorage.setItem('auth_user', JSON.stringify(freshUser));
      setIsLoading(false);
      return true;
    } catch (error) {
      // Token is invalid or expired
      logout();
      setIsLoading(false);
      return false;
    }
  }, [handleGoogleCallback, logout]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    updateUser,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
