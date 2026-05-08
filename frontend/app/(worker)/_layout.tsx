import React from 'react';
import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Icon } from '../../src/Icon';
import { useAuth } from '../../src/auth';
import { COLORS } from '../../src/theme';
import QrFab from '../../src/QrFab';

export default function WorkerTabs() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'WORKER') return <Redirect href="/(manager)/dashboard" />;
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
      <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Icon name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Obras', tabBarIcon: ({ color, size }) => <Icon name="briefcase-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="daily-log" options={{ title: 'Parte', tabBarIcon: ({ color, size }) => <Icon name="clipboard-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="warehouse" options={{ title: 'Almacén', tabBarIcon: ({ color, size }) => <Icon name="cube-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color, size }) => <Icon name="time-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Icon name="person-outline" color={color} size={size} /> }} />
    </Tabs>
    <QrFab />
    </View>
  );
}
