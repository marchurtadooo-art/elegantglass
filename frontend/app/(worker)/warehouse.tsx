import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, KpiCard, Skeleton, EmptyState } from '../../src/ui';
import { FadeInUp } from '../../src/animations';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';

/** Almacén entry tab — same component for both worker and manager.
 * Shows quick actions + stock summary. */
export default function WarehouseTab() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isManager = user?.role !== 'WORKER';
  const [stock, setStock] = useState<any[] | null>(null);
  const [dash, setDash] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [api.get('/warehouse/stock')];
      if (isManager) promises.push(api.get('/warehouse/dashboard'));
      const [s, d] = await Promise.all(promises);
      setStock(s.data);
      if (d) setDash(d.data);
    } catch {}
  }, [isManager]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const fmtEur = (n: number) => `€${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <View>
          <Text style={[TYPO.caption]}>NAVE</Text>
          <Text style={TYPO.h1}>Almacén</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/warehouse/scan')} style={styles.scanBtn} testID="warehouse-scan-btn">
          <Icon name="qr-code-outline" size={22} color={COLORS.surface} />
          <Text style={{ color: COLORS.surface, fontWeight: '700', marginLeft: 6 }}>Escanear</Text>
        </TouchableOpacity>
      </View>

      {isManager && dash ? (
        <>
          <View style={[styles.kpiRow, { marginTop: SPACING.md }]}>
            <FadeInUp delay={0} style={{ flex: 1 }}><KpiCard label="Lotes en stock" value={dash.lots_count} icon="cube-outline" /></FadeInUp>
            <View style={{ width: SPACING.md }} />
            <FadeInUp delay={80} style={{ flex: 1 }}><KpiCard label="Movs. hoy" value={dash.movements_today} icon="swap-horizontal-outline" /></FadeInUp>
          </View>
          <View style={[styles.kpiRow, { marginTop: SPACING.md }]}>
            <FadeInUp delay={160} style={{ flex: 1 }}><KpiCard label="Valor stock" value={fmtEur(dash.stock_value)} icon="cash-outline" /></FadeInUp>
            <View style={{ width: SPACING.md }} />
            <FadeInUp delay={240} style={{ flex: 1 }}><KpiCard label="Stock bajo" value={dash.low_stock_count} icon="warning-outline" color={dash.low_stock_count > 0 ? COLORS.warning : undefined} /></FadeInUp>
          </View>
        </>
      ) : null}

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Acciones</Text>
      <View style={styles.grid}>
        <Action icon="qr-code-outline" label="Escanear QR" onPress={() => router.push('/warehouse/scan')} />
        {isManager ? <Action icon="archive-outline" label="Recibir material" onPress={() => router.push('/warehouse/receive')} /> : null}
        <Action icon="layers-outline" label="Stock" onPress={() => router.push('/warehouse/stock')} />
        <Action icon="grid-outline" label="Zonas" onPress={() => router.push('/warehouse/zones')} />
      </View>

      {isManager && dash?.low_stock?.length > 0 ? (
        <>
          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Stock bajo</Text>
          <Card>
            {dash.low_stock.map((s: any, i: number) => (
              <View key={i} style={[styles.row, i < dash.low_stock.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                <Icon name="warning" size={16} color={COLORS.warning} />
                <Text style={[TYPO.bodyMedium, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>{s.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.warning, fontWeight: '700' }]}>{s.total} {s.unit}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.qa}>
      <Icon name={icon} size={24} color={COLORS.primary} />
      <Text style={[TYPO.bodyMedium, { marginTop: 8 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 4 },
  kpiRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  qa: {
    width: '48%', backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.border, minHeight: 100, justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
