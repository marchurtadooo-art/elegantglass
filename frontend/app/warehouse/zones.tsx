import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO, MAT_CATEGORIES } from '../../src/theme';
import { Button, Card, HeaderBar, Input, Skeleton, EmptyState, FAB } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function Zones() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isManager = user?.role !== 'WORKER';
  const params = useLocalSearchParams<{ highlight?: string }>();
  const [zones, setZones] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showQr, setShowQr] = useState<{ zone: any; b64?: string } | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string>('PERFILERIA');
  const [rows, setRows] = useState('10');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/warehouse/zones'); setZones(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const create = async () => {
    if (!name) { Alert.alert('Nombre', 'Introduce el nombre de la zona.'); return; }
    setSaving(true);
    try {
      await api.post('/warehouse/zones', { name, category: cat, row_count: parseInt(rows) || 10 });
      setShowAdd(false); setName(''); setRows('10'); load();
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };

  const showZoneQr = async (zone: any) => {
    try {
      // Fetch as base64 via blob → b64 (web) or just URL (native Image)
      setShowQr({ zone });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Zonas de almacén" onBack={() => router.back()} />
      {zones === null ? (
        <View style={{ padding: SPACING.lg, gap: 8 }}>{[1,2,3,4].map((i) => <Skeleton key={i} height={80} />)}</View>
      ) : zones.length === 0 ? (
        <View style={{ padding: SPACING.lg }}><Card><EmptyState icon="grid-outline" title="Sin zonas" subtitle="Crea zonas para organizar tu nave." action={isManager ? { label: 'Nueva zona', onPress: () => setShowAdd(true) } : undefined} /></Card></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 96, gap: 8 }}>
          {zones.map((z) => (
            <Card key={z.id} style={params.highlight === z.id ? { borderLeftWidth: 3, borderLeftColor: COLORS.primary } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.icon}><Ionicons name="grid-outline" size={22} color={COLORS.primary} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={TYPO.h3}>{z.name}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{z.category} · {z.lot_count} lotes · {z.row_count} filas</Text>
                </View>
                <TouchableOpacity onPress={() => showZoneQr(z)} style={styles.qrBtn} testID={`zone-qr-${z.id}`}>
                  <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
      {isManager ? <FAB onPress={() => setShowAdd(true)} testID="zone-add-fab" /> : null}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <HeaderBar title="Nueva zona" onBack={() => setShowAdd(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
              <Input label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Zona E — Sellantes" testID="zone-name" />
              <Text style={[TYPO.caption, { marginBottom: 6 }]}>CATEGORÍA</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md }}>
                {MAT_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.key} onPress={() => setCat(c.key)} style={[styles.chip, cat === c.key && styles.chipActive]}>
                    <Text style={{ color: cat === c.key ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label="Número de filas" value={rows} onChangeText={setRows} keyboardType="number-pad" />
              <Button title="Crear zona" icon="add" loading={saving} onPress={create} testID="zone-create" />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!showQr} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowQr(null)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <HeaderBar title={showQr?.zone?.name || 'QR'} onBack={() => setShowQr(null)} />
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, alignItems: 'center' }}>
            {showQr?.zone ? (
              <>
                <Text style={[TYPO.body, { color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg }]}>
                  Imprime este QR y pégalo en la zona física del almacén. Los operarios escanearán el lote y luego este QR para ubicarlo automáticamente.
                </Text>
                <Image source={{ uri: `${BACKEND}/api/warehouse/zones/${showQr.zone.id}/qr.png` }} style={{ width: 280, height: 280, backgroundColor: COLORS.surface }} resizeMode="contain" />
                <Text style={[TYPO.h3, { marginTop: SPACING.md }]}>{showQr.zone.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textTertiary, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) }]}>{showQr.zone.qr_code}</Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 4, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  qrBtn: { padding: 8, borderRadius: 4, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
