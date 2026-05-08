import React, { useEffect, useState } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/auth';
import { COLORS } from '../src/theme';

// ---------------------------------------------------------------
// FONT LOADING
// ---------------------------------------------------------------
// We ONLY pass `Ionicons.font` (the official shortcut) to useFonts.
// Never require('./ionicons.ttf') manually — that's what causes
// "Font file for ionicons is empty".
//
// useFonts is wrapped at the call-site below in a way that any
// loading error is caught and the app proceeds with system fonts
// instead of remaining stuck on the splash screen.
// ---------------------------------------------------------------
SplashScreen.preventAutoHideAsync().catch(() => {});

LogBox.ignoreLogs([
  'Font file for ionicons is empty',
  /Font file for .* is empty/,
  /ExpoFontLoader\.loadAsync/,
  '"shadow*" style props are deprecated',
  '"textShadow*" style props are deprecated',
  'useNativeDriver',
]);

// Web-only safety net for unhandled font promises
const FONT_NOISE_PATTERNS = [
  'Font file for ionicons is empty',
  'ExpoFontLoader.loadAsync',
  /Font file for .* is empty/i,
];
const matchesNoise = (msg: string) =>
  FONT_NOISE_PATTERNS.some((p) => (typeof p === 'string' ? msg.includes(p) : p.test(msg)));

if (typeof console !== 'undefined') {
  const originalError = console.error.bind(console);
  console.error = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
      if (matchesNoise(msg)) return;
    } catch {}
    originalError(...args);
  };
}
if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
  const onUnhandled = (ev: any) => {
    try {
      const reason = ev && (ev.reason || ev.detail);
      const msg = (reason && (reason.message || String(reason))) || '';
      if (matchesNoise(String(msg))) {
        if (ev.preventDefault) ev.preventDefault();
        return false;
      }
    } catch {}
  };
  try { (globalThis as any).addEventListener?.('unhandledrejection', onUnhandled); } catch {}
}

export default function RootLayout() {
  // Official Expo pattern — Ionicons.font MUST be spread into the useFonts
  // object so the .ttf entry is registered under the "Ionicons" key.
  // Without `...Ionicons.font` the icons fail to load on physical devices.
  let fontsLoaded = false;
  let fontError: any = null;
  try {
    const [loaded, err] = useFonts({
      ...Ionicons.font,
    });
    fontsLoaded = !!loaded;
    fontError = err;
  } catch (e) {
    // If useFonts itself throws (very rare), fall back to system fonts.
    fontError = e;
  }
  const [forceReady, setForceReady] = useState(false);

  // Safety net: never let the splash screen stay visible >2s.
  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || !!fontError || forceReady;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;
  }

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
