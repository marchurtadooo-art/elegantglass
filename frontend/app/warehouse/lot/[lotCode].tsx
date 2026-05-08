import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../../src/theme';
import { Button, Card, HeaderBar, Input, Skeleton, StatusBadge } from '../../../src/ui';
import { api, apiError } from '../../../src/api';
import { downloadBase64File } from '../../../src/files';
import { useAuth } from '../../../src/auth';

export default function LotDetail() {
  const insets = useSafeAreaInsets();
  const { lotCode } = useLocalSearchParams<{ lotCode: string }>();
  const { user } = useAuth();
  const isManager = user?.role !== 'WORKER';
  const [lot, setLot] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showOutbound, setShowOutbound] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showLocate, setShowLocate] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [labelB64, setLabelB64] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/warehouse/lots/${lotCode}`);
      setLot(r.data);
    } catch (e) { Alert.alert('Error', apiError(e)); router.back(); }
  }, [lotCode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    api.get('/projects').then((r) => setProjects(r.data)).catch(() => {});
    api.get('/warehouse/zones').then((r) => setZones(r.data)).catch(() => {});
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openLabel = async () => {
    try { const r = await api.get(`/warehouse/lots/${lotCode}/label-preview`); setLabelB64(r.data.base64); setShowLabel(true); }
    catch (e) { Alert.alert('Error', apiError(e)); }
  };
  const downloadLabel = async () => {
    try { const r = await api.get(`/warehouse/lots/${lotCode}/label-preview`); await downloadBase64File(r.data); }
    catch (e) { Alert.alert('Error', apiError(e)); }
  };
  const printLabel = async () => {
    try { await api.post(`/warehouse/lots/${lotCode}/print`); Alert.alert('Imprimiendo', 'Etiqueta enviada a la impresora.'); }
    catch (e) { Alert.alert('Impresora', apiError(e)); }
  };

  if (!lot) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
        <HeaderBar title="Cargando..." onBack={() => router.back()} />
        <View style={{ padding: SPACING.lg }}><Skeleton height={200} /></View>
      </View>
    );
  }

  const fmtEur = (n: number) => n == null ? '—' : `€${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`;
  const isLow = lot.quantity_left < 5;
  const isDepleted = lot.status === 'DEPLETED';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title={lot.lot_code} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[TYPO.caption, { fontSize: 11 }]}>{lot.material?.category}</Text>
              <Text style={TYPO.h2} numberOfLines={3}>{lot.material?.name || '—'}</Text>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 4 }]}>{lot.supplier_name}</Text>
            </View>
            <StatusBadge status={lot.status} />
          </View>
          <View style={styles.qtyBox}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPO.caption, { fontSize: 10 }]}>DISPONIBLE</Text>
              <Text style={[TYPO.h1, isDepleted ? { color: COLORS.danger } : isLow ? { color: COLORS.warning } : null]}>
                {lot.quantity_left} <Text style={[TYPO.body, { fontSize: 14 }]}>{lot.material?.unit}</Text>
              </Text>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>de {lot.quantity} iniciales</Text>
            </View>
            {isManager ? (
              <View>
                <Text style={[TYPO.caption, { fontSize: 10 }]}>VALOR</Text>
                <Text style={TYPO.h2}>{fmtEur((lot.unit_price || 0) * lot.quantity_left)}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 14 }}>
            <Info icon="calendar-outline" label={new Date(lot.entry_date).toLocaleDateString('es-ES')} />
            {lot.zone ? <Info icon="location-outline" label={`${lot.zone.name} · ${lot.row_label || ''}`} /> : <Info icon="alert-circle-outline" label="Sin ubicación" />}
          </View>
        </Card>

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Acciones</Text>
        <View style={{ gap: 8 }}>
          <Button title="Sacar a obra" icon="arrow-up-outline" onPress={() => setShowOutbound(true)} testID="action-outbound" disabled={isDepleted} />
          {!lot.zone || isManager ? <Button title="Ubicar en zona" variant="secondary" icon="location-outline" onPress={() => setShowLocate(true)} /> : null}
          {isManager ? <Button title="Ajustar cantidad" variant="secondary" icon="create-outline" onPress={() => setShowAdjust(true)} /> : null}
          {isManager ? <Button title="Etiqueta y QR" variant="secondary" icon="qr-code-outline" onPress={openLabel} /> : null}
          {isManager ? <Button title="Imprimir etiqueta" variant="secondary" icon="print-outline" onPress={printLabel} /> : null}
        </View>

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Movimientos</Text>
        <Card>
          {(lot.movements || []).length === 0 ? <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Sin movimientos.</Text>
            : (lot.movements as any[]).map((m, i) => (
              <View key={i} style={[styles.movRow, i < lot.movements.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                <View style={[styles.movIcon, { backgroundColor: movColor(m.type) + '22' }]}>
                  <Icon name={movIcon(m.type) as any} size={16} color={movColor(m.type)} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={TYPO.bodyMedium}>{movLabel(m.type)} {m.quantity ? `· ${m.quantity}` : ''}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]} numberOfLines={1}>
                    {m.worker_name || '—'} · {new Date(m.timestamp).toLocaleString('es-ES')}
                    {m.project_name ? ` · ${m.project_name}` : ''}
                  </Text>
                </View>
              </View>
            ))
          }
        </Card>
      </ScrollView>

      <OutboundModal visible={showOutbound} onClose={() => setShowOutbound(false)} lot={lot} projects={projects} onDone={() => { setShowOutbound(false); load(); }} />
      <LocateModal visible={showLocate} onClose={() => setShowLocate(false)} lotCode={lotCode!} zones={zones} onDone={() => { setShowLocate(false); load(); }} />
      <AdjustModal visible={showAdjust} onClose={() => setShowAdjust(false)} lotCode={lotCode!} onDone={() => { setShowAdjust(false); load(); }} />
      <LabelModal visible={showLabel} onClose={() => setShowLabel(false)} base64={labelB64} onDownload={downloadLabel} onPrint={printLabel} />
    </View>
  );
}

function Info({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={14} color={COLORS.textSecondary} />
      <Text style={[TYPO.body, { color: COLORS.textSecondary, marginLeft: 4, fontSize: 13 }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function movIcon(t: string) {
  return ({ INBOUND: 'arrow-down-outline', OUTBOUND: 'arrow-up-outline', LOCATE: 'location-outline', ADJUST: 'create-outline', RETURN: 'return-up-back-outline' } as any)[t] || 'ellipse-outline';
}
function movColor(t: string) {
  return ({ INBOUND: COLORS.success, OUTBOUND: COLORS.info, LOCATE: COLORS.textSecondary, ADJUST: COLORS.warning, RETURN: COLORS.success } as any)[t] || COLORS.textSecondary;
}
function movLabel(t: string) {
  return ({ INBOUND: 'Entrada', OUTBOUND: 'Salida a obra', LOCATE: 'Ubicado', ADJUST: 'Ajuste', RETURN: 'Devolución' } as any)[t] || t;
}

function OutboundModal({ visible, onClose, lot, projects, onDone }: any) {
  const [qty, setQty] = useState('1');
  const [pid, setPid] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible && projects?.length) setPid(projects[0].id); }, [visible, projects]);
  const submit = async () => {
    const q = parseFloat(qty.replace(',', '.'));
    if (!q || q <= 0) { Alert.alert('Cantidad', 'Indica una cantidad válida.'); return; }
    if (!pid) { Alert.alert('Obra', 'Selecciona una obra.'); return; }
    setSaving(true);
    try { await api.post(`/warehouse/lots/${lot.lot_code}/outbound`, { quantity: q, project_id: pid }); onDone(); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <HeaderBar title="Sacar a obra" onBack={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Disponible: {lot?.quantity_left} {lot?.material?.unit}</Text>
            <View style={{ height: 12 }} />
            <Input label="Cantidad" value={qty} onChangeText={setQty} keyboardType="decimal-pad" testID="outbound-qty" />
            <Text style={[TYPO.caption, { marginBottom: 6 }]}>OBRA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {projects.map((p: any) => (
                <TouchableOpacity key={p.id} onPress={() => setPid(p.id)} style={[styles.chip, pid === p.id && styles.chipActive]} testID={`out-proj-${p.id}`}>
                  <Text style={{ color: pid === p.id ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ height: SPACING.lg }} />
            <Button title="Confirmar salida" loading={saving} onPress={submit} testID="outbound-submit" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function LocateModal({ visible, onClose, lotCode, zones, onDone }: any) {
  const [zid, setZid] = useState('');
  const [row, setRow] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible && zones?.length) setZid(zones[0].id); }, [visible, zones]);
  const submit = async () => {
    if (!zid) return;
    setSaving(true);
    try { await api.post(`/warehouse/lots/${lotCode}/locate`, { zone_id: zid, row_label: row }); onDone(); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <HeaderBar title="Ubicar en zona" onBack={onClose} />
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <Text style={[TYPO.caption, { marginBottom: 6 }]}>ZONA</Text>
          {zones.map((z: any) => (
            <TouchableOpacity key={z.id} onPress={() => setZid(z.id)} style={[styles.zoneRow, zid === z.id && { borderColor: COLORS.primary }]} testID={`zone-${z.id}`}>
              <Icon name={zid === z.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={zid === z.id ? COLORS.primary : COLORS.textTertiary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={TYPO.bodyMedium}>{z.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>{z.category} · {z.lot_count} lotes</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: SPACING.md }} />
          <Input label="Fila / posición" value={row} onChangeText={setRow} placeholder="Ej: Fila 3" />
          <Button title="Ubicar" loading={saving} onPress={submit} testID="locate-submit" />
        </ScrollView>
      </View>
    </Modal>
  );
}

function AdjustModal({ visible, onClose, lotCode, onDone }: any) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const q = parseFloat(qty.replace(',', '.'));
    if (isNaN(q) || q === 0) { Alert.alert('Cantidad', 'Introduce un valor (puede ser negativo).'); return; }
    setSaving(true);
    try { await api.post(`/warehouse/lots/${lotCode}/adjust`, { quantity: q, note }); onDone(); }
    catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <HeaderBar title="Ajustar cantidad" onBack={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
            <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.md }]}>Suma o resta unidades. Usa valor negativo para descontar (ej: -2).</Text>
            <Input label="Cantidad (+/-)" value={qty} onChangeText={setQty} keyboardType="numbers-and-punctuation" testID="adjust-qty" />
            <Input label="Motivo" value={note} onChangeText={setNote} />
            <Button title="Aplicar ajuste" loading={saving} onPress={submit} testID="adjust-submit" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function LabelModal({ visible, onClose, base64, onDownload, onPrint }: any) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <HeaderBar title="Etiqueta" onBack={onClose} />
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, alignItems: 'center' }}>
          {base64 ? <Image source={{ uri: `data:image/png;base64,${base64}` }} style={{ width: '100%', aspectRatio: 600/760, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }} resizeMode="contain" /> : null}
          <View style={{ height: SPACING.lg }} />
          <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <View style={{ flex: 1 }}><Button title="Descargar PNG" variant="secondary" icon="download-outline" onPress={onDownload} /></View>
            <View style={{ flex: 1 }}><Button title="Imprimir" icon="print-outline" onPress={onPrint} /></View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  qtyBox: { flexDirection: 'row', marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  movRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  movIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, maxWidth: 220 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  zoneRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, backgroundColor: COLORS.surface },
});
