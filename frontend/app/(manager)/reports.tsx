import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, Card, Skeleton, EmptyState, StatusBadge } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { downloadBase64File, shareBase64File } from '../../src/files';
import { FadeInUp } from '../../src/animations';

type Filter = 'ALL' | 'COMPLETED' | 'ACTIVE';

export default function Reports() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('COMPLETED');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.get('/reports/projects'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    if (!data) return null;
    if (filter === 'COMPLETED') return data.filter(p => p.status === 'COMPLETED');
    if (filter === 'ACTIVE') return data.filter(p => p.status === 'ACTIVE' || p.status === 'PAUSED' || p.status === 'PENDING');
    return data;
  }, [data, filter]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, completed: 0, active: 0 };
    return {
      all: data.length,
      completed: data.filter(p => p.status === 'COMPLETED').length,
      active: data.filter(p => ['ACTIVE', 'PAUSED', 'PENDING'].includes(p.status)).length,
    };
  }, [data]);

  const generate = async (project: any, mode: 'download' | 'share') => {
    setBusyId(project.id);
    try {
      const r = await api.get(`/projects/${project.id}/client-report/pdf`);
      if (mode === 'share') {
        await shareBase64File(r.data);
      } else {
        await downloadBase64File(r.data);
      }
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const fmtRange = (start?: string, end?: string) => {
    if (!start && !end) return '—';
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })} ${d.getFullYear().toString().slice(2)}`;
    if (s && e) return `${fmt(s)} – ${fmt(e)}`;
    if (s) return fmt(s);
    return e ? fmt(e) : '—';
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <Text style={[TYPO.caption]}>REPORTES DE OBRA</Text>
        <Text style={TYPO.h1}>Para el cliente</Text>
        <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]}>
          Un reporte premium por cada obra finalizada.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 6 }} style={{ marginBottom: SPACING.md }}>
        <Chip label={`Completadas · ${counts.completed}`} active={filter === 'COMPLETED'} onPress={() => setFilter('COMPLETED')} />
        <Chip label={`En curso · ${counts.active}`} active={filter === 'ACTIVE'} onPress={() => setFilter('ACTIVE')} />
        <Chip label={`Todas · ${counts.all}`} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
      </ScrollView>

      {filtered === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 10 }}>{[1, 2].map(i => <Skeleton key={i} height={160} />)}</View>
      ) : filtered.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Card>
            <EmptyState
              icon="document-text-outline"
              title={filter === 'COMPLETED' ? 'Aún no hay obras completadas' : 'Sin obras'}
              subtitle={filter === 'COMPLETED' ? 'Marca una obra como completada desde su detalle para generar el reporte final para cliente.' : undefined}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item, index }) => (
            <FadeInUp delay={index * 40} distance={16}>
              <Card>
                <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/project/${item.id}`)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[TYPO.caption, { fontSize: 10 }]} numberOfLines={1}>
                        {item.client_name ? `CLIENTE · ${item.client_name.toUpperCase()}` : 'OBRA'}
                      </Text>
                      <Text style={TYPO.h3} numberOfLines={2}>{item.name}</Text>
                      {item.address ? (
                        <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 13 }]} numberOfLines={1}>
                          <Ionicons name="location-outline" size={12} /> {item.address}
                        </Text>
                      ) : null}
                      <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }]}>
                        {fmtRange(item.start_date, item.actual_end_date || item.end_date)}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                </TouchableOpacity>

                <View style={styles.statsRow}>
                  <Stat label="Horas" value={`${item.hours_total || 0}h`} />
                  <Stat label="Operarios" value={item.workers_count || 0} />
                  <Stat label="Partes" value={item.log_count || 0} />
                  <Stat label="Fotos" value={item.photo_count || 0} />
                </View>

                <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={busyId === item.id ? 'Generando...' : 'Descargar PDF'}
                      variant="secondary"
                      icon="download-outline"
                      loading={busyId === item.id}
                      onPress={() => generate(item, 'download')}
                      testID={`pdf-dl-${item.id}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Enviar al cliente"
                      icon="paper-plane-outline"
                      loading={busyId === item.id}
                      onPress={() => generate(item, 'share')}
                      testID={`pdf-send-${item.id}`}
                    />
                  </View>
                </View>

                {item.status !== 'COMPLETED' ? (
                  <Text style={[TYPO.body, { color: COLORS.textTertiary, fontSize: 11, marginTop: 8, textAlign: 'center' }]}>
                    <Ionicons name="information-circle-outline" size={12} />  Obra aún en curso — el reporte se muestra como avance provisional.
                  </Text>
                ) : null}
              </Card>
            </FadeInUp>
          )}
        />
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.8}>
      <Text style={{ color: active ? COLORS.surface : COLORS.textSecondary, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[TYPO.caption, { fontSize: 10 }]}>{label}</Text>
      <Text style={TYPO.bodyMedium}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
});
