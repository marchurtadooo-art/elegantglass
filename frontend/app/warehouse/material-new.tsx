/**
 * Manual material creation — accessible to both WORKER and ADMIN.
 * Opened from the Stock screen FAB. Adds a new material to the company catalogue.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';

const CATEGORIES = ['PERFILERIA', 'VIDRIO', 'HERRAJES', 'SELLANTES', 'HERRAMIENTAS', 'CONSUMIBLES', 'OTROS'];
const UNITS = ['ud', 'm', 'm2', 'kg', 'l', 'caja'];

export default function NewMaterial() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('ud');
  const [category, setCategory] = useState('OTRO');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Indica el nombre del material.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/materials', {
        name: name.trim(),
        unit,
        category,
        unit_price: parseFloat(unitPrice) || 0,
        supplier: supplier.trim(),
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
      <HeaderBar title="Nuevo material" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Input label="Nombre *" value={name} onChangeText={setName} testID="mat-name" />

          <Text style={[TYPO.bodyMedium, { marginBottom: 6 }]}>Categoría</Text>
          <View style={styles.pickerRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: SPACING.md }} />

          <Text style={[TYPO.bodyMedium, { marginBottom: 6 }]}>Unidad</Text>
          <View style={styles.pickerRow}>
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

          <Input label="Precio unitario (€) — opcional" value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" />
          <Input label="Proveedor — opcional" value={supplier} onChangeText={setSupplier} />
          <Input label="Notas — opcional" value={notes} onChangeText={setNotes} multiline />
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Button title="Crear material" onPress={submit} loading={saving} testID="mat-submit" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: COLORS.surface },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: SPACING.lg, paddingTop: SPACING.md,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
});
