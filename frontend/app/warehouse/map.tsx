/**
 * GLASSWORK — Warehouse Map (tablet-optimized).
 *
 * 6 zones × up to 12 rows. Each cell shows material code/name and stock,
 * color-coded:
 *   - green  → OK (stock > min)
 *   - yellow → LOW (0 < stock ≤ min)
 *   - red    → OUT (stock = 0)
 *
 * Tapping a cell opens a tablet flow:
 *   Step 1: review location info
 *   Step 2: enter quantity (big numeric pad)
 *   Step 3: confirm IN / OUT  → POST /warehouse/locations/{id}/stock
 *
 * A floating QR scan button opens /warehouse/scan?return=map which can
 * jump directly to a location by QR.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { HeaderBar, Skeleton, EmptyState, Card } from '../../src/ui';
import { api, apiError } from '../../src/api';

type Loc = {
  id: string;
  zone_id: string;
  zone_number: number;
  zone_name: string;
  row_number: number;
  material_id: string;
  material_code: string;
  qr_code: string;
  quantity: number;
  min_quantity: number;
  status: 'OK' | 'LOW' | 'OUT';
  material: { name?: string; unit?: string; code?: string; family?: string; supplier?: string };
};

type StatusColor = { bg: string; fg: string; border: string; tag: string };

const STATUS: Record<string, StatusColor> = {
  OK:  { bg: '#E8F5E9', fg: '#1B5E20', border: '#43A047', tag: '#2E7D32' },
  LOW: { bg: '#FFF8E1', fg: '#7C4A00', border: '#FFB300', tag: '#F57C00' },
  OUT: { bg: '#FFEBEE', fg: '#7F1D1D', border: '#E53935', tag: '#C62828' },
};

export default function WarehouseMap() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const params = useLocalSearchParams<{ qr?: string; zoneNumber?: string }>();
  const [locs, setLocs] = useState<Loc[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<Loc | null>(null);
  const [zoneFilter, setZoneFilter] = useState<number | null>(null);

  const isTablet = winW >= 700;
  const cellW = isTablet ? '24%' : '48%';

  const load = useCallback(async () => {
    try {
      const r = await api.get('/warehouse/locations');
      setLocs(r.data || []);
    } catch (e) {
      Alert.alert('Error', apiError(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Allow opening a specific location via deep-link ?qr=Z1-F3-COR-7905
  useFocusEffect(useCallback(() => {
    if (!params?.qr || !locs?.length) return;
    const found = locs.find((l) => l.qr_code === params.qr);
    if (found) setActive(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.qr, locs?.length]));

  // Apply ?zoneNumber=X (from scanning a zone QR) — filter the map to that zone
  useFocusEffect(useCallback(() => {
    if (params?.zoneNumber == null) return;
    const n = parseInt(String(params.zoneNumber), 10);
    if (!Number.isNaN(n)) setZoneFilter(n);
  }, [params?.zoneNumber]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const byZone = useMemo(() => {
    const map: Record<number, { zone_id: string; zone_number: number; zone_name: string; items: Loc[] }> = {};
    (locs || []).forEach((l) => {
      if (zoneFilter != null && l.zone_number !== zoneFilter) return;
      const z = map[l.zone_number] = map[l.zone_number] || {
        zone_id: l.zone_id, zone_number: l.zone_number, zone_name: l.zone_name, items: [],
      };
      z.items.push(l);
    });
    return Object.values(map).sort((a, b) => a.zone_number - b.zone_number);
  }, [locs, zoneFilter]);

  const stats = useMemo(() => {
    const items = (locs || []).filter((l) => zoneFilter == null || l.zone_number === zoneFilter);
    return {
      total: items.length,
      ok: items.filter((l) => l.status === 'OK').length,
      low: items.filter((l) => l.status === 'LOW').length,
      out: items.filter((l) => l.status === 'OUT').length,
    };
  }, [locs, zoneFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Mapa de almacén" onBack={() => router.back()} right={(
        <TouchableOpacity
          onPress={() => router.push('/warehouse/scan?return=map' as any)}
          style={styles.scanFab}
          activeOpacity={0.85}
        >
          <Icon name="qr-code-outline" size={18} color={COLORS.surface} />
          <Text style={styles.scanFabText}>Escanear</Text>
        </TouchableOpacity>
      )} />

      {locs === null ? (
        <View style={{ padding: SPACING.lg, gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={140} />)}
        </View>
      ) : locs.length === 0 ? (
        <View style={{ padding: SPACING.lg }}>
          <Card><EmptyState icon="cube-outline" title="Sin ubicaciones" subtitle="Importa el planning del almacén desde Ajustes." /></Card>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        >
          {/* Stats bar */}
          <View style={styles.statsRow}>
            <Stat label="Ubicaciones" value={stats.total} />
            <Stat label="Stock OK" value={stats.ok} color={STATUS.OK.tag} />
            <Stat label="Stock bajo" value={stats.low} color={STATUS.LOW.tag} />
            <Stat label="Agotado" value={stats.out} color={STATUS.OUT.tag} />
          </View>

          {zoneFilter != null && (
            <TouchableOpacity
              onPress={() => setZoneFilter(null)}
              activeOpacity={0.85}
              style={styles.zoneFilterBanner}
              testID="zone-filter-clear"
            >
              <Icon name="filter" size={16} color={COLORS.primary} />
              <Text style={styles.zoneFilterText}>
                Filtrado por <Text style={{ fontWeight: '900' }}>Zona Z{zoneFilter}</Text> · pulsa para ver todas
              </Text>
              <Icon name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {byZone.map((z) => (
            <View key={z.zone_number} style={{ marginTop: SPACING.lg }}>
              <View style={styles.zoneHeader}>
                <View style={styles.zoneBadge}>
                  <Text style={styles.zoneBadgeText}>Z{z.zone_number}</Text>
                </View>
                <Text style={styles.zoneTitle} numberOfLines={1}>{z.zone_name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textTertiary }]}>{z.items.length} ubicaciones</Text>
              </View>
              <View style={styles.cellGrid}>
                {z.items.sort((a, b) => a.row_number - b.row_number).map((loc) => (
                  <Cell key={loc.id} loc={loc} width={cellW} onPress={() => setActive(loc)} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Tablet flow modal */}
      {active && (
        <StockFlowModal
          visible={!!active}
          loc={active}
          onClose={() => setActive(null)}
          onSaved={(updated) => {
            setLocs((prev) => (prev || []).map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setActive(null);
          }}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------
// Cell
// -----------------------------------------------------------------------
function Cell({ loc, width, onPress }: { loc: Loc; width: any; onPress: () => void }) {
  const s = STATUS[loc.status] ?? STATUS.OK;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.cell, { width, backgroundColor: s.bg, borderColor: s.border }]}
      testID={`loc-cell-${loc.qr_code}`}
    >
      <View style={styles.cellTopRow}>
        <View style={[styles.rowChip, { backgroundColor: s.border }]}>
          <Text style={styles.rowChipText}>F{loc.row_number}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: s.tag }]} />
      </View>
      <Text style={[styles.cellCode, { color: s.fg }]} numberOfLines={1}>{loc.material_code}</Text>
      <Text style={[styles.cellName, { color: s.fg }]} numberOfLines={2}>
        {loc.material?.name || ''}
      </Text>
      <View style={styles.cellFooter}>
        <Text style={[styles.cellQty, { color: s.fg }]}>{loc.quantity}</Text>
        <Text style={[styles.cellUnit, { color: s.fg }]}>{loc.material?.unit || ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------
// Stock flow modal — Step 1 review, Step 2 quantity, Step 3 confirm
// -----------------------------------------------------------------------
function StockFlowModal({
  visible, loc, onClose, onSaved,
}: { visible: boolean; loc: Loc; onClose: () => void; onSaved: (l: Loc) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) { setStep(1); setDirection('IN'); setQty(''); }
  }, [visible, loc?.id]);

  const s = STATUS[loc.status] ?? STATUS.OK;
  const numericQty = parseFloat(qty.replace(',', '.')) || 0;

  const goNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) {
      if (numericQty <= 0) { Alert.alert('Cantidad inválida', 'Introduce una cantidad mayor que cero.'); return; }
      setStep(3);
    }
  };

  const confirm = async () => {
    setSaving(true);
    try {
      const delta = direction === 'IN' ? numericQty : -numericQty;
      const r = await api.post(`/warehouse/locations/${loc.id}/stock`, { delta });
      onSaved(r.data);
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const tap = (k: string) => {
    if (k === '⌫') return setQty((q) => q.slice(0, -1));
    if (k === '.') return setQty((q) => q.includes('.') ? q : (q || '0') + '.');
    setQty((q) => (q === '0' ? k : q + k));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={modalStyles.head}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="close" size={28} />
          </TouchableOpacity>
          <Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 28 }]}>
            {step === 1 ? 'Ubicación' : step === 2 ? 'Cantidad' : 'Confirmar'}
          </Text>
        </View>

        {/* Progress dots */}
        <View style={modalStyles.dots}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[modalStyles.dot, n === step && modalStyles.dotActive, n < step && modalStyles.dotDone]} />
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header card — always visible */}
          <View style={[modalStyles.infoCard, { backgroundColor: s.bg, borderColor: s.border }]}>
            <View style={modalStyles.infoTop}>
              <View style={[modalStyles.qrPill, { backgroundColor: s.border }]}>
                <Text style={modalStyles.qrPillText}>{loc.qr_code}</Text>
              </View>
              <Text style={[modalStyles.infoZone, { color: s.fg }]}>{loc.zone_name}</Text>
            </View>
            <Text style={[modalStyles.infoCode, { color: s.fg }]}>{loc.material_code}</Text>
            <Text style={[modalStyles.infoName, { color: s.fg }]}>{loc.material?.name || ''}</Text>
            <Text style={[modalStyles.infoQty, { color: s.fg }]}>
              {loc.quantity} <Text style={{ fontSize: 18 }}>{loc.material?.unit || ''}</Text>
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Step 1 — direction */}
            {step === 1 && (
              <>
                <Text style={modalStyles.stepLabel}>¿Qué quieres registrar?</Text>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[modalStyles.bigOption, direction === 'IN' && modalStyles.bigOptionInActive]}
                    onPress={() => setDirection('IN')}
                    activeOpacity={0.85}
                  >
                    <Icon name="arrow-down-circle-outline" size={36} color={direction === 'IN' ? COLORS.surface : COLORS.success} />
                    <Text style={[modalStyles.bigOptionText, direction === 'IN' && { color: COLORS.surface }]}>Entrada</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.bigOption, direction === 'OUT' && modalStyles.bigOptionOutActive]}
                    onPress={() => setDirection('OUT')}
                    activeOpacity={0.85}
                  >
                    <Icon name="arrow-up-circle-outline" size={36} color={direction === 'OUT' ? COLORS.surface : COLORS.danger} />
                    <Text style={[modalStyles.bigOptionText, direction === 'OUT' && { color: COLORS.surface }]}>Salida</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 2 — quantity (big numpad) */}
            {step === 2 && (
              <>
                <Text style={modalStyles.stepLabel}>{direction === 'IN' ? 'Entrada de material' : 'Salida de material'}</Text>
                <View style={modalStyles.qtyBox}>
                  <Text style={modalStyles.qtyValue}>{qty || '0'}</Text>
                  <Text style={modalStyles.qtyUnit}>{loc.material?.unit || ''}</Text>
                </View>
                <View style={modalStyles.numpad}>
                  {['7','8','9','4','5','6','1','2','3','.','0','⌫'].map((k) => (
                    <TouchableOpacity key={k} style={modalStyles.numKey} onPress={() => tap(k)} activeOpacity={0.7}>
                      <Text style={modalStyles.numKeyText}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Step 3 — review */}
            {step === 3 && (
              <>
                <Text style={modalStyles.stepLabel}>Revisa y confirma</Text>
                <View style={modalStyles.reviewCard}>
                  <ReviewRow label="Ubicación" value={loc.qr_code} />
                  <ReviewRow label="Material" value={`${loc.material_code} · ${loc.material?.name || ''}`} />
                  <ReviewRow label="Operación" value={direction === 'IN' ? 'Entrada (+)' : 'Salida (−)'} color={direction === 'IN' ? STATUS.OK.tag : STATUS.OUT.tag} />
                  <ReviewRow label="Cantidad" value={`${numericQty} ${loc.material?.unit || ''}`} bold />
                  <ReviewRow label="Stock antes" value={`${loc.quantity} ${loc.material?.unit || ''}`} />
                  <ReviewRow
                    label="Stock después"
                    value={`${(loc.quantity + (direction === 'IN' ? numericQty : -numericQty))} ${loc.material?.unit || ''}`}
                    bold
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Action bar */}
          <View style={[modalStyles.actionBar, { paddingBottom: 16 }]}>
            {step > 1 && step < 3 && (
              <TouchableOpacity style={[modalStyles.actionBtn, modalStyles.actionBtnGhost]} onPress={() => setStep((s) => (s - 1) as any)} activeOpacity={0.85}>
                <Text style={[modalStyles.actionBtnText, { color: COLORS.textPrimary }]}>Atrás</Text>
              </TouchableOpacity>
            )}
            {step < 3 ? (
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.actionBtnPrimary]}
                onPress={goNext}
                activeOpacity={0.85}
                disabled={step === 2 && numericQty <= 0}
              >
                <Text style={[modalStyles.actionBtnText, { color: COLORS.surface }]}>Siguiente</Text>
                <Icon name="arrow-forward" size={20} color={COLORS.surface} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[modalStyles.actionBtn, modalStyles.actionBtnGhost]} onPress={() => setStep(2)} disabled={saving} activeOpacity={0.85}>
                  <Text style={[modalStyles.actionBtnText, { color: COLORS.textPrimary }]}>Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.actionBtn, direction === 'IN' ? modalStyles.actionBtnConfirmIn : modalStyles.actionBtnConfirmOut]}
                  onPress={confirm}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator color={COLORS.surface} /> : (
                    <>
                      <Icon name={direction === 'IN' ? 'checkmark-circle' : 'remove-circle'} size={22} color={COLORS.surface} />
                      <Text style={[modalStyles.actionBtnText, { color: COLORS.surface }]}>Confirmar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ReviewRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={modalStyles.reviewRow}>
      <Text style={modalStyles.reviewLabel}>{label}</Text>
      <Text style={[modalStyles.reviewValue, color ? { color } : null, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const styles = StyleSheet.create({
  scanFab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 4,
  },
  scanFabText: { color: COLORS.surface, fontWeight: '700', marginLeft: 6, fontSize: 13 },

  statsRow: {
    flexDirection: 'row', gap: 10, marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, letterSpacing: 0.3 },

  zoneFilterBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary + '14',
    borderWidth: 1, borderColor: COLORS.primary + '55',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: SPACING.md,
  },
  zoneFilterText: { flex: 1, color: COLORS.textPrimary, fontSize: 13 },

  zoneHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4,
  },
  zoneBadge: {
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    marginRight: 10,
  },
  zoneBadgeText: { color: COLORS.surface, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  zoneTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 0.3 },

  cellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    borderRadius: 12, borderWidth: 2, padding: 12, minHeight: 130,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cellTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rowChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  rowChipText: { color: COLORS.surface, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cellCode: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  cellName: { fontSize: 12, marginTop: 2, marginBottom: 8, opacity: 0.85 },
  cellFooter: { flexDirection: 'row', alignItems: 'baseline', marginTop: 'auto' },
  cellQty: { fontSize: 22, fontWeight: '900' },
  cellUnit: { fontSize: 13, marginLeft: 4 },
});

const modalStyles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 28 },
  dotDone: { backgroundColor: COLORS.success },

  infoCard: {
    margin: SPACING.lg, padding: SPACING.lg, borderRadius: 14, borderWidth: 2,
  },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  qrPillText: { color: COLORS.surface, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  infoZone: { fontWeight: '800', fontSize: 15 },
  infoCode: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5, marginTop: 10 },
  infoName: { fontSize: 15, opacity: 0.85, marginTop: 2 },
  infoQty: { fontSize: 38, fontWeight: '900', marginTop: 12 },

  stepLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },

  bigOption: {
    flex: 1, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.border,
  },
  bigOptionInActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  bigOptionOutActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  bigOptionText: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },

  qtyBox: {
    backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 24,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', gap: 10,
  },
  qtyValue: { fontSize: 56, fontWeight: '900', color: COLORS.textPrimary },
  qtyUnit: { fontSize: 22, color: COLORS.textSecondary, alignSelf: 'flex-end', paddingBottom: 14 },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  numKey: {
    width: '31%', backgroundColor: COLORS.surface, paddingVertical: 22,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  numKeyText: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },

  reviewCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  reviewLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  reviewValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  actionBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: SPACING.lg, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  actionBtn: {
    flex: 1, minHeight: 56, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  actionBtnGhost: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnConfirmIn: { backgroundColor: COLORS.success },
  actionBtnConfirmOut: { backgroundColor: COLORS.danger },
  actionBtnText: { fontSize: 16, fontWeight: '800' },
});
