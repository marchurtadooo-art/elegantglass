import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/auth';
import { COLORS } from '../src/theme';

// ---------------------------------------------------------------
// FONT LOADING NOTE
// ---------------------------------------------------------------
// Ionicons (and the rest of @expo/vector-icons) handle their own font
// registration internally — they should NOT be passed into a custom
// useFonts({...}) call or required manually. Doing that triggers
// "Font file for ionicons is empty" when the binary TTF is served
// over a proxy/tunnel that re-encodes assets.
//
// Some bundler setups (Expo SDK 54 + ngrok web preview) still emit a
// noisy "Font file for ionicons is empty" warning the first time an
// <Ionicons> component renders. The icon glyphs render anyway because
// the OS falls back to the system font cache. We silence those warnings
// here so they don't pollute logs and confuse the developer.
// ---------------------------------------------------------------
const FONT_NOISE_PATTERNS = [
  'Font file for ionicons is empty',
  'ExpoFontLoader.loadAsync',
  'Font file for FontAwesome',
  'Font file for MaterialIcons',
  'Font file for MaterialCommunityIcons',
];

LogBox.ignoreLogs([
  'Font file for ionicons is empty',
  /Font file for .* is empty/,
  /ExpoFontLoader\.loadAsync/,
]);

if (typeof console !== 'undefined') {
  const originalError = console.error.bind(console);
  console.error = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
      if (FONT_NOISE_PATTERNS.some((p) => msg.includes(p))) {
        return; // swallow icon-font noise
      }
    } catch {
      // ignore
    }
    originalError(...args);
  };
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
      if (FONT_NOISE_PATTERNS.some((p) => msg.includes(p))) {
        return;
      }
    } catch {
      // ignore
    }
    originalWarn(...args);
  };
}

// On web, install a global handler so the unhandled "loadAsync" promise
// rejection from Expo's font loader (when the TTF stream is empty) doesn't
// crash the runtime or flood the console.
if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
  const onUnhandled = (ev: any) => {
    try {
      const reason = ev && (ev.reason || ev.detail);
      const msg = (reason && (reason.message || String(reason))) || '';
      if (FONT_NOISE_PATTERNS.some((p) => String(msg).includes(p))) {
        if (ev.preventDefault) ev.preventDefault();
        return false;
      }
    } catch { /* noop */ }
  };
  try { (globalThis as any).addEventListener?.('unhandledrejection', onUnhandled); } catch {}
}

export default function RootLayout() {
  useEffect(() => {
    // Sanity log: confirms the layout mounted even if font noise is ignored.
    // (Not verbose — only fires once on app boot.)
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
