/**
 * Material measurements — list + add for workers AND admins.
 * Workers can record measurements (length × width × height, quantity, color)
 * of any material they are currently working with in the warehouse.
 * Data is shared across the whole company so the team has a live ledger.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Card, EmptyState, FAB, HeaderBar, Skeleton } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

type Measurement = {
  id: string;
  material_id: string;
  material_name: string;
  material_code: string;
  color: string;
  length: number | null;
  width: number | null;
  height: number | null;
  quantity: number;
  unit: string;
  notes: string;
  worker_name: string;
  worker_id: string;
  created_at: string;
};

export default function MeasurementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<Measurement[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/material-measurements');
      setData(r.data || []);
    } catch {
      setData([]);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const remove = async (m: Measurement) => {
    Alert.alert('Borrar medida', `¿Borrar la medida del ${m.material_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/material-measurements/${m.id}`);
            await load();
          } catch (e) {
            Alert.alert('Error', apiError(e));
          }
        },
      },
    ]);
  };

  const dim = (m: Measurement) => {
    const parts: string[] = [];
    if (m.length) parts.push(String(m.length));
    if (m.width) parts.push(String(m.width));
    if (m.height) parts.push(String(m.height));
    return parts.length ? `${parts.join(' × ')} ${m.unit}` : '—';
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Medidas de material" onBack={() => router.back()} />
      {data === null ? (
        <View style={{ padding: SPACING.lg, gap: 10 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={92} />)}
        </View>
      ) : data.length === 0 ? (
        <View style={{ padding: SPACING.lg }}>
          <Card>
            <EmptyState
              icon="resize-outline"
              title="Sin medidas registradas"
              subtitle="Añade la primera medida del material con el botón +"
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={TYPO.bodyMedium} numberOfLines={2}>{item.material_name}</Text>
                <View style={styles.metaRow}>
                  {item.color ? (
                    <View style={styles.colorPill}>
                      <Icon name="color-palette-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.colorText}>{item.color}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.meta} numberOfLines={1}>{dim(item)}</Text>
                  <Text style={styles.meta}>×{item.quantity}</Text>
                </View>
                <Text style={[TYPO.body, { color: COLORS.textTertiary, fontSize: 11, marginTop: 4 }]} numberOfLines={1}>
                  {item.worker_name} · {new Date(item.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.notes ? <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }]} numberOfLines={2}>{item.notes}</Text> : null}
              </View>
              {(user?.role !== 'WORKER' || item.worker_id === user?.id) ? (
                <TouchableOpacity
                  onPress={() => remove(item)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  style={{ padding: 6 }}
                >
                  <Icon name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
      <FAB onPress={() => router.push('/warehouse/measurement-new')} icon="add" testID="measurement-fab" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.surface, padding: 12, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  colorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  colorText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  meta: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
});
