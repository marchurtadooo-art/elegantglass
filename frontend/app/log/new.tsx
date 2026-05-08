import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPO, WEATHER_OPTIONS } from '../../src/theme';
import { Button, Card, HeaderBar, Input, Skeleton } from '../../src/ui';
import { api, apiError } from '../../src/api';

export default function NewLog() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [projectId, setProjectId] = useState<string>(params.projectId || '');
  const [hours, setHours] = useState(8);
  const [description, setDescription] = useState('');
  const [weather, setWeather] = useState<typeof WEATHER_OPTIONS[number]['key']>('SUNNY');
  const [progress, setProgress] = useState(50);
  const [hasIncident, setHasIncident] = useState(false);
  const [incident, setIncident] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/projects').then((r) => {
      setProjects(r.data);
      if (!projectId && r.data?.length) setProjectId(r.data[0].id);
    });
  }, []);

  const submit = async () => {
    if (!projectId) { Alert.alert('Selecciona obra', 'Elige una obra antes de continuar.'); return; }
    if (description.trim().length < 20) { Alert.alert('Descripción', 'Mínimo 20 caracteres.'); return; }
    setSubmitting(true);
    try {
      await api.post('/daily-logs', {
        project_id: projectId,
        hours_worked: hours,
        work_description: description,
        weather_condition: weather,
        progress_percentage: progress,
        incidents: hasIncident && incident.trim() ? incident : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setSubmitting(false); }
  };

  const incHours = (delta: number) => setHours((h) => Math.max(0, Math.min(24, +(h + delta).toFixed(1))));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Nuevo parte" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[TYPO.caption, { marginBottom: 8 }]}>OBRA</Text>
          {projects === null ? <Skeleton height={48} />
            : projects.length === 0 ? <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>Sin obras asignadas.</Text>
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id} onPress={() => setProjectId(p.id)}
                    style={[styles.chip, projectId === p.id && styles.chipActive]}
                    testID={`select-project-${p.id}`}
                  >
                    <Text style={{ color: projectId === p.id ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>HORAS TRABAJADAS</Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => incHours(-0.5)} style={styles.stepBtn} testID="hours-minus"><Icon name="remove" size={20} color={COLORS.primary} /></TouchableOpacity>
            <Text style={styles.stepperValue} testID="hours-value">{hours}h</Text>
            <TouchableOpacity onPress={() => incHours(0.5)} style={styles.stepBtn} testID="hours-plus"><Icon name="add" size={20} color={COLORS.primary} /></TouchableOpacity>
          </View>

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>DESCRIPCIÓN DEL TRABAJO *</Text>
          <TextInput
            testID="log-description"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            style={styles.textarea}
            placeholder="Describe la actividad realizada (mín. 20 caracteres)..."
            placeholderTextColor={COLORS.textTertiary}
          />
          <Text style={[TYPO.body, { color: description.length < 20 ? COLORS.danger : COLORS.textTertiary, fontSize: 11, marginTop: 4 }]}>
            {description.length}/20 caracteres
          </Text>

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>METEOROLOGÍA</Text>
          <View style={styles.weatherRow}>
            {WEATHER_OPTIONS.map((w) => (
              <TouchableOpacity
                key={w.key}
                onPress={() => setWeather(w.key)}
                style={[styles.weatherItem, weather === w.key && styles.weatherItemActive]}
                testID={`weather-${w.key}`}
              >
                <Icon name={w.icon as any} size={20} color={weather === w.key ? COLORS.surface : COLORS.textPrimary} />
                <Text style={{ color: weather === w.key ? COLORS.surface : COLORS.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 4 }}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>AVANCE: {progress}%</Text>
          <View style={styles.progressRow}>
            {[0, 25, 50, 75, 100].map((v) => (
              <TouchableOpacity key={v} onPress={() => setProgress(v)} style={[styles.progressBtn, progress === v && styles.progressBtnActive]} testID={`progress-${v}`}>
                <Text style={{ color: progress === v ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }}>{v}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>INCIDENCIAS</Text>
          <TouchableOpacity onPress={() => setHasIncident(!hasIncident)} style={styles.toggle} testID="toggle-incident">
            <Icon name={hasIncident ? 'checkbox' : 'square-outline'} size={22} color={hasIncident ? COLORS.danger : COLORS.textSecondary} />
            <Text style={[TYPO.bodyMedium, { marginLeft: 10 }]}>Reportar incidente</Text>
          </TouchableOpacity>
          {hasIncident ? (
            <TextInput
              testID="incident-text"
              multiline
              value={incident}
              onChangeText={setIncident}
              style={[styles.textarea, { marginTop: 8, minHeight: 80 }]}
              placeholder="Describe brevemente el incidente..."
              placeholderTextColor={COLORS.textTertiary}
            />
          ) : null}

        </ScrollView>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Button title="Guardar parte" icon="checkmark" loading={submitting} onPress={submit} testID="submit-log" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, maxWidth: 220 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignSelf: 'flex-start' },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { paddingHorizontal: 24, fontSize: 20, fontWeight: '700' },
  textarea: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, padding: 12, minHeight: 100, fontSize: 15, color: COLORS.textPrimary, textAlignVertical: 'top' },
  weatherRow: { flexDirection: 'row', gap: 6 },
  weatherItem: { flex: 1, padding: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  weatherItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressBtn: { flex: 1, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  progressBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggle: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.lg, paddingTop: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
});
