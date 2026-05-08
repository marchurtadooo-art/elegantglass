import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';

type AssignResult = {
  ok: boolean;
  lot: { id: string; lot_code: string; quantity_left?: number };
  material: { id?: string; name?: string; category?: string; unit?: string };
  zone: { id: string; name: string; category: string };
  row_label: string;
  relocated: boolean;
  print: { printed: boolean; printer_configured: boolean; message: string; bytes: number };
};

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);

  useEffect(() => { if (permission && !permission.granted) requestPermission(); }, [permission]);

  const handleCode = async (raw: string) => {
    if (scanned || processing) return;
    setScanned(true);
    const code = (raw || '').trim();
    if (code.startsWith('ZONE-')) {
      const zid = code.replace('ZONE-', '');
      router.replace({ pathname: '/warehouse/zones', params: { highlight: zid } });
      return;
    }
    if (code.startsWith('EG-')) {
      setProcessing(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      try {
        const r = await api.post('/warehouse/assign-and-print', { lot_code: code });
        setResult(r.data as AssignResult);
      } catch (e) {
        Alert.alert('Error', apiError(e), [
          { text: 'OK', onPress: () => { setScanned(false); setProcessing(false); } },
        ]);
      } finally {
        setProcessing(false);
      }
      return;
    }
    Alert.alert('Código no reconocido', code || 'Vacío', [
      { text: 'OK', onPress: () => setScanned(false) },
    ]);
  };

  const submitManual = () => {
    if (!manualCode.trim()) return;
    setShowManual(false);
    handleCode(manualCode.trim());
  };

  const resetScan = () => {
    setResult(null);
    setScanned(false);
    setManualCode('');
  };

  const goToLot = () => {
    if (!result) return;
    const lotCode = result.lot.lot_code;
    setResult(null);
    router.replace({ pathname: '/warehouse/lot/[lotCode]', params: { lotCode } });
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="scan-close">
          <Icon name="close" size={26} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.title}>Escanear QR</Text>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.iconBtn} testID="scan-manual">
          <Icon name="keypad-outline" size={22} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      {isWeb ? (
        <View style={styles.unsupported}>
          <Icon name="phone-portrait-outline" size={64} color={COLORS.surface} />
          <Text style={[TYPO.h2, { color: COLORS.surface, marginTop: SPACING.lg, textAlign: 'center' }]}>Cámara no disponible en navegador</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: SPACING.md }}>
            Usa la app móvil para escanear con la cámara, o introduce el código de lote manualmente.
          </Text>
          <View style={{ marginTop: SPACING.xl, width: '80%' }}>
            <Button title="Introducir código manual" icon="keypad-outline" onPress={() => setShowManual(true)} />
          </View>
        </View>
      ) : (
        <>
          {!permission ? null : !permission.granted ? (
            <View style={styles.unsupported}>
              <Icon name="camera-outline" size={64} color={COLORS.surface} />
              <Text style={[TYPO.h2, { color: COLORS.surface, marginTop: SPACING.lg, textAlign: 'center' }]}>Permiso de cámara</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.xl }}>
                Necesitamos acceso a la cámara para escanear códigos QR de los lotes.
              </Text>
              <View style={{ marginTop: SPACING.xl, width: '80%' }}>
                <Button title="Conceder permiso" onPress={requestPermission} />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => handleCode(data)}
              />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.frame} />
                <Text style={styles.hint}>Apunta al QR del lote o de la zona</Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Processing overlay */}
      <Modal visible={processing} animationType="fade" transparent>
        <View style={styles.processingWrap}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPO.h3, { marginTop: SPACING.md, textAlign: 'center' }]}>Clasificando lote…</Text>
            <Text style={[TYPO.body, { color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }]}>
              Buscando zona, asignando fila e imprimiendo etiqueta.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Result modal */}
      <Modal visible={!!result} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetScan}>
        {result ? <ResultScreen result={result} onScanAgain={resetScan} onGoToLot={goToLot} /> : null}
      </Modal>

      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManual(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <HeaderBar title="Código manual" onBack={() => setShowManual(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: SPACING.lg }} keyboardShouldPersistTaps="handled">
              <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.md }]}>
                Introduce el código del lote (ej: EG-2026-0001) o de la zona (ZONE-...).
              </Text>
              <Input label="Código" value={manualCode} onChangeText={setManualCode} autoCapitalize="characters" testID="manual-code" />
              <Button title="Buscar" onPress={submitManual} testID="manual-go" />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function ResultScreen({ result, onScanAgain, onGoToLot }: { result: AssignResult; onScanAgain: () => void; onGoToLot: () => void }) {
  const { material, zone, row_label, lot, print, relocated } = result;
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <HeaderBar title="Clasificación automática" onBack={onScanAgain} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
        <View style={styles.successBadge}>
          <Icon name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={[TYPO.h2, { color: COLORS.success, marginTop: 6, textAlign: 'center' }]}>
            {relocated ? 'Lote reubicado' : 'Lote clasificado'}
          </Text>
          <Text style={[TYPO.body, { color: COLORS.textSecondary, textAlign: 'center' }]}>
            {lot.lot_code}
          </Text>
        </View>

        <View style={{ height: SPACING.lg }} />

        <View style={styles.card}>
          <Text style={[TYPO.caption, { fontSize: 10 }]}>MATERIAL</Text>
          <Text style={[TYPO.h3, { marginTop: 2 }]} numberOfLines={3}>{material.name || '—'}</Text>
          <View style={styles.chipRow}>
            <View style={styles.catChip}>
              <Icon name="pricetag-outline" size={12} color={COLORS.primary} />
              <Text style={styles.catChipText}>{material.category}</Text>
            </View>
            {material.unit ? (
              <View style={styles.catChip}>
                <Text style={styles.catChipText}>{material.unit}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ height: SPACING.md }} />

        <View style={styles.assignCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={styles.locationIcon}>
              <Icon name="location" size={22} color={COLORS.surface} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[TYPO.caption, { fontSize: 10, color: 'rgba(255,255,255,0.7)' }]}>UBICACIÓN ASIGNADA</Text>
              <Text style={[TYPO.h2, { color: COLORS.surface }]} numberOfLines={2}>{zone.name}</Text>
            </View>
          </View>
          <View style={styles.rowBox}>
            <Icon name="swap-vertical-outline" size={16} color={COLORS.surface} />
            <Text style={{ color: COLORS.surface, marginLeft: 8, fontWeight: '700' }}>{row_label}</Text>
          </View>
        </View>

        <View style={{ height: SPACING.md }} />

        <View style={[styles.card, print.printed ? styles.printOk : styles.printPending]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              name={print.printed ? 'print' : print.printer_configured ? 'warning-outline' : 'time-outline'}
              size={22}
              color={print.printed ? COLORS.success : COLORS.warning}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={TYPO.bodyMedium}>
                {print.printed ? 'Etiqueta impresa' : print.printer_configured ? 'Impresora no disponible' : 'Etiqueta lista'}
              </Text>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12 }]}>{print.message}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: SPACING.xl }} />

        <View style={{ gap: 8 }}>
          <Button title="Ver detalle del lote" icon="arrow-forward" onPress={onGoToLot} testID="result-go-lot" />
          <Button title="Escanear otro" variant="secondary" icon="qr-code-outline" onPress={onScanAgain} testID="result-again" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.surface, fontSize: 16, fontWeight: '700' },
  unsupported: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: '#000' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderColor: COLORS.surface, borderWidth: 3, borderRadius: 12 },
  hint: { color: COLORS.surface, marginTop: SPACING.lg, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  processingWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  processingCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: SPACING.xl, width: '100%', maxWidth: 320, alignItems: 'center' },
  successBadge: { alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.successBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: COLORS.success },
  card: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  assignCard: { backgroundColor: COLORS.primary, padding: SPACING.lg, borderRadius: 6 },
  locationIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  rowBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', padding: 10, borderRadius: 4, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  catChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.4 },
  printOk: { borderLeftWidth: 3, borderLeftColor: COLORS.success, backgroundColor: COLORS.successBg },
  printPending: { borderLeftWidth: 3, borderLeftColor: COLORS.warning, backgroundColor: COLORS.warningBg },
});
