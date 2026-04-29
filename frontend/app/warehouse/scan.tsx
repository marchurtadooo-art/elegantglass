import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button, HeaderBar, Input } from '../../src/ui';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => { if (permission && !permission.granted) requestPermission(); }, [permission]);

  const handleCode = (raw: string) => {
    if (scanned) return;
    setScanned(true);
    const code = (raw || '').trim();
    if (code.startsWith('ZONE-')) {
      const zid = code.replace('ZONE-', '');
      router.replace({ pathname: '/warehouse/zones', params: { highlight: zid } });
    } else if (code.startsWith('EG-')) {
      router.replace({ pathname: '/warehouse/lot/[lotCode]', params: { lotCode: code } });
    } else {
      Alert.alert('Código no reconocido', code || 'Vacío', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  };

  const submitManual = () => {
    if (!manualCode.trim()) return;
    setShowManual(false);
    handleCode(manualCode.trim());
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="scan-close">
          <Ionicons name="close" size={26} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.title}>Escanear QR</Text>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.iconBtn} testID="scan-manual">
          <Ionicons name="keypad-outline" size={22} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      {isWeb ? (
        <View style={styles.unsupported}>
          <Ionicons name="phone-portrait-outline" size={64} color={COLORS.surface} />
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
              <Ionicons name="camera-outline" size={64} color={COLORS.surface} />
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

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.surface, fontSize: 16, fontWeight: '700' },
  unsupported: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: '#000' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderColor: COLORS.surface, borderWidth: 3, borderRadius: 12 },
  hint: { color: COLORS.surface, marginTop: SPACING.lg, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
});
