import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO, ENTRY_TYPES } from '../../src/theme';
import { Button, Card, HeaderBar, Skeleton } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function MaterialRegister() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';
  const params = useLocalSearchParams<{ projectId?: string }>();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [projectId, setProjectId] = useState<string>(params.projectId || '');
  const [materials, setMaterials] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<typeof ENTRY_TYPES[number]['key']>('USAGE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/projects').then((r) => { setProjects(r.data); if (!projectId && r.data?.length) setProjectId(r.data[0].id); });
    api.get('/materials').then((r) => setMaterials(r.data));
  }, []);

  const filtered = materials.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const submit = async () => {
    if (!projectId) { Alert.alert('Obra', 'Selecciona obra.'); return; }
    if (!selected) { Alert.alert('Material', 'Selecciona un material.'); return; }
    const q = parseFloat(quantity.replace(',', '.'));
    if (!q || q <= 0) { Alert.alert('Cantidad', 'Indica una cantidad válida.'); return; }
    setSaving(true);
    try {
      await api.post('/material-entries', { project_id: projectId, material_id: selected.id, quantity: q, type, notes });
      router.back();
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Registrar material" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 96 }} keyboardShouldPersistTaps="handled">
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>OBRA</Text>
        {projects === null ? <Skeleton height={48} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {projects.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setProjectId(p.id)} style={[styles.chip, projectId === p.id && styles.chipActive]}>
                <Text style={{ color: projectId === p.id ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>BUSCAR MATERIAL</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
          <TextInput
            value={search} onChangeText={setSearch} placeholder="Buscar..." placeholderTextColor={COLORS.textTertiary}
            style={{ flex: 1, marginLeft: 8, height: 44, color: COLORS.textPrimary }} testID="material-search"
          />
        </View>

        {selected ? (
          <Card style={{ marginTop: SPACING.md }}>
            <Text style={[TYPO.caption, { fontSize: 11 }]}>SELECCIONADO</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPO.bodyMedium}>{selected.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{selected.unit} · {selected.category}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close-circle" size={22} color={COLORS.textTertiary} /></TouchableOpacity>
            </View>
          </Card>
        ) : (
          <View style={{ marginTop: SPACING.md, maxHeight: 260 }}>
            <FlatList
              data={filtered.slice(0, 30)}
              keyExtractor={(i) => i.id}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setSelected(item)} style={styles.matRow} testID={`material-${item.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={TYPO.bodyMedium} numberOfLines={1}>{item.name}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>{item.unit} · {item.category}</Text>
                  </View>
                  {!isWorker ? <Text style={TYPO.bodyMedium}>€{item.unit_price}</Text> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>CANTIDAD</Text>
        <TextInput
          value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad"
          style={styles.input} testID="material-quantity"
        />

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>TIPO</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {ENTRY_TYPES.map((e) => (
            <TouchableOpacity key={e.key} onPress={() => setType(e.key)} style={[styles.typeBtn, type === e.key && styles.typeBtnActive]} testID={`entry-${e.key}`}>
              <Text style={{ color: type === e.key ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>NOTAS</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Opcional" style={styles.input} placeholderTextColor={COLORS.textTertiary} />
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Registrar" icon="checkmark" loading={saving} onPress={submit} testID="submit-material" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, maxWidth: 220 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12 },
  matRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4 },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.textPrimary },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.lg, paddingTop: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
});
