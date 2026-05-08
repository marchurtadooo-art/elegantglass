import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO, MAT_CATEGORIES } from '../../src/theme';
import { Card, HeaderBar, Skeleton, EmptyState } from '../../src/ui';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function Stock() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState<string>('ALL');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { const r = await api.get('/warehouse/stock'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    if (!data) return null;
    return data.filter((s) => (cat === 'ALL' || s.category === cat) && s.name.toLowerCase().includes(q.toLowerCase()));
  }, [data, cat, q]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Stock actual" onBack={() => router.back()} />
      <View style={{ padding: SPACING.lg, paddingBottom: 0 }}>
        <View style={styles.searchBox}>
          <Icon name="search-outline" size={18} color={COLORS.textTertiary} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar material..." placeholderTextColor={COLORS.textTertiary} style={{ flex: 1, marginLeft: 8, height: 44, color: COLORS.textPrimary }} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 6, paddingTop: SPACING.md }} style={{ marginBottom: SPACING.md }}>
        <Chip label="Todas" active={cat === 'ALL'} onPress={() => setCat('ALL')} />
        {MAT_CATEGORIES.map((c) => <Chip key={c.key} label={c.label} active={cat === c.key} onPress={() => setCat(c.key)} />)}
      </ScrollView>

      {filtered === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 8 }}>{[1,2,3,4,5].map((i) => <Skeleton key={i} height={60} />)}</View>
      ) : filtered.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}><Card><EmptyState icon="cube-outline" title="Sin stock" /></Card></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.material_id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={[styles.row, item.low_stock && { borderLeftWidth: 3, borderLeftColor: COLORS.warning }]}>
              <View style={{ flex: 1 }}>
                <Text style={TYPO.bodyMedium} numberOfLines={1}>{item.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>{item.category} · {item.lot_count} lote(s){item.low_stock ? ' · STOCK BAJO' : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[TYPO.h3, item.low_stock ? { color: COLORS.warning } : null]}>{item.total} <Text style={[TYPO.body, { fontSize: 13 }]}>{item.unit}</Text></Text>
                {!isWorker && item.value != null ? <Text style={[TYPO.body, { color: COLORS.textTertiary, fontSize: 12 }]}>€{item.value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</Text> : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={{ color: active ? COLORS.surface : COLORS.textSecondary, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
