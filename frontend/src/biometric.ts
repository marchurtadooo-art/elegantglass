/**
 * GLASSWORK — Biometric authentication helper.
 *
 * Stores the user's email/password securely in the OS-encrypted keystore
 * (Keychain on iOS, EncryptedSharedPreferences on Android) so that, after
 * a successful traditional login, the next opens of the app can re-login
 * automatically with Face ID / Touch ID / fingerprint.
 *
 * Storage keys are prefixed with `gw_bio_` and live ONLY on the device.
 * They are never sent to the backend.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY_EMAIL = 'gw_bio_email';
const KEY_PASS = 'gw_bio_pass';
const KEY_ENABLED = 'gw_bio_enabled';

// ---------- credential storage ----------

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_EMAIL, email);
    await SecureStore.setItemAsync(KEY_PASS, password);
    await SecureStore.setItemAsync(KEY_ENABLED, '1');
  } catch (e) {
    // SecureStore not available (e.g. web) — silently ignore
    console.warn('[biometric] save failed', e);
  }
}

export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const enabled = await SecureStore.getItemAsync(KEY_ENABLED);
    if (enabled !== '1') return null;
    const email = await SecureStore.getItemAsync(KEY_EMAIL);
    const password = await SecureStore.getItemAsync(KEY_PASS);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_EMAIL);
    await SecureStore.deleteItemAsync(KEY_PASS);
    await SecureStore.deleteItemAsync(KEY_ENABLED);
  } catch {}
}

export async function hasBiometricCredentials(): Promise<boolean> {
  return (await getBiometricCredentials()) !== null;
}

// ---------- device capability ----------

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';

export type BiometricCapability = {
  available: boolean;          // hardware + enrolled + supported platform
  hasHardware: boolean;
  isEnrolled: boolean;
  kind: BiometricKind;         // best label to show
  promptLabel: string;         // localized e.g. "Acceso con Face ID"
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const empty: BiometricCapability = {
    available: false,
    hasHardware: false,
    isEnrolled: false,
    kind: 'none',
    promptLabel: 'Acceso biométrico',
  };
  if (Platform.OS === 'web') return empty;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return empty;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { ...empty, hasHardware: true };
    }
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let kind: BiometricKind = 'generic';
    let label = 'Acceso biométrico';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      kind = 'face';
      label = Platform.OS === 'ios' ? 'Acceso con Face ID' : 'Acceso facial';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      kind = 'fingerprint';
      label = Platform.OS === 'ios' ? 'Acceso con Touch ID' : 'Acceso con huella';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      kind = 'iris';
      label = 'Acceso con iris';
    }
    return {
      available: true,
      hasHardware: true,
      isEnrolled: true,
      kind,
      promptLabel: label,
    };
  } catch {
    return empty;
  }
}

export function biometricIconName(kind: BiometricKind): string {
  switch (kind) {
    case 'face':
      return 'scan-outline';
    case 'fingerprint':
      return 'finger-print-outline';
    case 'iris':
      return 'eye-outline';
    default:
      return 'finger-print-outline';
  }
}

// ---------- prompt ----------

export async function promptBiometric(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
      fallbackLabel: 'Usar contraseña',
    });
    return !!r.success;
  } catch {
    return false;
  }
}
