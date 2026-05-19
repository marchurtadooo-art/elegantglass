import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/auth';
import { COLORS } from '../src/theme';
import {
  configureNotificationHandlers,
  mountNotificationListeners,
} from '../src/notifications';

// Configure notification handler immediately (module scope)
configureNotificationHandlers();

export default function RootLayout() {
  useEffect(() => {
    const cleanup = mountNotificationListeners();
    return cleanup;
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
