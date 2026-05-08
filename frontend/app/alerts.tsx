import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/Icon';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Card, HeaderBar, SeverityBadge, Skeleton, EmptyState } from '../src/ui';
import { api } from '../src/api';

export default function Alerts() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/alerts'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (id: string) => {
    try { await api.patch(`/alerts/${id}/read`); load(); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Alertas" onBack={() => router.back()} />
      {data === null ? (
        <View style={{ padding: SPACING.lg, gap: 8 }}>{[1,2,3].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : data.length === 0 ? (
        <View style={{ padding: SPACING.lg }}><Card><EmptyState icon="checkmark-circle-outline" title="Sin alertas" subtitle="Todo en orden." /></Card></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => markRead(item.id)} activeOpacity={0.85}>
              <Card style={!item.is_read ? { borderLeftWidth: 3, borderLeftColor: COLORS.primary } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <SeverityBadge severity={item.severity} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={TYPO.bodyMedium} numberOfLines={3}>{item.message}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textTertiary, marginTop: 4, fontSize: 11 }]}>{new Date(item.created_at).toLocaleString('es-ES')}</Text>
                  </View>
                  {item.is_read ? <Icon name="checkmark-done" size={18} color={COLORS.textTertiary} /> : null}
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
