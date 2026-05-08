import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, StatusBadge, Skeleton, EmptyState, ProgressBar, FAB } from '../../src/ui';
import { api } from '../../src/api';

const FILTERS = [
  { key: 'ALL', label: 'Todas' },
  { key: 'ACTIVE', label: 'Activas' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'PAUSED', label: 'Pausadas' },
  { key: 'COMPLETED', label: 'Completadas' },
] as const;

export default function ManagerProjects() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/projects'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!data) return null;
    if (filter === 'ALL') return data;
    return data.filter((p) => p.status === filter);
  }, [data, filter]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <Text style={TYPO.h1}>Obras</Text>
      </View>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8 }}
        style={{ marginBottom: SPACING.md }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            testID={`filter-${f.key}`}
          >
            <Text style={[TYPO.bodyMedium, { color: filter === f.key ? COLORS.surface : COLORS.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 12 }}>
          {[1,2,3].map((i) => <Skeleton key={i} height={140} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Card>
            <EmptyState
              icon="briefcase-outline"
              title="Sin obras"
              subtitle="Crea tu primera obra para empezar."
              action={{ label: 'Nueva obra', onPress: () => router.push('/project/new') }}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const pct = item.budget > 0 ? Math.min(150, Math.round((item.spent / item.budget) * 100)) : 0;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
                testID={`mgr-project-${item.id}`}
              >
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={TYPO.h3} numberOfLines={1}>{item.name}</Text>
                      <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.client_name}</Text>
                      <Text style={[TYPO.body, { color: COLORS.textTertiary, marginTop: 2 }]} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={{ marginTop: SPACING.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[TYPO.caption, { fontSize: 11 }]}>Presupuesto</Text>
                      <Text style={TYPO.bodyMedium}>
                        €{(item.spent || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} / €{(item.budget || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                    <ProgressBar value={pct} />
                  </View>
                  <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 18 }}>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>
                      <Icon name="people-outline" size={12} /> {item.assigned_worker_ids?.length || 0}
                    </Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>
                      <Icon name="image-outline" size={12} /> {item.photo_count || 0}
                    </Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>
                      <Icon name="clipboard-outline" size={12} /> {item.log_count || 0}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <FAB onPress={() => router.push('/project/new')} testID="new-project-fab" />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
