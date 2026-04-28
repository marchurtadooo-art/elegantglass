import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button, Input, HeaderBar } from '../src/ui';
import { api, apiError } from '../src/api';

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await api.post('/auth/forgot-password', { email: email.trim() });
      setDone(true);
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Recuperar contraseña" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
          {done ? (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>Solicitud enviada</Text>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.xl }]}>
                Si el email existe en GLASSWORK, tu administrador recibirá una notificación interna y podrá restablecer tu contraseña. Contáctale si no recibes respuesta en 24 horas.
              </Text>
              <Button title="Volver al inicio" onPress={() => router.replace('/login')} testID="forgot-back" />
            </View>
          ) : (
            <View>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.lg }]}>
                Indica el email asociado a tu cuenta. Tu administrador podrá generarte una nueva contraseña.
              </Text>
              <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="forgot-email" />
              <Button title="Enviar solicitud" onPress={submit} loading={loading} testID="forgot-submit" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({});
