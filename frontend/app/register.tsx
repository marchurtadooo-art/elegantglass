import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button, Input, HeaderBar } from '../src/ui';
import { useAuth } from '../src/auth';

export default function Register() {
  const insets = useSafeAreaInsets();
  const { register, loading } = useAuth();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name || !email || !password || !company) {
      setError('Completa todos los campos obligatorios.');
      return;
    }
    if (password.length < 6) { setError('Contraseña mínimo 6 caracteres.'); return; }
    try {
      await register({ name, email: email.trim(), password, company_name: company, phone });
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Error al registrar');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Crear empresa" onBack={() => router.back()} testID="header-register" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.lg }]}>
            Crea tu empresa y serás administrador. Podrás invitar operarios y otros responsables más tarde.
          </Text>
          <Input testID="reg-company" label="Nombre de la empresa *" value={company} onChangeText={setCompany} placeholder="Aluminios Ejemplo SL" />
          <Input testID="reg-name" label="Tu nombre *" value={name} onChangeText={setName} placeholder="Nombre y apellidos" />
          <Input testID="reg-email" label="Email *" value={email} onChangeText={setEmail} placeholder="tu@empresa.com" autoCapitalize="none" keyboardType="email-address" />
          <Input testID="reg-phone" label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+34 ..." keyboardType="phone-pad" />
          <Input testID="reg-password" label="Contraseña *" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />
          {error ? <Text style={{ color: COLORS.danger, marginBottom: SPACING.md }} testID="reg-error">{error}</Text> : null}
          <Button title="Crear empresa" onPress={submit} loading={loading} testID="reg-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({});
