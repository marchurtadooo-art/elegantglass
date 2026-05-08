import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Avatar, Button, Card, Input } from '../../src/ui';
import { useAuth } from '../../src/auth';
import { api, apiError } from '../../src/api';
import { downloadBase64File } from '../../src/files';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const [company, setCompany] = useState<any | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { api.get('/company').then((r) => setCompany(r.data)).catch(() => {}); }, []);

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const exportData = async () => {
    setExporting(true);
    try { const r = await api.get('/gdpr/export'); await downloadBase64File(r.data); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setExporting(false); }
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
          <View style={[styles.rolePill, { marginTop: 6 }]}><Text style={styles.rolePillText}>{user?.role}</Text></View>
        </View>
      </View>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Cuenta</Text>
      <Card>
        <Row icon="person-outline" label="Editar perfil" onPress={() => setShowProfile(true)} />
        <Row icon="business-outline" label={company?.name || 'Mi empresa'} onPress={() => Alert.alert('Empresa', `${company?.name || ''}\n${company?.address || ''}\n${company?.phone || ''}`)} />
        <Row icon="call-outline" label={user?.phone || 'Sin teléfono'} onPress={() => setShowProfile(true)} />
      </Card>

      <View style={styles.privacy}>
        <Icon name="shield-checkmark" size={20} color={COLORS.success} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[TYPO.bodyMedium, { color: COLORS.success }]}>Sin acceso a datos financieros</Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }]}>
            Como operario nunca verás presupuestos, costes ni precios. Tu privacidad y la confidencialidad de tu jefe están protegidas.
          </Text>
        </View>
      </View>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Datos</Text>
      <Card>
        <Row icon="cloud-download-outline" label={exporting ? 'Exportando...' : 'Exportar mis datos'} onPress={exportData} />
        <Row icon="play-circle-outline" label="Ver tour de bienvenida" onPress={() => router.push('/onboarding')} />
        <Row icon="shield-checkmark-outline" label="Privacidad" onPress={() => Alert.alert('Privacidad', 'Tus datos están cifrados y se almacenan exclusivamente para la gestión de tu empresa. Como operario nunca verás información económica.')} />
      </Card>

      <View style={{ marginTop: SPACING.xl }}>
        <Button title="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={confirmLogout} testID="logout-btn" />
      </View>

      <ProfileModal visible={showProfile} user={user} onClose={() => setShowProfile(false)} onSaved={async () => { setShowProfile(false); await refreshUser(); }} />
    </ScrollView>
  );
}

function Row({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <Icon name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={[TYPO.bodyMedium, { marginLeft: 12, flex: 1 }]} numberOfLines={1}>{label}</Text>
      <Icon name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

function ProfileModal({ visible, user, onClose, onSaved }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (user) { setName(user.name || ''); setPhone(user.phone || ''); } }, [user]);
  const save = async () => {
    setSaving(true);
    try { await api.patch('/profile', { name, phone }); onSaved(); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <TouchableOpacity onPress={onClose}><Icon name="close" size={26} /></TouchableOpacity>
          <Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Mi perfil</Text>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            <Input label="Nombre" value={name} onChangeText={setName} testID="profile-name" />
            <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Button title="Guardar" loading={saving} onPress={save} testID="save-profile" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  rolePill: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, alignSelf: 'flex-start' },
  rolePillText: { color: COLORS.textInverse, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.successBg, borderRadius: 4, padding: 12, marginTop: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.success },
});
