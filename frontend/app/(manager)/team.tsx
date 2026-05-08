import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Avatar, Button, Card, Input, Skeleton, EmptyState } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function Team() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'WORKER' | 'MANAGER' | 'ADMIN'>('WORKER');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/users'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    if (!name || !email || !password) { Alert.alert('Faltan campos', 'Nombre, email y contraseña son obligatorios.'); return; }
    setSaving(true);
    try {
      await api.post('/users', { name, email: email.trim(), password, phone, role });
      setShowInvite(false); setName(''); setEmail(''); setPhone(''); setPassword(''); setRole('WORKER');
      load();
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally { setSaving(false); }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <View>
          <Text style={TYPO.h1}>Equipo</Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{data?.length || 0} personas</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.addBtn} testID="invite-btn">
            <Icon name="person-add-outline" size={18} color={COLORS.surface} />
            <Text style={{ color: COLORS.surface, marginLeft: 6, fontWeight: '700' }}>Invitar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {data === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 10 }}>{[1,2,3,4].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : data.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}><Card><EmptyState icon="people-outline" title="Sin equipo" /></Card></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={item.name} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={TYPO.bodyMedium}>{item.name}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary }]} numberOfLines={1}>{item.email}</Text>
                </View>
                <View style={[styles.rolePill, item.role === 'ADMIN' && { backgroundColor: COLORS.primary }]}>
                  <Text style={[styles.rolePillText, { color: item.role === 'ADMIN' ? COLORS.surface : COLORS.textSecondary }]}>{item.role}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 16 }}>
                <Stat label="Obras" value={item.projects_count} />
                <Stat label="Horas mes" value={`${item.hours_this_month}h`} />
                <Stat label="Partes" value={item.logs_this_month} />
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInvite(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <TouchableOpacity onPress={() => setShowInvite(false)}><Icon name="close" size={26} color={COLORS.primary} /></TouchableOpacity>
            <Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Invitar persona</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
            <Input label="Nombre completo" value={name} onChangeText={setName} testID="invite-name" />
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="invite-email" />
            <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="invite-phone" />
            <Input label="Contraseña inicial" value={password} onChangeText={setPassword} secureTextEntry testID="invite-password" />
            <Text style={[TYPO.caption, { marginBottom: 8 }]}>Rol</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.lg }}>
              {(['WORKER','MANAGER','ADMIN'] as const).map((r) => (
                <TouchableOpacity key={r} onPress={() => setRole(r)} style={[styles.roleSel, role === r && styles.roleSelActive]} testID={`role-${r}`}>
                  <Text style={[TYPO.bodyMedium, { color: role === r ? COLORS.surface : COLORS.textPrimary }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Crear cuenta" loading={saving} onPress={submit} testID="invite-submit" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View>
      <Text style={[TYPO.caption, { fontSize: 10 }]}>{label}</Text>
      <Text style={TYPO.bodyMedium}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 4 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  rolePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  roleSel: { flex: 1, padding: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  roleSelActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
