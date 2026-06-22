/**
 * Seguimiento de Obra — Fase 1 MVP
 *
 * Diseño estricto BLANCO Y NEGRO. No se usa ningún color de la paleta principal.
 * Los estados de etapa se distinguen por FORMA y GROSOR, nunca por color:
 *   · Hecho      → punto negro relleno con ✓
 *   · En curso   → aro negro grueso (centro blanco)
 *   · Pendiente  → punto hueco con borde gris
 *   · Retraso    → punto negro con "!" + etiqueta NEGATIVO (fondo negro)
 *
 * Barra de progreso: tramo hecho = negro sólido, tramo en curso = gris rayado.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon } from '../Icon';
import { api, apiError } from '../api';

// ─── Monochrome tokens (independent of the global theme) ─────────────────
const BW = {
  black:   '#111111',
  white:   '#FFFFFF',
  ink:     '#1A1A1A',
  text:    '#1A1A1A',
  textSec: '#4A4A4A',
  textDim: '#8A8A8A',
  border:  '#D6D6D6',
  borderLight: '#ECECEC',
  bg:      '#F5F5F5',
  card:    '#FFFFFF',
};

const GROUP_LABEL: Record<string, string> = {
  INICIO:  'Inicio',
  COMPRAS: 'Compras',
  TALLER:  'Taller',
  MONTAJE: 'Montaje',
  GENERAL: 'Notas',
};
const GROUP_ORDER = ['INICIO', 'COMPRAS', 'TALLER', 'MONTAJE', 'GENERAL'];

type Stage = {
  id: string;
  project_id: string;
  group: string;
  type: string;
  label: string;
  order: number;
  multi_line: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  due_date: string | null;
  actual_date: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  lines: any[];
  updated_by_name: string;
  updated_at: string;
  is_overdue?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────
export default function Seguimiento({ projectId }: { projectId: string }) {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/projects/${projectId}/stages`);
      setStages(r.data || []);
    } catch (e) { console.warn(apiError(e)); }
  }, [projectId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const grouped = useMemo(() => {
    const map: Record<string, Stage[]> = {};
    (stages || []).forEach((s) => {
      (map[s.group] = map[s.group] || []).push(s);
    });
    return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => ({ group: g, items: map[g] }));
  }, [stages]);

  const progress = useMemo(() => {
    if (!stages || stages.length === 0) return { done: 0, total: 0, inProgress: 0, overdue: 0, pct: 0 };
    const total = stages.length;
    const done = stages.filter((s) => s.status === 'DONE').length;
    const inProgress = stages.filter((s) => s.status === 'IN_PROGRESS').length;
    const overdue = stages.filter((s) => s.is_overdue).length;
    return { done, total, inProgress, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [stages]);

  const markDone = async (s: Stage) => {
    try {
      await api.patch(`/projects/${projectId}/stages/${s.id}`, { status: 'DONE' });
      await load();
    } catch (e) { Alert.alert('Error', apiError(e)); }
  };

  if (!stages) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={BW.black} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: BW.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BW.black} />}
      >
        {/* ── Progress header ─────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKicker}>SEGUIMIENTO</Text>
              <Text style={styles.headerTitle}>{progress.done} de {progress.total} etapas hechas</Text>
              <Text style={styles.headerSub}>
                {progress.inProgress > 0 ? `${progress.inProgress} en curso · ` : ''}
                {progress.overdue > 0 ? `${progress.overdue} con retraso` : 'sin retrasos'}
              </Text>
            </View>
            <Text style={styles.pct}>{progress.pct}%</Text>
          </View>
          <ProgressBarMono done={progress.done} inProgress={progress.inProgress} total={progress.total} />
        </View>

        {/* ── Groups ─────────────────────────────────────────────── */}
        {grouped.map(({ group, items }) => (
          <View key={group} style={{ marginTop: 22 }}>
            <Text style={styles.groupTitle}>{GROUP_LABEL[group]}</Text>
            <View style={{ position: 'relative', paddingLeft: 28 }}>
              {/* vertical timeline line */}
              <View style={styles.timelineLine} />
              {items.map((s, idx) => (
                <StageCard
                  key={s.id}
                  stage={s}
                  isLast={idx === items.length - 1}
                  onMarkDone={() => markDone(s)}
                  onEdit={() => setEditing(s)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {editing ? (
        <StageEditorModal
          stage={editing}
          projectId={projectId}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      ) : null}
    </>
  );
}

// ─── Progress bar (monochrome) ───────────────────────────────────────────
function ProgressBarMono({ done, inProgress, total }: { done: number; inProgress: number; total: number }) {
  const t = Math.max(total, 1);
  const wDone = `${Math.round((done / t) * 100)}%` as any;
  const wProg = `${Math.round((inProgress / t) * 100)}%` as any;
  return (
    <View style={styles.bar}>
      <View style={[styles.barDone, { width: wDone }]} />
      {/* hatched portion for in-progress — simulated with vertical stripes */}
      <View style={[styles.barInProgress, { width: wProg }]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={styles.barStripe} />
        ))}
      </View>
    </View>
  );
}

// ─── Stage status dot ────────────────────────────────────────────────────
function StatusDot({ stage }: { stage: Stage }) {
  if (stage.is_overdue) {
    return (
      <View style={[styles.dot, styles.dotOverdue]}>
        <Text style={styles.dotOverdueText}>!</Text>
      </View>
    );
  }
  if (stage.status === 'DONE') {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Icon name="checkmark" size={14} color={BW.white} />
      </View>
    );
  }
  if (stage.status === 'IN_PROGRESS') {
    return <View style={[styles.dot, styles.dotInProgress]} />;
  }
  return <View style={[styles.dot, styles.dotPending]} />;
}

// ─── Stage card ──────────────────────────────────────────────────────────
function StageCard({ stage, onMarkDone, onEdit, isLast }: { stage: Stage; onMarkDone: () => void; onEdit: () => void; isLast: boolean }) {
  return (
    <View style={{ marginBottom: isLast ? 0 : 14, position: 'relative' }}>
      <View style={styles.dotWrap}>
        <StatusDot stage={stage} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.stageLabel} numberOfLines={2}>{stage.label}</Text>
          {stage.is_overdue ? (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>RETRASO</Text>
            </View>
          ) : null}
        </View>

        {/* Dates row */}
        <DatesRow stage={stage} />

        {/* Multi-line items (proveedor o equipo) */}
        {stage.multi_line && stage.lines.length > 0 ? (
          <View style={styles.linesBox}>
            {stage.lines.map((l: any) => (
              <View key={l.id} style={styles.lineRow}>
                <Text style={styles.lineMain} numberOfLines={1}>
                  {l.provider_or_team || '—'}{l.date ? ` · ${fmtDate(l.date)}` : ''}
                </Text>
                {Array.isArray(l.responsibles) && l.responsibles.length > 0 ? (
                  <Text style={styles.lineSec} numberOfLines={1}>{l.responsibles.join(', ')}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {stage.notes ? (
          <Text style={styles.notes} numberOfLines={4}>{stage.notes}</Text>
        ) : null}

        {/* Footer: updated_by + actions */}
        <View style={styles.footer}>
          <Text style={styles.footerMeta} numberOfLines={1}>
            {stage.updated_by_name ? `Actualizado por ${stage.updated_by_name} · ${timeAgo(stage.updated_at)}` : '—'}
          </Text>
        </View>
        <View style={styles.actionsRow}>
          {stage.status !== 'DONE' ? (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onMarkDone} activeOpacity={0.85}>
              <Icon name="checkmark" size={16} color={BW.white} />
              <Text style={styles.btnPrimaryText}>Marcar como hecho</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.btn, styles.btnDoneStatic]}>
              <Icon name="checkmark-circle" size={16} color={BW.black} />
              <Text style={styles.btnDoneStaticText}>Hecho</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onEdit} activeOpacity={0.85}>
            <Icon name="calendar-outline" size={16} color={BW.black} />
            <Text style={styles.btnSecondaryText}>{stage.multi_line ? 'Detalle / fechas' : 'Añadir fecha'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function DatesRow({ stage }: { stage: Stage }) {
  const items: { label: string; value: string }[] = [];
  if (stage.due_date)    items.push({ label: 'PREVISTA', value: fmtDate(stage.due_date) });
  if (stage.actual_date) items.push({ label: 'REAL',     value: fmtDate(stage.actual_date) });
  if (stage.start_date)  items.push({ label: 'INICIO',   value: fmtDate(stage.start_date) });
  if (stage.end_date)    items.push({ label: 'FIN',      value: fmtDate(stage.end_date) });
  if (!items.length) return null;
  return (
    <View style={styles.datesRow}>
      {items.map((d) => (
        <View key={d.label} style={styles.dateItem}>
          <Text style={styles.dateLabel}>{d.label}</Text>
          <Text style={styles.dateValue}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Stage editor (dates + notes + lines) ────────────────────────────────
function StageEditorModal({ stage, projectId, onClose, onSaved }: { stage: Stage; projectId: string; onClose: () => void; onSaved: () => void }) {
  const [dueDate, setDueDate]       = useState(stage.due_date    || '');
  const [actualDate, setActualDate] = useState(stage.actual_date || '');
  const [startDate, setStartDate]   = useState(stage.start_date  || '');
  const [endDate, setEndDate]       = useState(stage.end_date    || '');
  const [notes, setNotes]           = useState(stage.notes       || '');
  const [saving, setSaving]         = useState(false);

  // For multi_line stages — pending new line
  const [provider, setProvider]   = useState('');
  const [lineDate, setLineDate]   = useState('');
  const [resp, setResp]           = useState('');
  const [addingLine, setAddingLine] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/stages/${stage.id}`, {
        due_date: dueDate || null,
        actual_date: actualDate || null,
        start_date: startDate || null,
        end_date: endDate || null,
        notes,
      });
      onSaved();
    } catch (e) { Alert.alert('Error', apiError(e)); setSaving(false); }
  };

  const addLine = async () => {
    if (!provider.trim() && !lineDate.trim()) {
      Alert.alert('Datos insuficientes', 'Indica al menos proveedor/equipo o fecha.');
      return;
    }
    setAddingLine(true);
    try {
      await api.post(`/projects/${projectId}/stages/${stage.id}/lines`, {
        provider_or_team: provider.trim(),
        date: lineDate.trim() || null,
        responsibles: resp.trim() ? resp.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      setProvider(''); setLineDate(''); setResp('');
      onSaved();
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setAddingLine(false); }
  };

  const removeLine = async (lineId: string) => {
    try {
      await api.delete(`/projects/${projectId}/stages/${stage.id}/lines/${lineId}`);
      onSaved();
    } catch (e) { Alert.alert('Error', apiError(e)); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: BW.bg }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="close" size={22} color={BW.black} />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{stage.label}</Text>
          <TouchableOpacity onPress={save} disabled={saving} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.modalSave, saving && { opacity: 0.4 }]}>{saving ? '...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <DateField label="Fecha prevista" value={dueDate} onChange={setDueDate} />
          <DateField label="Fecha real / completado" value={actualDate} onChange={setActualDate} />
          <DateField label="Fecha de inicio" value={startDate} onChange={setStartDate} />
          <DateField label="Fecha de fin" value={endDate} onChange={setEndDate} />

          <Text style={styles.fieldLabel}>Notas</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Notas internas sobre esta etapa..."
            placeholderTextColor={BW.textDim}
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          />

          {stage.multi_line ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Líneas</Text>
              {stage.lines.map((l: any) => (
                <View key={l.id} style={styles.lineEditRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.lineMain} numberOfLines={1}>
                      {l.provider_or_team || '—'}{l.date ? ` · ${fmtDate(l.date)}` : ''}
                    </Text>
                    {Array.isArray(l.responsibles) && l.responsibles.length > 0 ? (
                      <Text style={styles.lineSec} numberOfLines={1}>{l.responsibles.join(', ')}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => removeLine(l.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash-outline" size={18} color={BW.black} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addLineBox}>
                <Text style={styles.fieldLabel}>Nueva línea</Text>
                <TextInput value={provider} onChangeText={setProvider} placeholder="Proveedor o equipo (ej: Cortizo, Equipo Norte)" placeholderTextColor={BW.textDim} style={styles.input} />
                <TextInput value={lineDate} onChangeText={setLineDate} placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor={BW.textDim} style={styles.input} />
                <TextInput value={resp} onChangeText={setResp} placeholder="Responsables (separados por coma)" placeholderTextColor={BW.textDim} style={styles.input} />
                <TouchableOpacity onPress={addLine} disabled={addingLine} style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}>
                  <Icon name="add" size={16} color={BW.white} />
                  <Text style={styles.btnPrimaryText}>{addingLine ? 'Añadiendo...' : 'Añadir línea'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={BW.textDim}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}
function timeAgo(s?: string | null) {
  if (!s) return '';
  try {
    const d = new Date(s).getTime();
    const diff = Date.now() - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `hace ${h} h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `hace ${days} d`;
    return new Date(s).toLocaleDateString('es-ES');
  } catch { return ''; }
}

const styles = StyleSheet.create({
  // ─── Header card ───
  headerCard: { backgroundColor: BW.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BW.border },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  headerKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: BW.textDim },
  headerTitle: { fontSize: 20, fontWeight: '800', color: BW.text, marginTop: 2 },
  headerSub: { fontSize: 12, color: BW.textSec, marginTop: 4 },
  pct: { fontSize: 32, fontWeight: '800', color: BW.black, fontVariant: ['tabular-nums'] },

  // ─── Progress bar ───
  bar: { height: 10, borderRadius: 5, backgroundColor: BW.borderLight, overflow: 'hidden', flexDirection: 'row' },
  barDone: { height: '100%', backgroundColor: BW.black },
  barInProgress: { height: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: BW.borderLight, overflow: 'hidden' },
  barStripe: { width: 3, height: 12, backgroundColor: BW.black, marginRight: 3, transform: [{ skewX: '-25deg' }], opacity: 0.55 },

  // ─── Group ───
  groupTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: BW.textDim, marginBottom: 12, marginLeft: 4 },
  timelineLine: { position: 'absolute', left: 10, top: 6, bottom: 6, width: 1, backgroundColor: BW.border },

  // ─── Stage card + dot ───
  dotWrap: { position: 'absolute', left: -28, top: 14, width: 24, alignItems: 'center', zIndex: 2, backgroundColor: BW.bg, paddingVertical: 2 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: BW.black },
  dotInProgress: { backgroundColor: BW.white, borderWidth: 4, borderColor: BW.black },
  dotPending: { backgroundColor: BW.white, borderWidth: 2, borderColor: BW.border },
  dotOverdue: { backgroundColor: BW.black },
  dotOverdueText: { color: BW.white, fontSize: 13, fontWeight: '900', lineHeight: 15 },

  card: { backgroundColor: BW.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BW.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  stageLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: BW.text },

  overdueBadge: { backgroundColor: BW.black, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  overdueBadgeText: { color: BW.white, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },

  datesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  dateItem: { minWidth: 70 },
  dateLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: BW.textDim },
  dateValue: { fontSize: 14, fontWeight: '700', color: BW.text, fontVariant: ['tabular-nums'], marginTop: 1 },

  linesBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: BW.borderLight, paddingTop: 8 },
  lineRow: { marginBottom: 4 },
  lineMain: { fontSize: 13, color: BW.text, fontWeight: '600' },
  lineSec: { fontSize: 11, color: BW.textSec, marginTop: 1 },

  notes: { fontSize: 13, color: BW.textSec, marginTop: 8, fontStyle: 'italic' },

  footer: { marginTop: 12 },
  footerMeta: { fontSize: 11, color: BW.textDim },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 8 },
  btnPrimary: { backgroundColor: BW.black },
  btnPrimaryText: { color: BW.white, fontWeight: '700', fontSize: 13 },
  btnSecondary: { backgroundColor: BW.white, borderWidth: 1, borderColor: BW.black },
  btnSecondaryText: { color: BW.black, fontWeight: '700', fontSize: 13 },
  btnDoneStatic: { backgroundColor: BW.borderLight },
  btnDoneStaticText: { color: BW.black, fontWeight: '700', fontSize: 13 },

  // ─── Modal ───
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 18, paddingBottom: 12,
    backgroundColor: BW.white, borderBottomWidth: 1, borderBottomColor: BW.border,
  },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: BW.text, paddingHorizontal: 12 },
  modalSave: { fontSize: 15, fontWeight: '700', color: BW.black },

  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: BW.textDim, marginBottom: 5, marginTop: 4 },
  input: {
    backgroundColor: BW.white, borderWidth: 1, borderColor: BW.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: BW.text, fontVariant: ['tabular-nums'],
  },

  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: BW.textDim, marginBottom: 10 },
  lineEditRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BW.white, borderWidth: 1, borderColor: BW.border, borderRadius: 8,
    padding: 12, marginBottom: 8,
  },
  addLineBox: {
    backgroundColor: BW.white, borderWidth: 1, borderColor: BW.border, borderRadius: 10,
    padding: 12, marginTop: 8, gap: 8,
  },
});
