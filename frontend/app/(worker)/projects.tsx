import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet,
  TextInput, useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { Skeleton, EmptyState, FAB } from '../../src/ui';
import { api } from '../../src/api';

/**
 * Lista de obras WORKER — Fase 2 monocromo.
 * - Buscador por cliente / dirección / nombre / nº presupuesto
 * - Cada tarjeta: nombre, dirección, cliente, etapa actual, barra progreso B/N
 * - Obras con retraso ARRIBA con etiqueta NEGATIVO (fondo negro)
 */
const BW = {
  black: '#111111', white: '#FFFFFF', text: '#1A1A1A',
  textSec: '#4A4A4A', textDim: '#8A8A8A', border: '#D6D6D6',
  borderLight: '#ECECEC', bg: '#F5F5F5', card: '#FFFFFF',
};

export default function WorkerProjects() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try { const r = await api.get('/projects-with-progress'); setData(r.data); }
    catch {
      // Fallback to old endpoint if backend not updated yet (graceful degradation)
      try { const r = await api.get('/projects'); setData(r.data); } catch {}
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data || [];
    return (data || []).filter((p: any) =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.address || '').toLowerCase().includes(s) ||
      (p.client_name || '').toLowerCase().includes(s) ||
      (p.quote_number || '').toLowerCase().includes(s)
    );
  }, [data, q]);

  return (
    <View style={{ flex: 1, backgroundColor: BW.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Text style={styles.h1}>Mis obras</Text>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={BW.textDim} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por cliente, dirección, presupuesto..."
            placeholderTextColor={BW.textDim}
            style={styles.searchInput}
            testID="proj-search"
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Icon name="close-circle" size={18} color={BW.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {data === null ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={120} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          <EmptyState
            icon={q ? 'search-outline' : 'briefcase-outline'}
            title={q ? 'Sin resultados' : 'Sin obras'}
            subtitle={q ? 'Prueba con otro término' : 'Crea la primera obra con el botón +'}
            action={!q ? { label: 'Crear obra', onPress: () => router.push('/project/new') } : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BW.black} />}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          renderItem={({ item }) => <ProjectCard item={item} width={width} />}
        />
      )}

      <FAB onPress={() => router.push('/project/new')} icon="add" testID="worker-new-project" />
    </View>
  );
}

function ProjectCard({ item, width }: { item: any; width: number }) {
  const pct = item.stages_progress_pct ?? 0;
  const overdue = !!item.has_overdue;
  const inProgress = Math.round((((item.stages_in_progress || 0) / Math.max(item.stages_total || 1, 1)) * 100));
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
      testID={`project-card-${item.id}`}
      style={[styles.card, overdue && styles.cardOverdue]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{item.client_name || '—'}</Text>
          <Text style={styles.cardMetaDim} numberOfLines={1}>{item.address || '—'}</Text>
        </View>
        {overdue ? (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueText}>RETRASO</Text>
          </View>
        ) : null}
      </View>

      {item.current_stage ? (
        <View style={styles.currentStageBox}>
          <Text style={styles.currentLabel}>ETAPA ACTUAL</Text>
          <Text style={styles.currentValue} numberOfLines={1}>{item.current_stage.label}</Text>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        <View style={styles.bar}>
          <View style={[styles.barDone, { width: `${pct}%` as any }]} />
          <View style={[styles.barProg, { width: `${inProgress}%` as any }]}>
            {Array.from({ length: 14 }).map((_, i) => (
              <View key={i} style={styles.barStripe} />
            ))}
          </View>
        </View>
        <Text style={styles.pctText}>{pct}%</Text>
      </View>
      <Text style={styles.subProgress}>
        {item.stages_done || 0} / {item.stages_total || 0} etapas
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: BW.text, marginBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BW.border, borderRadius: 10,
    paddingHorizontal: 12, backgroundColor: BW.white,
  },
  searchInput: { flex: 1, height: 42, color: BW.text, fontSize: 14 },

  card: {
    backgroundColor: BW.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BW.border,
  },
  cardOverdue: { borderColor: BW.black, borderWidth: 1.5 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: BW.text },
  cardMeta: { fontSize: 13, color: BW.textSec, marginTop: 2 },
  cardMetaDim: { fontSize: 12, color: BW.textDim, marginTop: 2 },

  overdueBadge: { backgroundColor: BW.black, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 4 },
  overdueText: { color: BW.white, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },

  currentStageBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BW.borderLight },
  currentLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: BW.textDim },
  currentValue: { fontSize: 14, fontWeight: '700', color: BW.text, marginTop: 2 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: BW.borderLight, overflow: 'hidden', flexDirection: 'row' },
  barDone: { height: '100%', backgroundColor: BW.black },
  barProg: { height: '100%', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  barStripe: { width: 2.5, height: 10, backgroundColor: BW.black, marginRight: 2.5, transform: [{ skewX: '-25deg' }], opacity: 0.5 },
  pctText: { fontSize: 14, fontWeight: '800', color: BW.text, fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' },
  subProgress: { fontSize: 11, color: BW.textDim, marginTop: 4, fontVariant: ['tabular-nums'] },
});
