import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, StatusBadge, Skeleton, EmptyState, ProgressBar } from '../../src/ui';
import { api } from '../../src/api';

export default function WorkerProjects() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/projects'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <Text style={TYPO.h1}>Mis obras</Text>
      </View>

      {data === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 12 }}>
          {[1,2,3].map((i) => <Skeleton key={i} height={120} />)}
        </View>
      ) : data.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Card><EmptyState icon="briefcase-outline" title="Sin obras" subtitle="No tienes obras asignadas todavía." /></Card>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
              testID={`project-card-${item.id}`}
            >
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={TYPO.h3} numberOfLines={1}>{item.name}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.address}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textTertiary, marginTop: 2 }]} numberOfLines={1}>{item.client_name}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[TYPO.caption, { fontSize: 11 }]}>Avance</Text>
                    <Text style={TYPO.bodyMedium}>{item.progress_percentage || 0}%</Text>
                  </View>
                  <ProgressBar value={item.progress_percentage || 0} color={COLORS.primary} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
