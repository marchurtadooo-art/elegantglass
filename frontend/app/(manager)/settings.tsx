import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Avatar, Button, Card, HeaderBar, Input } from '../../src/ui';
import { useAuth } from '../../src/auth';
import { api, apiError } from '../../src/api';
import { downloadBase64File } from '../../src/files';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const [company, setCompany] = useState<any | null>(null);
  const [showCompany, setShowCompany] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notifAlerts, setNotifAlerts] = useState(true);
  const [notifReports, setNotifReports] = useState(true);
  const [notifLogs, setNotifLogs] = useState(false);

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
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: SPACING.lg, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Avatar name={user?.name} size={72} />
        <View style={{ marginLeft: SPACING.lg, flex: 1 }}>
          <Text style={TYPO.h2}>{user?.name}</Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.rolePill, { marginTop: 6 }]}><Text style={styles.rolePillText}>{user?.role}</Text></View>
        </View>
      </View>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Empresa</Text>
      <Card>
        <Row icon="business-outline" label={company?.name || 'Mi empresa'} onPress={() => setShowCompany(true)} />
        <Row icon="cube-outline" label="Catálogo de materiales" onPress={() => router.push('/material/catalog')} />
        <Row icon="alert-circle-outline" label="Alertas" onPress={() => router.push('/alerts')} />
      </Card>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Cuenta</Text>
      <Card>
        <Row icon="person-outline" label="Editar perfil" onPress={() => setShowProfile(true)} />
        <Row icon="cloud-download-outline" label={exporting ? 'Exportando...' : 'Exportar datos (GDPR)'} onPress={exportData} />
        <Row icon="play-circle-outline" label="Ver tour de bienvenida" onPress={() => router.push('/onboarding')} />
      </Card>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Notificaciones</Text>
      <Card>
        <Toggle label="Alertas críticas" value={notifAlerts} onChange={setNotifAlerts} />
        <Toggle label="Reportes semanales" value={notifReports} onChange={setNotifReports} />
        <Toggle label="Recordatorio diario operarios" value={notifLogs} onChange={setNotifLogs} />
      </Card>

      <View style={{ marginTop: SPACING.xl }}>
        <Button title="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={confirmLogout} testID="logout-btn" />
      </View>
      <Text style={[TYPO.body, { color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xl }]}>GLASSWORK v1.0.0</Text>

      <CompanyModal visible={showCompany} company={company} onClose={() => setShowCompany(false)} onSaved={(c) => { setCompany(c); setShowCompany(false); }} />
      <ProfileModal visible={showProfile} user={user} onClose={() => setShowProfile(false)} onSaved={async () => { setShowProfile(false); await refreshUser(); }} />
    </ScrollView>
  );
}

function Row({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={[TYPO.bodyMedium, { marginLeft: 12, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} style={styles.row} activeOpacity={0.7}>
      <Text style={[TYPO.bodyMedium, { flex: 1 }]}>{label}</Text>
      <View style={[styles.tog, value && styles.togOn]}>
        <View style={[styles.togDot, value && styles.togDotOn]} />
      </View>
    </TouchableOpacity>
  );
}

function CompanyModal({ visible, company, onClose, onSaved }: any) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (company) { setName(company.name || ''); setAddress(company.address || ''); setPhone(company.phone || ''); setEmail(company.email || ''); }
  }, [company]);
  const save = async () => {
    setSaving(true);
    try { const r = await api.patch('/company', { name, address, phone, email }); onSaved(r.data); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={modalStyles.head}><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} /></TouchableOpacity><Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Empresa</Text></View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            <Input label="Nombre" value={name} onChangeText={setName} testID="company-name" />
            <Input label="Dirección" value={address} onChangeText={setAddress} />
            <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Button title="Guardar" loading={saving} onPress={save} testID="save-company" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
        <View style={modalStyles.head}><TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} /></TouchableOpacity><Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Mi perfil</Text></View>
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
  tog: { width: 44, height: 26, borderRadius: 13, backgroundColor: COLORS.border, padding: 2 },
  togOn: { backgroundColor: COLORS.success },
  togDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.surface },
  togDotOn: { transform: [{ translateX: 18 }] },
});

const modalStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
});
