import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, ImageBackground, Alert, useWindowDimensions, Image,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop, SvgUri } from 'react-native-svg';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button, Input } from '../src/ui';
import { FadeInUp } from '../src/animations';
import { useAuth } from '../src/auth';
import { warmupBackend } from '../src/api';

const BG = 'https://customer-assets.emergentagent.com/job_site-glass-preview/artifacts/tbs4sa2u_image.png';
const LOGO = 'https://customer-assets.emergentagent.com/job_site-glass-preview/artifacts/9okeqbg5_elegantglass_logo.svg';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, loading } = useAuth();
  const { width: winW, height: winH } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Wake the backend container as soon as the user opens the login screen,
  // so the actual POST /auth/login is fast and avoids cold-start 502/504.
  useEffect(() => {
    warmupBackend().catch(() => {});
  }, []);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Introduce email y contraseña.');
      return;
    }
    try {
      // Final warm-up just before login. Best-effort, doesn't block on failure.
      await warmupBackend(4000);
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Error al iniciar sesión');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const biometric = async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) { Alert.alert('Biometría no disponible', 'Configura FaceID o huella primero.'); return; }
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Acceso GLASSWORK' });
      if (r.success) await submit();
    } catch {
      Alert.alert('Biometría', 'No se pudo autenticar.');
    }
  };

  return (
    <ImageBackground source={{ uri: BG }} style={styles.bg} resizeMode="cover">
      {/* Premium dark gradient overlay (45% avg, darker at top & bottom for vignette) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={winW} height={winH}>
          <Defs>
            <SvgLinearGradient id="loginGrad" x1="0" y1="0" x2="0" y2={winH}>
              <Stop offset="0%" stopColor="#000" stopOpacity="0.55" />
              <Stop offset="45%" stopColor="#000" stopOpacity="0.40" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0.55" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={winW} height={winH} fill="url(#loginGrad)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoBox}>
              {Platform.OS === 'web' ? (
                // On web, browsers handle SVG natively via <img>; this is the most reliable path.
                <Image source={{ uri: LOGO }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <SvgUri uri={LOGO} width="100%" height="100%" />
              )}
            </View>
            <Text style={styles.brandTitle}>GLASSWORK</Text>
            <Text
              style={styles.brandSub}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Gestión de obras de aluminio y vidrio
            </Text>
          </View>

          <FadeInUp delay={150} distance={24}>
            <View style={styles.card}>
              <Text style={[TYPO.h2, { marginBottom: SPACING.lg, textAlign: 'center' }]}>Iniciar sesión</Text>
              <Input
                testID="login-email"
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="tucorreo@empresa.com"
              />
              <Input
                testID="login-password"
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
              />
              {error ? <Text style={{ color: COLORS.danger, marginBottom: SPACING.md, textAlign: 'center' }} testID="login-error">{error}</Text> : null}
              <Button title="Entrar" onPress={submit} loading={loading} testID="login-submit" style={styles.pillBtn} />
              <View style={{ height: SPACING.sm }} />
              <Button title="Acceso biométrico" variant="ghost" icon="finger-print-outline" onPress={biometric} testID="login-biometric" style={styles.pillBtnGhost} />
              <TouchableOpacity onPress={() => router.push('/forgot-password')} style={{ marginTop: SPACING.md }} testID="goto-forgot">
                <Text style={[TYPO.body, { textAlign: 'center', color: COLORS.textSecondary, textDecorationLine: 'underline' }]}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/register')} style={{ marginTop: SPACING.lg }} testID="goto-register">
                <Text style={[TYPO.body, { textAlign: 'center', color: COLORS.textSecondary }]}>
                  ¿No tienes cuenta? <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Crear empresa</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.primary },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.md,
  },
  logoBox: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Soft glow under logo for that premium feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: SPACING.lg,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandSub: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    borderRadius: 16,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.lg,
    // More pronounced shadow for premium depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 16,
  },
  pillBtn: {
    borderRadius: 999,
    height: 52,
    paddingHorizontal: SPACING.xl,
  },
  pillBtnGhost: {
    borderRadius: 999,
    height: 50,
    paddingHorizontal: SPACING.xl,
  },
});
