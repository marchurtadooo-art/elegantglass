import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';
import { COLORS } from '../src/theme';
import { prefs } from '../src/prefs';

export default function Index() {
  const { user } = useAuth();
  const [onboardingDone, setOnboardingDone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!user) { setOnboardingDone(null); return; }
    prefs.getBool(`onboarding_${user.id}`).then((v) => setOnboardingDone(v));
  }, [user?.id]);

  if (user === undefined || (user && onboardingDone === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (user.role === 'WORKER') return <Redirect href="/(worker)/home" />;
  return <Redirect href="/(manager)/dashboard" />;
}
