import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, Card, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { downloadBase64File } from '../../src/files';

export default function ReceiveLot() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [materials, setMaterials] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [qty, setQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdLot, setCreatedLot] = useState<any | null>(null);
  const [labelB64, setLabelB64] = useState<string | null>(null);

  useEffect(() => { api.get('/materials').then((r) => setMaterials(r.data)).catch(() => {}); }, []);

  const filtered = materials.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  const create = async () => {
    if (!selected) { setStep(0); return; }
    const q = parseFloat(qty.replace(',', '.'));
    if (!q || q <= 0) { Alert.alert('Cantidad', 'Indica una cantidad válida.'); return; }
    setSaving(true);
    try {
      const r = await api.post('/warehouse/lots', {
        material_id: selected.id, quantity: q,
        supplier_name: supplier || selected.supplier,
        unit_price: price ? parseFloat(price.replace(',', '.')) : undefined,
        notes,
      });
      setCreatedLot(r.data);
      const lp = await api.get(`/warehouse/lots/${r.data.lot_code}/label-preview`);
      setLabelB64(lp.data.base64);
      setStep(2);
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSaving(false); }
  };

  const printIt = async () => {
    try { await api.post(`/warehouse/lots/${createdLot.lot_code}/print`); Alert.alert('Imprimiendo', 'Etiqueta enviada a la impresora.'); }
    catch (e) { Alert.alert('Impresora', apiError(e)); }
  };
  const downloadIt = async () => {
    try { const r = await api.get(`/warehouse/lots/${createdLot.lot_code}/label-preview`); await downloadBase64File(r.data); }
    catch (e) { Alert.alert('Error', apiError(e)); }
  };

  const goLocate = () => router.replace({ pathname: '/warehouse/lot/[lotCode]', params: { lotCode: createdLot.lot_code } });
  const goScanZone = () => router.replace('/warehouse/scan');

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Recibir material" onBack={() => router.back()} />
      <View style={styles.steps}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.step, i === step && styles.stepActive, i < step && styles.stepDone]}>
            <Text style={{ color: i === step ? COLORS.surface : i < step ? COLORS.surface : COLORS.textSecondary, fontWeight: '700' }}>{i + 1}</Text>
          </View>
        ))}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {step === 0 && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>1. Selecciona material</Text>
              <View style={styles.searchBox}>
                <Icon name="search-outline" size={18} color={COLORS.textTertiary} />
                <TextInput value={search} onChangeText={setSearch} placeholder="Buscar..." placeholderTextColor={COLORS.textTertiary} style={{ flex: 1, marginLeft: 8, height: 44, color: COLORS.textPrimary }} testID="rec-search" />
              </View>
              <View style={{ height: SPACING.md }} />
              {filtered.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => { setSelected(m); setStep(1); }} style={styles.matRow} testID={`rec-mat-${m.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={TYPO.bodyMedium} numberOfLines={1}>{m.name}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>{m.unit} · {m.category} · {m.supplier}</Text>
                  </View>
                  <Text style={TYPO.bodyMedium}>€{m.unit_price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 1 && selected && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>2. Datos del lote</Text>
              <Card>
                <Text style={TYPO.bodyMedium}>{selected.name}</Text>
                <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>{selected.unit} · {selected.category}</Text>
                <TouchableOpacity onPress={() => setStep(0)} style={{ marginTop: 6 }}><Text style={{ color: COLORS.info, fontSize: 13, fontWeight: '700' }}>Cambiar material</Text></TouchableOpacity>
              </Card>
              <View style={{ height: SPACING.md }} />
              <Input label="Cantidad recibida" value={qty} onChangeText={setQty} keyboardType="decimal-pad" testID="rec-qty" />
              <Input label="Proveedor" value={supplier} onChangeText={setSupplier} placeholder={selected.supplier || 'Proveedor'} />
              <Input label={`Precio unitario (€) — opcional, por defecto €${selected.unit_price}`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <Input label="Notas" value={notes} onChangeText={setNotes} multiline />
              <Button title="Crear lote y etiqueta" icon="add" loading={saving} onPress={create} testID="rec-create" />
            </View>
          )}

          {step === 2 && createdLot && (
            <View>
              <View style={styles.success}>
                <Icon name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={[TYPO.h2, { marginTop: 8, color: COLORS.success, textAlign: 'center' }]}>Lote creado</Text>
                <Text style={[TYPO.h3, { marginTop: 4, textAlign: 'center' }]}>{createdLot.lot_code}</Text>
              </View>
              <View style={{ height: SPACING.md }} />
              {labelB64 ? (
                <Image source={{ uri: `data:image/png;base64,${labelB64}` }} style={{ width: '100%', aspectRatio: 600/760, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }} resizeMode="contain" />
              ) : null}
              <View style={{ height: SPACING.lg }} />
              <View style={{ gap: 8 }}>
                <Button title="Imprimir etiqueta" icon="print-outline" onPress={printIt} testID="rec-print" />
                <Button title="Descargar PNG" variant="secondary" icon="download-outline" onPress={downloadIt} />
                <Button title="Escanear zona para ubicar" variant="secondary" icon="qr-code-outline" onPress={goScanZone} />
                <Button title="Ver detalle del lote" variant="ghost" onPress={goLocate} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  stepActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12 },
  matRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4 },
  success: { alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.successBg, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: COLORS.success },
});
