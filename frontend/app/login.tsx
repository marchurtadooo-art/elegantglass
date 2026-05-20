import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, ImageBackground, Alert, useWindowDimensions, Image,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop, SvgUri } from 'react-native-svg';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button, Input } from '../src/ui';
import { FadeInUp } from '../src/animations';
import { useAuth } from '../src/auth';
import { warmupBackend } from '../src/api';
import {
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,
  hasBiometricCredentials,
  getBiometricCapability,
  promptBiometric,
  biometricIconName,
  type BiometricCapability,
} from '../src/biometric';

const BG = 'https://customer-assets.emergentagent.com/job_site-glass-preview/artifacts/tbs4sa2u_image.png';
const LOGO = 'https://customer-assets.emergentagent.com/job_site-glass-preview/artifacts/9okeqbg5_elegantglass_logo.svg';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, loading } = useAuth();
  const { width: winW, height: winH } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);

  // Wake the backend container as soon as the user opens the login screen,
  // so the actual POST /auth/login is fast and avoids cold-start 502/504.
  useEffect(() => {
    warmupBackend().catch(() => {});
  }, []);

  // Detect device biometric capability + check if we have stored credentials
  const refreshBioState = useCallback(async () => {
    const [c, has] = await Promise.all([getBiometricCapability(), hasBiometricCredentials()]);
    setCap(c);
    setHasSavedCreds(has);
  }, []);

  useEffect(() => {
    refreshBioState();
  }, [refreshBioState]);

  // Auto-trigger biometric prompt when arriving at login screen IF the user
  // has already set it up before. Provides a one-tap experience.
  useEffect(() => {
    if (!cap?.available || !hasSavedCreds || bioBusy || loading) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) tryBiometricLogin(/* silent */ true);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap?.available, hasSavedCreds]);

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
      // Store credentials for future biometric logins (only if device supports it)
      try {
        if (cap?.available) {
          await saveBiometricCredentials(email.trim(), password);
        }
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Error al iniciar sesión');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const tryBiometricLogin = async (silent = false) => {
    if (bioBusy || loading) return;
    setError(null);

    // No hardware / not enrolled → guide the user
    if (!cap?.hasHardware) {
      if (!silent) Alert.alert(
        'Biometría no disponible',
        'Tu dispositivo no tiene Face ID, Touch ID ni lector de huella.',
      );
      return;
    }
    if (!cap.isEnrolled) {
      if (!silent) Alert.alert(
        'Configura tu biometría',
        'Activa Face ID o tu huella en los Ajustes del dispositivo antes de usar el acceso biométrico.',
      );
      return;
    }

    // No stored credentials yet → user must do a normal login first
    const creds = await getBiometricCredentials();
    if (!creds) {
      if (!silent) Alert.alert(
        'Activa el acceso biométrico',
        'Inicia sesión la primera vez con tu email y contraseña. La próxima vez podrás entrar directamente con ' +
        (cap.kind === 'face' ? 'Face ID.' : cap.kind === 'fingerprint' ? 'tu huella.' : 'biometría.'),
      );
      return;
    }

    setBioBusy(true);
    try {
      const ok = await promptBiometric(`Acceso a GLASSWORK como ${creds.email}`);
      if (!ok) {
        setBioBusy(false);
        return;
      }
      // Biometric OK → log in silently with stored credentials
      await warmupBackend(4000);
      try {
        await login(creds.email, creds.password);
        // Refresh stored creds (password may have rotated server-side; this also re-asserts enable flag)
        await saveBiometricCredentials(creds.email, creds.password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/');
      } catch (e: any) {
        // Stored credentials are stale (password changed, account disabled, etc.)
        await clearBiometricCredentials();
        setHasSavedCreds(false);
        setError(
          'Las credenciales guardadas ya no son válidas. Inicia sesión con email y contraseña para reactivar el acceso biométrico.',
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch {
      // Authentication cancelled or failed silently
    } finally {
      setBioBusy(false);
    }
  };

  const bioLabel = hasSavedCreds && cap?.available
    ? cap.promptLabel
    : (cap?.available ? 'Activar acceso biométrico' : 'Acceso biométrico');

  const bioIcon = biometricIconName(cap?.kind ?? 'generic') as any;
  const showBioButton = Platform.OS !== 'web' && cap?.hasHardware;

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
              {showBioButton ? (
                <>
                  <View style={{ height: SPACING.sm }} />
                  <Button
                    title={bioLabel}
                    variant="ghost"
                    icon={bioIcon}
                    onPress={() => tryBiometricLogin(false)}
                    loading={bioBusy}
                    testID="login-biometric"
                    style={styles.pillBtnGhost}
                  />
                </>
              ) : null}
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
