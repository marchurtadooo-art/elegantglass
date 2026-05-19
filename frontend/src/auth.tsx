import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore, apiError } from './api';
import { registerPushTokenWithBackend, unregisterPushTokenWithBackend } from './notifications';

export type Role = 'ADMIN' | 'MANAGER' | 'WORKER';
export type NotificationPrefs = {
  new_alert?: boolean;
  new_project?: boolean;
  log_approved?: boolean;
  log_rejected?: boolean;
  incident_reported?: boolean;
  budget_exceeded?: boolean;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_id: string;
  phone?: string;
  avatar?: string | null;
  notification_preferences?: NotificationPrefs;
};

type AuthState = {
  user: User | null | undefined; // undefined = checking
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; company_name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
    } catch {
      setUser(null);
    }
  }, []);

  const setUserExternal = (u: User | null) => setUser(u);

  useEffect(() => {
    (async () => {
      const t = await tokenStore.getAccess();
      if (!t) { setUser(null); return; }
      await refreshUser();
      // Re-register push token on app start (best-effort)
      registerPushTokenWithBackend().catch(() => {});
    })();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const r = await api.post('/auth/login', { email, password });
      await tokenStore.setTokens(r.data.access_token, r.data.refresh_token);
      setUser(r.data.user);
      // Register the push token for this device (best-effort)
      registerPushTokenWithBackend().catch(() => {});
    } catch (e: any) {
      throw new Error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; password: string; company_name: string; phone?: string }) => {
    setLoading(true);
    try {
      const r = await api.post('/auth/register', data);
      await tokenStore.setTokens(r.data.access_token, r.data.refresh_token);
      setUser(r.data.user);
      registerPushTokenWithBackend().catch(() => {});
    } catch (e: any) {
      throw new Error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Unregister push token BEFORE clearing the auth bearer
    try { await unregisterPushTokenWithBackend(); } catch {}
    try { await api.post('/auth/logout'); } catch {}
    await tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const REGISTERED_FLAG_KEY = 'just_registered';
