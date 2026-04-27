import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, Card, Skeleton, EmptyState } from '../../src/ui';
import { api, apiError } from '../../src/api';

export default function Reports() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/reports/weekly'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const generate = async () => {
    setGenerating(true);
    try {
      await api.post('/reports/weekly/generate');
      await load();
      Alert.alert('Generado', 'Reporte semanal creado correctamente.');
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setGenerating(false); }
  };

  const fmtRange = (start: string, end: string) => {
    const s = new Date(start), e = new Date(end);
    return `${s.getDate()} ${s.toLocaleString('es-ES', { month: 'short' })} – ${e.getDate()} ${e.toLocaleString('es-ES', { month: 'short' })}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
        <View>
          <Text style={TYPO.h1}>Reportes</Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Resúmenes semanales</Text>
        </View>
        <View style={{ minWidth: 130 }}>
          <Button title="Generar" icon="sparkles-outline" loading={generating} onPress={generate} size="sm" testID="generate-report" />
        </View>
      </View>

      {data === null ? (
        <View style={{ paddingHorizontal: SPACING.lg, gap: 10 }}>{[1,2].map((i) => <Skeleton key={i} height={120} />)}</View>
      ) : data.length === 0 ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Card><EmptyState icon="document-text-outline" title="Sin reportes" subtitle="Genera tu primer reporte semanal." /></Card>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPO.caption, { fontSize: 11 }]}>SEMANA</Text>
                  <Text style={TYPO.h3}>{fmtRange(item.week_start, item.week_end)}</Text>
                  <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 2 }]}>
                    Generado {new Date(item.generated_at).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <View style={styles.iconWrap}><Ionicons name="document-text-outline" size={26} color={COLORS.primary} /></View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 18 }}>
                <Stat label="Gasto" value={`€${(item.summary?.total_spend || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} />
                <Stat label="Partes" value={item.summary?.log_count || 0} />
                <Stat label="Fotos" value={item.summary?.photo_count || 0} />
                <Stat label="Incidentes" value={item.summary?.incident_count || 0} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: 8 }}>
                <View style={{ flex: 1 }}><Button title="Ver PDF" variant="secondary" icon="document-outline" onPress={() => Alert.alert('PDF', 'Disponible en próxima versión.')} /></View>
                <View style={{ flex: 1 }}><Button title="Excel" variant="secondary" icon="grid-outline" onPress={() => Alert.alert('Excel', 'Disponible en próxima versión.')} /></View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View>
      <Text style={[TYPO.caption, { fontSize: 10 }]}>{label}</Text>
      <Text style={TYPO.bodyMedium}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 44, height: 44, borderRadius: 4, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
});
