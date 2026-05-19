import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://site-glass-preview.preview.emergentagent.com';

const ACCESS_KEY = 'gw_access';
const REFRESH_KEY = 'gw_refresh';

// ---------- token storage ----------
async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    try { (globalThis as any).localStorage?.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return (globalThis as any).localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return await SecureStore.getItemAsync(key);
}
async function delItem(key: string) {
  if (Platform.OS === 'web') {
    try { (globalThis as any).localStorage?.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  async setTokens(access: string, refresh: string) {
    await setItem(ACCESS_KEY, access);
    await setItem(REFRESH_KEY, refresh);
  },
  async getAccess() { return await getItem(ACCESS_KEY); },
  async getRefresh() { return await getItem(REFRESH_KEY); },
  async clear() { await delItem(ACCESS_KEY); await delItem(REFRESH_KEY); },
};

// ---------- helpers ----------
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Status codes that warrant a retry (server hiccups, gateway issues). */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isNetworkOrTimeout(err: any): boolean {
  if (!err) return false;
  if (err.code === 'ECONNABORTED') return true;          // axios timeout
  if (err.message && /timeout|network/i.test(err.message)) return true;
  if (err.code === 'ERR_NETWORK') return true;
  return !err.response;                                  // no response at all
}

function shouldRetry(err: any, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (isNetworkOrTimeout(err)) return true;
  const status = err?.response?.status;
  return typeof status === 'number' && RETRYABLE_STATUSES.has(status);
}

// ---------- axios instance ----------
export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 25000, // 25s default — covers cold-start of backend container
});

// Per-request override: pass `{ longTimeout: true }` in config for slow ops
declare module 'axios' {
  interface AxiosRequestConfig {
    _retryCount?: number;
    _retry?: boolean;
    longTimeout?: boolean;
  }
}

api.interceptors.request.use(async (cfg) => {
  const token = await tokenStore.getAccess();
  if (token) {
    cfg.headers = cfg.headers || {};
    (cfg.headers as any).Authorization = `Bearer ${token}`;
  }
  if (cfg.longTimeout) {
    cfg.timeout = 45000;
  }
  return cfg;
});

// ---------- refresh logic ----------
let refreshing: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const r = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refresh }, { timeout: 20000 });
    const newAccess = r.data?.access_token;
    if (newAccess) {
      const oldRefresh = (await tokenStore.getRefresh()) || refresh;
      await tokenStore.setTokens(newAccess, oldRefresh);
      return newAccess;
    }
  } catch {
    return null;
  }
  return null;
}

// ---------- response interceptor with retries + refresh ----------
const MAX_RETRIES = 3;

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = (error.config || {}) as AxiosRequestConfig;

    // 1) 401 → refresh token flow (only once per request)
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) refreshing = tryRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = original.headers || {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }

    // 2) 502/503/504/network/timeout → retry with exponential backoff
    const attempt = original._retryCount ?? 0;
    if (shouldRetry(error, attempt, MAX_RETRIES)) {
      original._retryCount = attempt + 1;
      const delay = Math.min(600 * Math.pow(2, attempt), 4000) + Math.floor(Math.random() * 300);
      await sleep(delay);
      return api.request(original);
    }

    return Promise.reject(error);
  },
);

// ---------- public utilities ----------

/**
 * Best-effort backend warm-up. Pings a lightweight endpoint to wake up
 * the container before doing critical operations like login. Never throws.
 * Times out fast so it doesn't block the UX.
 */
export async function warmupBackend(timeoutMs = 6000): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/api/health`, { timeout: timeoutMs });
    return true;
  } catch {
    // Fallback: try the root /api which always exists
    try {
      await axios.get(`${BASE_URL}/api/`, { timeout: timeoutMs, validateStatus: () => true });
      return true;
    } catch {
      return false;
    }
  }
}

export function apiError(e: any): string {
  // Timeout / no response (server not reachable)
  if (e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '')) {
    return 'La conexión tardó demasiado. Comprueba tu internet e inténtalo de nuevo.';
  }
  if (e?.message === 'Network Error' || e?.code === 'ERR_NETWORK' || !e?.response) {
    return 'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  }
  const status = e?.response?.status;
  const d = e?.response?.data?.detail;
  if (!d) {
    if (status === 429) return 'Demasiados intentos, espera unos minutos.';
    if (status === 404) return 'Recurso no encontrado. Vuelve a abrir la app e inténtalo de nuevo.';
    if (status === 502 || status === 503 || status === 504) {
      return 'Servidor temporalmente no disponible. Reintenta en unos segundos.';
    }
    if (status === 500) return 'Error interno del servidor. Inténtalo de nuevo.';
    return e?.message || 'Error de red';
  }
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || JSON.stringify(x)).join(' ');
  return typeof d === 'object' ? d.msg || JSON.stringify(d) : String(d);
}
