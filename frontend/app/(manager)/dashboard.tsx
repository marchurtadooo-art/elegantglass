import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, KpiCard, Skeleton, EmptyState, Avatar, SeverityBadge } from '../../src/ui';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([api.get('/dashboard/summary'), api.get('/alerts')]);
      setData(d.data);
      setAlerts(a.data.slice(0, 4));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const fmtEur = (n: number) => `€${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
  const max = Math.max(...(data?.spend_by_project || []).map((x: any) => x.amount), 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={[TYPO.caption]}>RESUMEN</Text>
          <Text style={TYPO.h1}>Hola, {user?.name?.split(' ')[0] || ''}</Text>
        </View>
        <TouchableOpacity testID="goto-alerts" onPress={() => router.push('/alerts')} style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
          {data?.open_alerts > 0 ? <View style={styles.dot} /> : null}
        </TouchableOpacity>
      </View>

      {data === null ? (
        <View style={{ marginTop: SPACING.lg, gap: 12 }}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={180} />
        </View>
      ) : (
        <>
          <View style={[styles.kpiRow, { marginTop: SPACING.lg }]}>
            <KpiCard testID="kpi-active" label="Obras activas" value={data.active_projects} icon="briefcase-outline" />
            <View style={{ width: SPACING.md }} />
            <KpiCard testID="kpi-workers" label="Operarios hoy" value={data.workers_today} icon="people-outline" />
          </View>
          <View style={[styles.kpiRow, { marginTop: SPACING.md }]}>
            <KpiCard testID="kpi-week" label="Gasto semana" value={fmtEur(data.week_spend)} icon="trending-up-outline" />
            <View style={{ width: SPACING.md }} />
            <KpiCard testID="kpi-month" label="Gasto mes" value={fmtEur(data.month_spend)} icon="cash-outline" />
          </View>
          <View style={[styles.kpiRow, { marginTop: SPACING.md }]}>
            <KpiCard testID="kpi-pending" label="Partes pendientes" value={data.pending_logs} icon="clipboard-outline" color={data.pending_logs > 0 ? COLORS.warning : undefined} />
            <View style={{ width: SPACING.md }} />
            <KpiCard testID="kpi-alerts" label="Alertas abiertas" value={data.open_alerts} icon="alert-circle-outline" color={data.open_alerts > 0 ? COLORS.danger : undefined} />
          </View>

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Gasto por obra (30d)</Text>
          {data.spend_by_project.length === 0 ? (
            <Card><EmptyState icon="bar-chart-outline" title="Sin datos" subtitle="Aún no hay gasto registrado." /></Card>
          ) : (
            <Card>
              {data.spend_by_project.map((s: any, i: number) => (
                <View key={i} style={{ marginBottom: i === data.spend_by_project.length - 1 ? 0 : SPACING.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={TYPO.bodyMedium} numberOfLines={1}>{s.project}</Text>
                    <Text style={TYPO.bodyMedium}>{fmtEur(s.amount)}</Text>
                  </View>
                  <View style={styles.barOuter}>
                    <View style={[styles.barInner, { width: `${(s.amount / max) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </Card>
          )}

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Actividad fotográfica de hoy</Text>
          {data.photo_feed.length === 0 ? (
            <Card><EmptyState icon="camera-outline" title="Sin fotos hoy" /></Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {data.photo_feed.map((p: any) => (
                <View key={p.id} style={styles.photoTile}>
                  <View style={styles.photoImg}>
                    <Ionicons name="image-outline" size={28} color={COLORS.textTertiary} />
                  </View>
                  <Text style={[TYPO.bodyMedium, { marginTop: 6 }]} numberOfLines={1}>{p.worker_name}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary }]} numberOfLines={1}>{p.project_name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Alertas recientes</Text>
          {alerts.length === 0 ? (
            <Card><EmptyState icon="checkmark-circle-outline" title="Todo en orden" subtitle="No hay alertas abiertas." /></Card>
          ) : (
            <Card>
              {alerts.map((a, i) => (
                <TouchableOpacity key={a.id} onPress={() => router.push('/alerts')} style={[styles.alertRow, i < alerts.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                  <SeverityBadge severity={a.severity} />
                  <Text style={[TYPO.body, { flex: 1, marginHorizontal: 10 }]} numberOfLines={2}>{a.message}</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40, height: 40, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  kpiRow: { flexDirection: 'row' },
  barOuter: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barInner: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  photoTile: { width: 120 },
  photoImg: {
    width: 120, height: 90, backgroundColor: COLORS.background, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});
