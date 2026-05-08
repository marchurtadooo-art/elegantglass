import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, StatusBadge, Skeleton, EmptyState } from '../../src/ui';
import { api } from '../../src/api';

export default function WorkerHistory() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/daily-logs'); setLogs(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <Text style={TYPO.h1}>Historial</Text>
        <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Tus partes recientes</Text>
      </View>

      {logs === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 12 }}>
          {[1,2,3,4].map((i) => <Skeleton key={i} height={86} />)}
        </View>
      ) : logs.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Card><EmptyState icon="time-outline" title="Sin partes" subtitle="Tu historial aparecerá aquí." /></Card>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={TYPO.bodyMedium}>{item.project_name || '—'}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]} numberOfLines={2}>{item.work_description}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 14 }}>
                    <Text style={TYPO.body}><Icon name="time-outline" size={12} /> {item.hours_worked}h</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{new Date(item.date).toLocaleDateString('es-ES')}</Text>
                  </View>
                </View>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
