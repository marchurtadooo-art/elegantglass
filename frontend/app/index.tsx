import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';
import { COLORS } from '../src/theme';

export default function Index() {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'WORKER') return <Redirect href="/(worker)/home" />;
  return <Redirect href="/(manager)/dashboard" />;
}
