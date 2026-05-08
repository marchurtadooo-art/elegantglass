import React from 'react';
import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Icon } from '../../src/Icon';
import { useAuth } from '../../src/auth';
import { COLORS } from '../../src/theme';
import QrFab from '../../src/QrFab';

export default function ManagerTabs() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'WORKER') return <Redirect href="/(worker)/home" />;
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Resumen', tabBarIcon: ({ color, size }) => <Icon name="bar-chart-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Obras', tabBarIcon: ({ color, size }) => <Icon name="briefcase-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="warehouse" options={{ title: 'Almacén', tabBarIcon: ({ color, size }) => <Icon name="cube-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="team" options={{ title: 'Equipo', tabBarIcon: ({ color, size }) => <Icon name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Reportes', tabBarIcon: ({ color, size }) => <Icon name="document-text-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color, size }) => <Icon name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
    <QrFab />
    </View>
  );
}
