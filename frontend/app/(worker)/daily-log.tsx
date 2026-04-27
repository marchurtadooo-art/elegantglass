import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Button } from '../../src/ui';

export default function WorkerDailyLogTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 12, padding: SPACING.lg }}>
      <Text style={TYPO.h1}>Parte diario</Text>
      <Text style={[TYPO.body, { color: COLORS.textSecondary, marginTop: 6, marginBottom: SPACING.xl }]}>
        Registra tu jornada en pocos segundos. Selecciona la obra, anota horas trabajadas y describe la actividad realizada.
      </Text>
      <View style={styles.bigCard}>
        <View style={styles.iconWrap}>
          <Ionicons name="clipboard-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={[TYPO.h2, { marginTop: SPACING.lg, textAlign: 'center' }]}>Crear parte diario</Text>
        <Text style={[TYPO.body, { color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 }]}>
          Adjunta fotos y materiales utilizados.
        </Text>
        <View style={{ width: '100%', marginTop: SPACING.xl }}>
          <Button title="Empezar" icon="add" onPress={() => router.push('/log/new')} testID="start-daily-log" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bigCard: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4,
    padding: SPACING.xl, alignItems: 'center',
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
});
