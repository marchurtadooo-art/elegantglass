import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, StatusBadge, Skeleton, EmptyState, ProgressBar } from '../../src/ui';
import { useAuth } from '../../src/auth';
import { api, apiError } from '../../src/api';

export default function WorkerHome() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [pendingLogs, setPendingLogs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pj, lg] = await Promise.all([
        api.get('/projects'),
        api.get('/daily-logs'),
      ]);
      setProjects(pj.data);
      const pending = (lg.data as any[]).filter((l) => l.status === 'PENDING').length;
      setPendingLogs(pending);
    } catch (e) {
      console.warn('home load', apiError(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.greet}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPO.caption]}>{greeting.toUpperCase()}</Text>
          <Text style={TYPO.h1}>{user?.name?.split(' ')[0] || ''}</Text>
        </View>
        {pendingLogs > 0 ? (
          <View style={styles.badgePending}>
            <Text style={styles.badgePendingText}>{pendingLogs} pendientes</Text>
          </View>
        ) : null}
      </View>

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Obras de hoy</Text>

      {projects === null ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={92} />
          <Skeleton height={92} />
        </View>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState icon="briefcase-outline" title="Sin obras asignadas" subtitle="Tu jefe te asignará obras pronto." />
        </Card>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={projects.filter((p) => p.status === 'ACTIVE' || p.status === 'PENDING').slice(0, 5)}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`worker-project-${item.id}`}
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
              activeOpacity={0.85}
            >
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={TYPO.h3} numberOfLines={1}>{item.name}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                      <Ionicons name="location-outline" size={12} /> {item.address}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[TYPO.caption, { fontSize: 11 }]}>Progreso</Text>
                    <Text style={TYPO.bodyMedium}>{item.progress_percentage || 0}%</Text>
                  </View>
                  <ProgressBar value={item.progress_percentage || 0} color={COLORS.primary} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>Acciones rápidas</Text>
      <View style={styles.grid}>
        <QuickAction icon="clipboard-outline" label="Nuevo parte" onPress={() => router.push('/log/new')} testID="quick-new-log" />
        <QuickAction icon="camera-outline" label="Subir foto" onPress={() => router.push('/photo/capture')} testID="quick-capture-photo" />
        <QuickAction icon="cube-outline" label="Material" onPress={() => router.push('/material/register')} testID="quick-register-material" />
        <QuickAction icon="time-outline" label="Mi historial" onPress={() => router.push('/(worker)/history')} testID="quick-history" />
      </View>
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={styles.qa}>
      <Ionicons name={icon} size={24} color={COLORS.primary} />
      <Text style={[TYPO.bodyMedium, { marginTop: 8 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  greet: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  badgePending: { backgroundColor: COLORS.warningBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  badgePendingText: { color: COLORS.warning, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  qa: {
    width: '48%', backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.border, minHeight: 100, justifyContent: 'center',
  },
});
