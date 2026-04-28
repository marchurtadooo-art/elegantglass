import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PFX = 'gw_pref_';

export const prefs = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return (globalThis as any).localStorage?.getItem(PFX + key) ?? null; } catch { return null; }
    }
    return await SecureStore.getItemAsync(PFX + key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { (globalThis as any).localStorage?.setItem(PFX + key, value); } catch {}
      return;
    }
    await SecureStore.setItemAsync(PFX + key, value);
  },
  async getBool(key: string): Promise<boolean> {
    return (await this.get(key)) === '1';
  },
  async setBool(key: string, value: boolean): Promise<void> {
    await this.set(key, value ? '1' : '0');
  },
};
