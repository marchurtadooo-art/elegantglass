import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import { COLORS, SPACING, TYPO } from '../../src/theme';
import { Avatar, Button, Card, HeaderBar, Input } from '../../src/ui';
import { api, apiError } from '../../src/api';
import { useAuth } from '../../src/auth';

export default function NewProject() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // WORKER never sees the budget step. Steps: 0 info, 1 dates+notes, 2 team, 3 review
  const STEPS_LABELS = useMemo(() => (
    isWorker
      ? ['Información', 'Fechas y notas', 'Equipo', 'Revisar']
      : ['Información', 'Presupuesto', 'Equipo', 'Revisar']
  ), [isWorker]);
  const totalSteps = STEPS_LABELS.length;

  useEffect(() => {
    api.get('/users').then((r) => setWorkers(r.data.filter((u: any) => u.role === 'WORKER'))).catch(() => {});
    if (editing) {
      api.get(`/projects/${params.id}`).then((r) => {
        const p = r.data;
        setName(p.name); setDescription(p.description || ''); setAddress(p.address || '');
        setClient(p.client_name || ''); setPhone(p.client_phone || '');
        if (!isWorker) setBudget(String(p.budget || ''));
        setStartDate(p.start_date || '');
        setEndDate(p.end_date || '');
        setNotes(p.notes || '');
        setSelectedWorkers(p.assigned_worker_ids || []);
      }).catch(() => {});
    }
  }, [editing, params.id, isWorker]);

  const next = () => {
    if (step === 0 && (!name || !address || !client)) {
      Alert.alert('Faltan campos', 'Nombre, dirección y cliente son obligatorios.');
      return;
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setSaving(true);
    const body: any = {
      name,
      description,
      address,
      status: editing ? undefined : 'PENDING',
      client_name: client,
      client_phone: phone,
      start_date: startDate || null,
      end_date: endDate || null,
      notes,
      assigned_worker_ids: selectedWorkers,
    };
    // WORKERs never send budget. Backend also forces budget = 0 for that role.
    if (!isWorker) {
      body.budget = parseFloat(budget) || 0;
    }
    try {
      if (editing) await api.patch(`/projects/${params.id}`, { ...body, status: 'ACTIVE' });
      else await api.post('/projects', body);
      router.back();
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title={editing ? 'Editar obra' : 'Nueva obra'} onBack={() => router.back()} />
      <View style={styles.steps}>
        {STEPS_LABELS.map((_, i) => (
          <View key={i} style={[styles.step, i === step && styles.stepActive, i < step && styles.stepDone]}>
            <Text style={{ color: i === step ? COLORS.surface : i < step ? COLORS.surface : COLORS.textSecondary, fontWeight: '700' }}>{i + 1}</Text>
          </View>
        ))}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>1. Información</Text>
              <Input label="Nombre de la obra *" value={name} onChangeText={setName} testID="proj-name" />
              <Input label="Descripción" value={description} onChangeText={setDescription} multiline />
              <Input label="Dirección *" value={address} onChangeText={setAddress} testID="proj-address" />
              <Input label="Cliente *" value={client} onChangeText={setClient} testID="proj-client" />
              <Input label="Teléfono cliente" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>
          )}

          {/* Step 1 differs by role:
              - ADMIN/MANAGER → Presupuesto + fecha fin
              - WORKER → Fecha inicio + fecha fin + notas (NO budget visible) */}
          {step === 1 && !isWorker && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>2. Presupuesto</Text>
              <Input label="Presupuesto total (€)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" testID="proj-budget" />
              <Input label="Fecha inicio (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
              <Input label="Fecha fin estimada (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
              <Input label="Notas internas" value={notes} onChangeText={setNotes} multiline />
            </View>
          )}
          {step === 1 && isWorker && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>2. Fechas y notas</Text>
              <Input label="Fecha inicio (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} testID="proj-start-date" />
              <Input label="Fecha fin estimada (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} testID="proj-end-date" />
              <Input label="Notas" value={notes} onChangeText={setNotes} multiline testID="proj-notes" />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>3. Equipo asignado</Text>
              <Text style={[TYPO.body, { color: COLORS.textSecondary, marginBottom: SPACING.md }]}>Selecciona los operarios que trabajarán en esta obra.</Text>
              {workers.map((w) => {
                const sel = selectedWorkers.includes(w.id);
                return (
                  <TouchableOpacity
                    key={w.id} testID={`select-worker-${w.id}`}
                    onPress={() => setSelectedWorkers((s) => sel ? s.filter((x) => x !== w.id) : [...s, w.id])}
                    style={[styles.workerRow, sel && { borderColor: COLORS.primary }]}
                  >
                    <Avatar name={w.name} size={36} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={TYPO.bodyMedium} numberOfLines={1}>{w.name}</Text>
                      <Text style={[TYPO.body, { color: COLORS.textSecondary }]} numberOfLines={1}>{w.email}</Text>
                    </View>
                    <Icon name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? COLORS.primary : COLORS.textTertiary} />
                  </TouchableOpacity>
                );
              })}
              {workers.length === 0 ? <Text style={[TYPO.body, { color: COLORS.textSecondary }]}>No hay operarios. Invita primero desde Equipo.</Text> : null}
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={[TYPO.h2, { marginBottom: SPACING.md }]}>4. Revisar y publicar</Text>
              <Card>
                <Row label="Nombre" value={name} />
                <Row label="Cliente" value={client} />
                <Row label="Dirección" value={address} />
                {/* Budget row hidden for WORKER */}
                {!isWorker ? <Row label="Presupuesto" value={`€${budget || 0}`} /> : null}
                <Row label="Fecha inicio" value={startDate || '—'} />
                <Row label="Fin estimado" value={endDate || '—'} />
                <Row label="Operarios" value={`${selectedWorkers.length}`} />
                {notes ? <Row label="Notas" value={notes} /> : null}
              </Card>
            </View>
          )}
        </ScrollView>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {step > 0 ? <View style={{ flex: 1, marginRight: 8 }}><Button title="Atrás" variant="secondary" onPress={back} /></View> : null}
          {step < totalSteps - 1 ? (
            <View style={{ flex: 2 }}><Button title="Siguiente" onPress={next} testID="step-next" /></View>
          ) : (
            <View style={{ flex: 2 }}><Button title={editing ? 'Guardar' : 'Crear obra'} loading={saving} onPress={submit} testID="proj-submit" /></View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={[TYPO.body, { color: COLORS.textSecondary, flexShrink: 0 }]}>{label}</Text>
      <Text style={[TYPO.bodyMedium, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={3}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  stepActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  workerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, marginBottom: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.lg, paddingTop: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row' },
});
