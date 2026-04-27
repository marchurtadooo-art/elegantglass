import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const ACCESS_KEY = 'gw_access';
const REFRESH_KEY = 'gw_refresh';

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

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (cfg) => {
  const token = await tokenStore.getAccess();
  if (token) {
    cfg.headers = cfg.headers || {};
    (cfg.headers as any).Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const r = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refresh });
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

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      if (!refreshing) refreshing = tryRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(e: any): string {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || 'Error de red';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(' ');
  return typeof d === 'object' ? d.msg || JSON.stringify(d) : String(d);
}
