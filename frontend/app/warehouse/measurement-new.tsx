/**
 * Nueva medida — visual 3-step wizard (no overlapping scrolls).
 *
 *   STEP 0 → Material picker (full-screen list with search, isolated scroll)
 *   STEP 1 → Color picker (large swatches grid, sin scroll interno)
 *   STEP 2 → Dimensiones + unidad + cantidad + notas + Guardar
 *
 * Esto evita el overlap visual de la versión anterior (un único ScrollView
 * con sublista incrustada que colapsaba sobre los chips e inputs).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Alert, TextInput, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';

const COLOR_PRESETS: { name: string; swatch: string }[] = [
  { name: 'Blanco',    swatch: '#FFFFFF' },
  { name: 'Negro',     swatch: '#1A1A1A' },
  { name: 'Gris',      swatch: '#9AA0A6' },
  { name: 'Plata',     swatch: '#C0C0C0' },
  { name: 'Bronce',    swatch: '#8C6A3D' },
  { name: 'Antracita', swatch: '#383E42' },
  { name: 'Roble',     swatch: '#9B7653' },
  { name: 'Champagne', swatch: '#E0C7A0' },
  { name: 'Inox',      swatch: '#B6B7B8' },
];
const UNITS = ['mm', 'cm', 'm'];

type Step = 0 | 1 | 2;

export default function NewMeasurement() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);

  const [materials, setMaterials] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [matId, setMatId] = useState<string | null>(null);

  const [color, setColor] = useState('');
  const [colorCustom, setColorCustom] = useState('');

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
    if (!s) return materials;
    return materials.filter((m: any) =>
      (m.name || '').toLowerCase().includes(s) ||
      (m.code || '').toLowerCase().includes(s)
    );
  }, [materials, search]);

  const selectedMat = useMemo(() => materials.find((m) => m.id === matId), [materials, matId]);
  const finalColor = colorCustom.trim() || color;

  const goNext = () => setStep((s) => (s < 2 ? ((s + 1) as Step) : s));
  const goBack = () => {
    if (step === 0) router.back();
    else setStep((s) => ((s - 1) as Step));
  };

  const submit = async () => {
    if (!matId) { Alert.alert('Falta material', 'Selecciona el material.'); setStep(0); return; }
    setSaving(true);
    try {
      await api.post('/material-measurements', {
        material_id: matId,
        color: finalColor.trim(),
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

  const stepTitles = ['Material', 'Color', 'Medidas'];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title={`Nueva medida · ${stepTitles[step]}`} onBack={goBack} />

      {/* Step indicator */}
      <View style={styles.stepBar}>
        {stepTitles.map((label, i) => (
          <View key={label} style={[styles.stepDotWrap]}>
            <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, (i === step || i < step) && { color: COLORS.surface }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, i === step && { color: COLORS.textPrimary, fontWeight: '700' }]} numberOfLines={1}>{label}</Text>
          </View>
        ))}
      </View>

      {/* =========================================================== STEP 0: MATERIAL */}
      {step === 0 ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar material o código..."
              placeholderTextColor={COLORS.textTertiary}
              style={styles.searchInput}
              testID="mat-search"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="close-circle" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={9}
            removeClippedSubviews
            ListEmptyComponent={
              <Text style={[TYPO.body, { color: COLORS.textTertiary, padding: 24, textAlign: 'center' }]}>
                No hay materiales que coincidan.
              </Text>
            }
            renderItem={({ item }) => {
              const isSel = item.id === matId;
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => { setMatId(item.id); }}
                  style={[styles.matCard, isSel && styles.matCardActive]}
                  testID={`mat-pick-${item.id}`}
                >
                  <View style={[styles.matIconBox, isSel && { backgroundColor: COLORS.primary }]}>
                    <Icon name="cube-outline" size={20} color={isSel ? COLORS.surface : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text style={[TYPO.bodyMedium, { fontSize: 15 }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }]} numberOfLines={1}>
                      {item.code || ''}{item.code && item.category ? ' · ' : ''}{item.category || ''}
                    </Text>
                  </View>
                  {isSel ? (
                    <Icon name="checkmark-circle" size={22} color={COLORS.primary} />
                  ) : (
                    <Icon name="chevron-forward" size={18} color={COLORS.textTertiary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
            <Button title="Continuar" onPress={goNext} disabled={!matId} testID="step-next-0" />
          </View>
        </View>
      ) : null}

      {/* =========================================================== STEP 1: COLOR */}
      {step === 1 ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
            <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: 12 }]} numberOfLines={2}>
              Material: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{selectedMat?.name || '—'}</Text>
            </Text>

            <Text style={[TYPO.bodyMedium, { marginBottom: 12 }]}>Elige un color</Text>
            <View style={styles.colorGrid}>
              {COLOR_PRESETS.map((c) => {
                const active = !colorCustom && color === c.name;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => { setColor(c.name); setColorCustom(''); }}
                    style={[styles.colorCard, active && styles.colorCardActive]}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.swatch, { backgroundColor: c.swatch }]} />
                    <Text style={[styles.colorName, active && { color: COLORS.primary, fontWeight: '800' }]} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 18 }} />
            <Input
              label="O escribe otro color personalizado"
              value={colorCustom}
              onChangeText={(t) => { setColorCustom(t); if (t) setColor(''); }}
              placeholder="Ej: RAL 9016, Beige..."
              testID="color-custom"
            />
          </ScrollView>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12, flexDirection: 'row', gap: 10 }]}>
            <View style={{ flex: 1 }}><Button title="Atrás" variant="secondary" onPress={goBack} /></View>
            <View style={{ flex: 2 }}>
              <Button title="Continuar" onPress={goNext} disabled={!finalColor.trim()} testID="step-next-1" />
            </View>
          </View>
        </View>
      ) : null}

      {/* =========================================================== STEP 2: MEDIDAS */}
      {step === 2 ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
            <View style={styles.summary}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 11 }]}>MATERIAL</Text>
                <Text style={[TYPO.bodyMedium, { fontSize: 14 }]} numberOfLines={1}>{selectedMat?.name || '—'}</Text>
              </View>
              <View style={styles.summarySep} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.swatchSmall, { backgroundColor: swatchOf(finalColor) }]} />
                <Text style={[TYPO.bodyMedium, { fontSize: 14 }]} numberOfLines={1}>{finalColor || '—'}</Text>
              </View>
            </View>

            <Text style={[TYPO.bodyMedium, { marginBottom: 10 }]}>Dimensiones</Text>
            <View style={styles.dimsRow}>
              <DimBox label="LARGO"  value={length} onChange={setLength} unit={unit} testID="dim-length" />
              <DimBox label="ANCHO"  value={width}  onChange={setWidth}  unit={unit} testID="dim-width" />
              <DimBox label="ALTO"   value={height} onChange={setHeight} unit={unit} testID="dim-height" />
            </View>

            <Text style={[TYPO.bodyMedium, { marginTop: 18, marginBottom: 8 }]}>Unidad</Text>
            <View style={styles.unitRow}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.unitChipText, unit === u && { color: COLORS.surface }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 18 }} />
            <Input label="Cantidad" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" testID="dim-qty" />
            <Input label="Notas — opcional" value={notes} onChangeText={setNotes} multiline />
          </ScrollView>

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12, flexDirection: 'row', gap: 10 }]}>
            <View style={{ flex: 1 }}><Button title="Atrás" variant="secondary" onPress={goBack} /></View>
            <View style={{ flex: 2 }}>
              <Button title="Guardar medida" onPress={submit} loading={saving} testID="measurement-submit" />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

function DimBox({ label, value, onChange, unit, testID }: { label: string; value: string; onChange: (v: string) => void; unit: string; testID?: string }) {
  return (
    <View style={styles.dimBox}>
      <Text style={styles.dimLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={COLORS.textTertiary}
        style={styles.dimInput}
        testID={testID}
      />
      <Text style={styles.dimUnit}>{unit}</Text>
    </View>
  );
}

function swatchOf(colorName: string): string {
  const m = COLOR_PRESETS.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
  return m ? m.swatch : '#D9D9D9';
}

const styles = StyleSheet.create({
  /* ---------- Step bar ---------- */
  stepBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  stepDotWrap: { alignItems: 'center', flex: 1, gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotDone:   { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepDotText:   { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  stepLabel:     { fontSize: 11, color: COLORS.textTertiary, letterSpacing: 0.3 },

  /* ---------- Step 0: material search + cards ---------- */
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 6,
    paddingHorizontal: 12, backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, height: 44, color: COLORS.textPrimary, fontSize: 14 },
  matCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderColor: COLORS.border,
    borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 64,
  },
  matCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0F' },
  matIconBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ---------- Step 1: color grid ---------- */
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorCard: {
    width: '31%', minHeight: 84, padding: 10, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  colorCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0F', borderWidth: 2 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border + 'AA',
  },
  swatchSmall: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: COLORS.border + 'AA',
  },
  colorName: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  /* ---------- Step 2: dimensions ---------- */
  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12, marginBottom: 18,
  },
  summarySep: { width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 12 },
  dimsRow: { flexDirection: 'row', gap: 10 },
  dimBox: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 12, alignItems: 'center', minHeight: 96,
  },
  dimLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 0.8 },
  dimInput: {
    fontSize: 22, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center', minWidth: 70, paddingVertical: 6,
  },
  dimUnit: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  unitRow: { flexDirection: 'row', gap: 10 },
  unitChip: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  unitChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitChipText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  /* ---------- Bottom CTA ---------- */
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: SPACING.lg, paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
});
