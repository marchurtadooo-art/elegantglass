/**
 * Add a new measurement — material picker + color + dimensions.
 * Available for both WORKER and ADMIN.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';

const COLOR_PRESETS = ['Blanco', 'Negro', 'Gris', 'Plata', 'Bronce', 'Antracita', 'Roble', 'Otro'];
const UNITS = ['mm', 'cm', 'm'];

export default function NewMeasurement() {
  const insets = useSafeAreaInsets();
  const [materials, setMaterials] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [matId, setMatId] = useState<string | null>(null);
  const [color, setColor] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('mm');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/materials').then((r) => setMaterials(r.data || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return materials.slice(0, 30);
    return materials.filter((m: any) =>
      (m.name || '').toLowerCase().includes(s) ||
      (m.code || '').toLowerCase().includes(s)
    ).slice(0, 30);
  }, [materials, search]);

  const selectedMat = useMemo(() => materials.find((m) => m.id === matId), [materials, matId]);

  const submit = async () => {
    if (!matId) {
      Alert.alert('Falta material', 'Selecciona el material que estás midiendo.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/material-measurements', {
        material_id: matId,
        color: color.trim(),
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        quantity: parseFloat(quantity) || 1,
        unit,
        notes: notes.trim(),
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Nueva medida" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">

          {/* Material picker */}
          <Text style={[TYPO.bodyMedium, { marginBottom: 6 }]}>Material *</Text>
          {selectedMat ? (
            <TouchableOpacity onPress={() => setMatId(null)} style={styles.selectedMat} activeOpacity={0.85}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={TYPO.bodyMedium} numberOfLines={1}>{selectedMat.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]} numberOfLines={1}>
                  {selectedMat.code || selectedMat.category}
                </Text>
              </View>
              <Icon name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Icon name="search" size={16} color={COLORS.textTertiary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar material..."
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.searchInput}
                  testID="mat-search"
                />
              </View>
              <View style={{ maxHeight: 220 }}>
                {filtered.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => { setMatId(m.id); setSearch(''); }}
                    style={styles.matItem}
                    testID={`mat-pick-${m.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={TYPO.bodyMedium} numberOfLines={1}>{m.name}</Text>
                      <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                        {m.code || m.category}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
                {filtered.length === 0 ? (
                  <Text style={[TYPO.body, { color: COLORS.textTertiary, padding: 16, textAlign: 'center' }]}>
                    No hay materiales que coincidan
                  </Text>
                ) : null}
              </View>
            </>
          )}

          <View style={{ height: SPACING.md }} />

          {/* Color */}
          <Text style={[TYPO.bodyMedium, { marginBottom: 6 }]}>Color</Text>
          <View style={styles.chipsRow}>
            {COLOR_PRESETS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c === 'Otro' ? '' : c)}
                style={[styles.chip, color === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, color === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label="O escribe otro color" value={color} onChangeText={setColor} />

          {/* Dimensions */}
          <Text style={[TYPO.bodyMedium, { marginBottom: 6, marginTop: SPACING.md }]}>Medidas</Text>
          <View style={styles.dimsRow}>
            <View style={{ flex: 1 }}>
              <Input label="Largo" value={length} onChangeText={setLength} keyboardType="decimal-pad" testID="dim-length" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Ancho" value={width} onChangeText={setWidth} keyboardType="decimal-pad" testID="dim-width" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Alto" value={height} onChangeText={setHeight} keyboardType="decimal-pad" testID="dim-height" />
            </View>
          </View>

          <Text style={[TYPO.bodyMedium, { marginBottom: 6 }]}>Unidad</Text>
          <View style={styles.chipsRow}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.chip, unit === u && styles.chipActive]}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: SPACING.md }} />
          <Input label="Cantidad" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" testID="dim-qty" />
          <Input label="Notas — opcional" value={notes} onChangeText={setNotes} multiline />

        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Button title="Guardar medida" onPress={submit} loading={saving} testID="measurement-submit" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedMat: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary + '14', borderColor: COLORS.primary,
    borderWidth: 1, borderRadius: 6, padding: 12,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 6,
    paddingHorizontal: 10, backgroundColor: COLORS.surface, marginBottom: 8,
  },
  searchInput: { flex: 1, height: 40, color: COLORS.textPrimary, fontSize: 14 },
  matItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: COLORS.surface },
  dimsRow: { flexDirection: 'row', gap: 10 },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: SPACING.lg, paddingTop: SPACING.md,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
});
