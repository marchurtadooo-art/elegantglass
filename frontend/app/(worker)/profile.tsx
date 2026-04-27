import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Avatar, Button, Card } from '../../src/ui';
import { useAuth } from '../../src/auth';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 12, padding: SPACING.lg, paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Avatar name={user?.name} size={72} />
        <View style={{ marginLeft: SPACING.lg, flex: 1 }}>
          <Text style={TYPO.h2}>{user?.name}</Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.rolePill, { marginTop: 6 }]}>
            <Text style={styles.rolePillText}>{user?.role}</Text>
          </View>
        </View>
      </View>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Cuenta</Text>
      <Card>
        <Row icon="call-outline" label="Teléfono" value={user?.phone || '—'} />
        <Row icon="business-outline" label="Empresa" value="Aluminios Elegant Glass" />
      </Card>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Preferencias</Text>
      <Card>
        <RowAction icon="notifications-outline" label="Notificaciones" onPress={() => Alert.alert('Notificaciones', 'Configura en ajustes del dispositivo.')} />
        <RowAction icon="finger-print-outline" label="Acceso biométrico" onPress={() => Alert.alert('Biometría', 'Disponible al iniciar sesión.')} />
        <RowAction icon="shield-checkmark-outline" label="Seguridad" onPress={() => Alert.alert('Seguridad', 'Tus datos están cifrados.')} />
      </Card>

      <View style={{ marginTop: SPACING.xl }}>
        <Button title="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={confirmLogout} testID="logout-btn" />
      </View>
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={[TYPO.body, { color: COLORS.textSecondary, marginLeft: 12, flex: 1 }]}>{label}</Text>
      <Text style={TYPO.bodyMedium} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RowAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={[TYPO.bodyMedium, { marginLeft: 12, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  rolePill: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, alignSelf: 'flex-start' },
  rolePillText: { color: COLORS.textInverse, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});
