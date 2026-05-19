import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  Modal, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/Icon';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Card, HeaderBar, SeverityBadge, Skeleton, EmptyState, Button, Input } from '../src/ui';
import { api, apiError } from '../src/api';
import { useAuth } from '../src/auth';

const ALERT_TYPES: { value: string; label: string }[] = [
  { value: 'INCIDENT_REPORTED', label: 'Incidente' },
  { value: 'LOW_STOCK', label: 'Stock bajo' },
  { value: 'BUDGET_EXCEEDED', label: 'Presupuesto excedido' },
  { value: 'PROJECT_DELAYED', label: 'Obra retrasada' },
  { value: 'LOG_MISSING', label: 'Parte faltante' },
];
const SEVERITIES: { value: 'INFO' | 'WARNING' | 'CRITICAL'; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Aviso' },
  { value: 'CRITICAL', label: 'Crítico' },
];

export default function Alerts() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const load = useCallback(async () => {
    try { const r = await api.get('/alerts'); setData(r.data); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (id: string) => {
    try { await api.patch(`/alerts/${id}/read`); load(); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Alertas" onBack={() => router.back()} />
      {data === null ? (
        <View style={{ padding: SPACING.lg, gap: 8 }}>{[1,2,3].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : data.length === 0 ? (
        <View style={{ padding: SPACING.lg }}>
          <Card><EmptyState icon="checkmark-circle-outline" title="Sin alertas" subtitle="Todo en orden." /></Card>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => markRead(item.id)} activeOpacity={0.85}>
              <Card style={!item.is_read ? { borderLeftWidth: 3, borderLeftColor: COLORS.primary } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <SeverityBadge severity={item.severity} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={TYPO.bodyMedium} numberOfLines={3}>{item.message}</Text>
                    <Text style={[TYPO.body, { color: COLORS.textTertiary, marginTop: 4, fontSize: 11 }]}>{new Date(item.created_at).toLocaleString('es-ES')}</Text>
                  </View>
                  {item.is_read ? <Icon name="checkmark-done" size={18} color={COLORS.textTertiary} /> : null}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {canCreate ? (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.85}
          onPress={() => setShowCreate(true)}
          testID="new-alert-fab"
        >
          <Icon name="add" size={22} color={COLORS.textInverse} />
          <Text style={styles.fabText}>Nueva alerta</Text>
        </TouchableOpacity>
      ) : null}

      <CreateAlertModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </View>
  );
}

function CreateAlertModal({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<string>('INCIDENT_REPORTED');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setType('INCIDENT_REPORTED');
    setSeverity('WARNING');
    setMessage('');
    setProjectId('');
    api.get('/projects').then((r) => setProjects(r.data || [])).catch(() => setProjects([]));
  }, [visible]);

  const selectedProject = projects.find((p) => p.id === projectId);

  const save = async () => {
    if (!projectId) { Alert.alert('Falta obra', 'Selecciona la obra a la que pertenece la alerta.'); return; }
    if (message.trim().length < 3) { Alert.alert('Mensaje muy corto', 'Escribe un mensaje descriptivo (mín. 3 caracteres).'); return; }
    setSaving(true);
    try {
      await api.post('/alerts', { type, severity, message: message.trim(), project_id: projectId });
      Alert.alert('Alerta creada', 'La alerta se ha registrado y se ha enviado a tu equipo.');
      onCreated();
    } catch (e) {
      Alert.alert('Error', apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={modalStyles.head}>
          <TouchableOpacity onPress={onClose}><Icon name="close" size={26} /></TouchableOpacity>
          <Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Nueva alerta</Text>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={[TYPO.caption, { marginBottom: 8 }]}>Tipo</Text>
            <View style={modalStyles.pillsWrap}>
              {ALERT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[modalStyles.pill, type === t.value && modalStyles.pillActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[modalStyles.pillText, type === t.value && modalStyles.pillTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[TYPO.caption, { marginTop: SPACING.lg, marginBottom: 8 }]}>Severidad</Text>
            <View style={modalStyles.pillsWrap}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSeverity(s.value)}
                  style={[
                    modalStyles.pill,
                    severity === s.value && modalStyles.pillActive,
                    severity === s.value && s.value === 'CRITICAL' && { backgroundColor: COLORS.danger || '#C53030', borderColor: COLORS.danger || '#C53030' },
                    severity === s.value && s.value === 'WARNING' && { backgroundColor: '#C58A00', borderColor: '#C58A00' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[modalStyles.pillText, severity === s.value && modalStyles.pillTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[TYPO.caption, { marginTop: SPACING.lg, marginBottom: 8 }]}>Obra *</Text>
            <TouchableOpacity onPress={() => setShowProjectPicker(true)} activeOpacity={0.7} style={modalStyles.selector}>
              <Icon name="business-outline" size={18} color={COLORS.textSecondary} />
              <Text style={[TYPO.bodyMedium, { marginLeft: 10, flex: 1, color: selectedProject ? COLORS.textPrimary : COLORS.textTertiary }]} numberOfLines={1}>
                {selectedProject ? selectedProject.name : 'Selecciona una obra'}
              </Text>
              <Icon name="chevron-forward" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>

            <View style={{ marginTop: SPACING.lg }}>
              <Input
                label="Mensaje *"
                value={message}
                onChangeText={setMessage}
                placeholder="Describe lo que ocurre…"
                multiline
                numberOfLines={4}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
                testID="alert-message"
              />
            </View>

            <Button title="Crear alerta" loading={saving} onPress={save} testID="save-alert" />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Project picker */}
        <Modal visible={showProjectPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProjectPicker(false)}>
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={modalStyles.head}>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}><Icon name="close" size={26} /></TouchableOpacity>
              <Text style={[TYPO.h2, { flex: 1, textAlign: 'center', marginRight: 26 }]}>Selecciona obra</Text>
            </View>
            <FlatList
              data={projects}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: SPACING.lg }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={
                <View style={{ paddingTop: 40 }}>
                  <Card><EmptyState icon="business-outline" title="Sin obras" subtitle="Crea una obra antes de generar la alerta." /></Card>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setProjectId(item.id); setShowProjectPicker(false); }}
                  activeOpacity={0.85}
                >
                  <Card style={projectId === item.id ? { borderLeftWidth: 3, borderLeftColor: COLORS.primary } : undefined}>
                    <Text style={TYPO.bodyMedium} numberOfLines={1}>{item.name}</Text>
                    {item.address ? <Text style={[TYPO.body, { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }]} numberOfLines={1}>{item.address}</Text> : null}
                  </Card>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: COLORS.textInverse, fontWeight: '700', marginLeft: 8, letterSpacing: 0.3 },
});

const modalStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 12.5 },
  pillTextActive: { color: COLORS.textInverse },
  selector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 4, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: COLORS.surface,
  },
});
