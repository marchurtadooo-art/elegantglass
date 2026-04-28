import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, ImageBackground, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button, Input } from '../src/ui';
import { useAuth } from '../src/auth';

const BG = 'https://images.unsplash.com/photo-1761227390482-bccb032eeea6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxnbGFzcyUyMGluc3RhbGxhdGlvbiUyMGNvbnN0cnVjdGlvbiUyMHNpdGV8ZW58MHx8fHwxNzc3MzAyMzQyfDA&ixlib=rb-4.1.0&q=85';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('jefe@elegantglass.es');
  const [password, setPassword] = useState('Admin1234!');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Error al iniciar sesión');
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
    <ImageBackground source={{ uri: BG }} style={styles.bg}>
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoText}>G</Text></View>
            <Text style={styles.brandTitle}>GLASSWORK</Text>
            <Text style={styles.brandSub}>Gestión de obras de aluminio y vidrio</Text>
          </View>

          <View style={styles.card}>
            <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>Iniciar sesión</Text>
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
            {error ? <Text style={{ color: COLORS.danger, marginBottom: SPACING.md }} testID="login-error">{error}</Text> : null}
            <Button title="Entrar" onPress={submit} loading={loading} testID="login-submit" />
            <View style={{ height: SPACING.sm }} />
            <Button title="Acceso biométrico" variant="ghost" icon="finger-print-outline" onPress={biometric} testID="login-biometric" />
            <TouchableOpacity onPress={() => router.push('/forgot-password')} style={{ marginTop: SPACING.md }} testID="goto-forgot">
              <Text style={[TYPO.body, { textAlign: 'center', color: COLORS.textSecondary, textDecorationLine: 'underline' }]}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/register')} style={{ marginTop: SPACING.lg }} testID="goto-register">
              <Text style={[TYPO.body, { textAlign: 'center', color: COLORS.textSecondary }]}>
                ¿No tienes cuenta? <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Crear empresa</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.primary },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.55)' },
  container: { flexGrow: 1, padding: SPACING.lg, justifyContent: 'space-between' },
  brand: { alignItems: 'center', marginTop: SPACING.xxl },
  logo: {
    width: 64, height: 64, borderRadius: 4, backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: COLORS.surface, fontSize: 36, fontWeight: '900' },
  brandTitle: { color: COLORS.surface, fontSize: 28, fontWeight: '900', letterSpacing: 4, marginTop: SPACING.md },
  brandSub: { color: 'rgba(255,255,255,0.75)', marginTop: 4, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: 4, marginTop: SPACING.xxl,
  },
});
