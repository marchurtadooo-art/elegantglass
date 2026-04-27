import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { COLORS } from '../../src/theme';

export default function ManagerTabs() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'WORKER') return <Redirect href="/(worker)/home" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Resumen', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Obras', tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="team" options={{ title: 'Equipo', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Reportes', tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
