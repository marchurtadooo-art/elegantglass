import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert, Linking } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, Card, HeaderBar, ProgressBar, Segmented, Skeleton, StatusBadge, Avatar, EmptyState } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

type Tab = 'RESUMEN' | 'PARTES' | 'FOTOS' | 'MATERIALES' | 'BALANCE' | 'EQUIPO';

export default function ProjectDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';
  const [tab, setTab] = useState<Tab>('RESUMEN');
  const [project, setProject] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, l, ph, m] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/daily-logs?project_id=${id}`),
        api.get(`/photos?project_id=${id}`),
        api.get(`/material-entries?project_id=${id}`),
      ]);
      setProject(p.data); setLogs(l.data); setPhotos(ph.data); setEntries(m.data);
    } catch (e) { console.warn(apiError(e)); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const reviewLog = async (logId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/daily-logs/${logId}/review`, { status, review_comment: '' });
      await load();
    } catch (e) { Alert.alert('Error', apiError(e)); }
  };

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
        <HeaderBar title="Cargando..." onBack={() => router.back()} />
        <View style={{ padding: SPACING.lg, gap: 12 }}><Skeleton height={150} /><Skeleton height={120} /></View>
      </View>
    );
  }

  const fmtEur = (n: number) => n == null ? '—' : `€${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
  const tabs: { key: Tab; label: string }[] = isWorker
    ? [{ key: 'RESUMEN', label: 'Resumen' }, { key: 'PARTES', label: 'Partes' }, { key: 'FOTOS', label: 'Fotos' }, { key: 'MATERIALES', label: 'Material' }]
    : [{ key: 'RESUMEN', label: 'Resumen' }, { key: 'PARTES', label: 'Partes' }, { key: 'FOTOS', label: 'Fotos' }, { key: 'MATERIALES', label: 'Material' }, { key: 'BALANCE', label: 'Balance' }, { key: 'EQUIPO', label: 'Equipo' }];

  const openMaps = () => {
    const q = encodeURIComponent(project.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar
        title={project.name}
        onBack={() => router.back()}
        right={
          isWorker ? null : (
            <TouchableOpacity testID="edit-project" onPress={() => router.push({ pathname: '/project/new', params: { id } })}>
              <Ionicons name="create-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPO.caption, { color: 'rgba(255,255,255,0.7)' }]}>OBRA</Text>
              <Text style={[TYPO.h1, { color: COLORS.surface }]} numberOfLines={2}>{project.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{project.client_name}</Text>
            </View>
            <StatusBadge status={project.status} />
          </View>
          <TouchableOpacity onPress={openMaps} style={styles.heroAddr}>
            <Ionicons name="location-outline" size={14} color={COLORS.surface} />
            <Text style={{ color: COLORS.surface, marginLeft: 6, flex: 1 }} numberOfLines={1}>{project.address}</Text>
            <Ionicons name="open-outline" size={14} color={COLORS.surface} />
          </TouchableOpacity>
          <View style={{ marginTop: SPACING.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: 0.6, fontWeight: '600' }}>AVANCE</Text>
              <Text style={{ color: COLORS.surface, fontWeight: '700' }}>{project.progress_percentage || 0}%</Text>
            </View>
            <View style={styles.heroProg}>
              <View style={[styles.heroProgFill, { width: `${project.progress_percentage || 0}%` }]} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Segmented options={tabs} value={tab} onChange={(v) => setTab(v as Tab)} testID="proj-tabs" />
          </ScrollView>
        </View>

        <View style={{ padding: SPACING.lg }}>
          {tab === 'RESUMEN' && <ResumenTab project={project} isWorker={isWorker} fmtEur={fmtEur} />}
          {tab === 'PARTES' && <PartesTab logs={logs} isWorker={isWorker} onReview={reviewLog} onAdd={() => router.push({ pathname: '/log/new', params: { projectId: id } })} />}
          {tab === 'FOTOS' && <FotosTab photos={photos} onAdd={() => router.push({ pathname: '/photo/capture', params: { projectId: id } })} />}
          {tab === 'MATERIALES' && <MaterialesTab entries={entries} isWorker={isWorker} onAdd={() => router.push({ pathname: '/material/register', params: { projectId: id } })} fmtEur={fmtEur} />}
          {tab === 'BALANCE' && !isWorker && <BalanceTab project={project} entries={entries} fmtEur={fmtEur} />}
          {tab === 'EQUIPO' && !isWorker && <EquipoTab project={project} logs={logs} entries={entries} fmtEur={fmtEur} />}
        </View>
      </ScrollView>
    </View>
  );
}

function ResumenTab({ project, isWorker, fmtEur }: any) {
  return (
    <View style={{ gap: SPACING.md }}>
      <Card>
        <Text style={[TYPO.caption, { marginBottom: 6 }]}>DESCRIPCIÓN</Text>
        <Text style={TYPO.body}>{project.description || 'Sin descripción.'}</Text>
      </Card>
      <Card>
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>CLIENTE</Text>
        <KV label="Nombre" value={project.client_name || '—'} />
        <KV label="Teléfono" value={project.client_phone || '—'} />
        {!isWorker ? <KV label="Email" value={project.client_email || '—'} /> : null}
      </Card>
      {!isWorker ? (
        <Card>
          <Text style={[TYPO.caption, { marginBottom: 8 }]}>FINANZAS</Text>
          <KV label="Presupuesto" value={fmtEur(project.budget)} />
          <KV label="Gastado" value={fmtEur(project.spent)} />
          <KV label="Restante" value={fmtEur(project.remaining)} />
        </Card>
      ) : null}
      <Card>
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>FECHAS</Text>
        <KV label="Inicio" value={project.start_date ? new Date(project.start_date).toLocaleDateString('es-ES') : '—'} />
        <KV label="Fin estimado" value={project.end_date ? new Date(project.end_date).toLocaleDateString('es-ES') : '—'} />
      </Card>
    </View>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{label}</Text>
      <Text style={TYPO.bodyMedium}>{value}</Text>
    </View>
  );
}

function PartesTab({ logs, isWorker, onReview, onAdd }: any) {
  return (
    <View style={{ gap: SPACING.md }}>
      <Button title="Añadir parte" icon="add" onPress={onAdd} testID="add-log" />
      {logs.length === 0 ? <Card><EmptyState icon="clipboard-outline" title="Sin partes" /></Card>
        : logs.map((l: any) => (
          <Card key={l.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Avatar name={l.worker?.name} size={36} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={TYPO.bodyMedium}>{l.worker?.name || '—'}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{new Date(l.date).toLocaleDateString('es-ES')} · {l.hours_worked}h</Text>
                </View>
              </View>
              <StatusBadge status={l.status} />
            </View>
            <Text style={[TYPO.body, { marginTop: 8 }]} numberOfLines={3}>{l.work_description}</Text>
            {l.incidents ? (
              <View style={{ marginTop: 8, padding: 8, backgroundColor: COLORS.warningBg, borderRadius: 4 }}>
                <Text style={{ color: COLORS.warning, fontSize: 12 }}><Ionicons name="warning-outline" size={12} /> {l.incidents}</Text>
              </View>
            ) : null}
            {!isWorker && l.status === 'PENDING' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.md }}>
                <View style={{ flex: 1 }}><Button title="Aprobar" size="sm" onPress={() => onReview(l.id, 'APPROVED')} /></View>
                <View style={{ flex: 1 }}><Button title="Rechazar" variant="secondary" size="sm" onPress={() => onReview(l.id, 'REJECTED')} /></View>
              </View>
            ) : null}
          </Card>
        ))
      }
    </View>
  );
}

function FotosTab({ photos, onAdd }: any) {
  return (
    <View>
      <Button title="Subir foto" icon="camera-outline" onPress={onAdd} testID="add-photo" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md, gap: 8 }}>
        {photos.length === 0 ? <Card style={{ flex: 1 }}><EmptyState icon="camera-outline" title="Sin fotos" /></Card>
          : photos.map((p: any) => (
            <View key={p.id} style={{ width: '48%' }}>
              <View style={{ aspectRatio: 1, backgroundColor: COLORS.background, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                <Ionicons name="image-outline" size={32} color={COLORS.textTertiary} />
              </View>
              <Text style={[TYPO.body, { marginTop: 4 }]} numberOfLines={1}>{p.caption}</Text>
              <Text style={[TYPO.body, { color: COLORS.textTertiary, fontSize: 11 }]}>{p.photo_type}</Text>
            </View>
          ))
        }
      </View>
    </View>
  );
}

function MaterialesTab({ entries, isWorker, onAdd, fmtEur }: any) {
  const total = entries.reduce((s: number, e: any) => s + (e.total_cost || 0), 0);
  return (
    <View style={{ gap: SPACING.md }}>
      <Button title="Registrar material" icon="add" onPress={onAdd} testID="add-material" />
      {!isWorker ? (
        <Card>
          <Text style={[TYPO.caption, { fontSize: 11 }]}>TOTAL GASTO MATERIAL</Text>
          <Text style={TYPO.h2}>{fmtEur(total)}</Text>
        </Card>
      ) : null}
      {entries.length === 0 ? <Card><EmptyState icon="cube-outline" title="Sin materiales" /></Card>
        : entries.map((e: any) => (
          <Card key={e.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPO.bodyMedium} numberOfLines={1}>{e.material?.name || '—'}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{e.quantity} {e.material?.unit} · {e.type}</Text>
              </View>
              {!isWorker ? <Text style={TYPO.bodyMedium}>{fmtEur(e.total_cost)}</Text> : null}
            </View>
          </Card>
        ))
      }
    </View>
  );
}

function BalanceTab({ project, entries, fmtEur }: any) {
  const byCategory: Record<string, number> = {};
  entries.forEach((e: any) => {
    const cat = e.material?.category || 'OTROS';
    byCategory[cat] = (byCategory[cat] || 0) + (e.total_cost || 0);
  });
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const max = Math.max(...Object.values(byCategory), 1);
  const remaining = (project.budget || 0) - (project.spent || 0);
  const pct = project.budget > 0 ? Math.round(((project.spent || 0) / project.budget) * 100) : 0;
  return (
    <View style={{ gap: SPACING.md }}>
      <Card>
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>PRESUPUESTO</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={TYPO.body}>{fmtEur(project.spent)} de {fmtEur(project.budget)}</Text>
          <Text style={TYPO.bodyMedium}>{pct}%</Text>
        </View>
        <ProgressBar value={pct} />
        <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 8 }]}>Restante: {fmtEur(remaining)}</Text>
      </Card>
      <Card>
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>POR CATEGORÍA</Text>
        {Object.keys(byCategory).length === 0 ? <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Sin gasto registrado.</Text>
          : Object.entries(byCategory).map(([cat, v], i) => (
            <View key={i} style={{ marginBottom: i === Object.keys(byCategory).length - 1 ? 0 : 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={TYPO.body}>{cat}</Text>
                <Text style={TYPO.bodyMedium}>{fmtEur(v)}</Text>
              </View>
              <View style={{ height: 4, backgroundColor: COLORS.border, borderRadius: 2 }}>
                <View style={{ width: `${(v / max) * 100}%`, height: 4, backgroundColor: COLORS.primary, borderRadius: 2 }} />
              </View>
            </View>
          ))
        }
        <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 12 }]}>Total: {fmtEur(total)}</Text>
      </Card>
    </View>
  );
}

function EquipoTab({ project, logs, entries, fmtEur }: any) {
  const team = project.assigned_workers || [];
  const stats: Record<string, { hours: number; spend: number }> = {};
  logs.forEach((l: any) => {
    stats[l.worker_id] = stats[l.worker_id] || { hours: 0, spend: 0 };
    stats[l.worker_id].hours += l.hours_worked || 0;
  });
  entries.forEach((e: any) => {
    stats[e.worker_id] = stats[e.worker_id] || { hours: 0, spend: 0 };
    stats[e.worker_id].spend += e.total_cost || 0;
  });
  return (
    <View style={{ gap: SPACING.md }}>
      {team.length === 0 ? <Card><EmptyState icon="people-outline" title="Sin equipo asignado" /></Card>
        : team.map((w: any) => (
          <Card key={w.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={w.name} size={44} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={TYPO.bodyMedium}>{w.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>
                  {(stats[w.id]?.hours || 0).toFixed(1)}h · {fmtEur(stats[w.id]?.spend || 0)}
                </Text>
              </View>
            </View>
          </Card>
        ))
      }
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.lg,
  },
  heroAddr: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 4,
  },
  heroProg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  heroProgFill: { height: 6, backgroundColor: COLORS.surface, borderRadius: 3 },
});
