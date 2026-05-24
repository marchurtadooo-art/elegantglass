import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, StyleProp, Pressable, Animated, Easing, Platform,
} from 'react-native';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING, STATUS_COLORS, SEVERITY_COLORS, TYPO } from './theme';

const safeHaptic = (style: any) => {
  if (Platform.OS === 'web') return;
  try { Haptics.impactAsync(style).catch(() => {}); } catch {}
};
const safeSelection = () => {
  if (Platform.OS === 'web') return;
  try { Haptics.selectionAsync().catch(() => {}); } catch {}
};

// ---------- Button ----------
type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof any;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  size?: 'md' | 'sm';
};
export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon, testID, style, haptic = true, size = 'md',
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const bg = isPrimary ? COLORS.primary : isDanger ? COLORS.danger : isSecondary ? COLORS.surface : 'transparent';
  const fg = (isPrimary || isDanger) ? COLORS.textInverse : COLORS.textPrimary;
  const border = isSecondary ? 1 : 0;
  // Auto-shrink text when title is long so it never gets clipped
  const titleLen = (title || '').length;
  const adaptiveSize = titleLen > 22 ? 13 : titleLen > 16 ? 14 : 15;
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      onPress={() => {
        if (haptic) safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      disabled={disabled || loading}
      style={[
        styles.btn,
        size === 'sm' && { height: 36 },
        { backgroundColor: bg, borderWidth: border, borderColor: COLORS.border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} style={{ marginRight: 6 }} /> : null}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[{ color: fg, fontWeight: '600', fontSize: adaptiveSize, flexShrink: 1 }]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------- Card ----------
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

// ---------- Status Badge ----------
export function StatusBadge({ status, testID }: { status: string; testID?: string }) {
  const cfg = STATUS_COLORS[status] || { bg: COLORS.border, fg: COLORS.textSecondary, label: status };
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text numberOfLines={1} style={[styles.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}
export function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_COLORS[severity] || { bg: COLORS.border, fg: COLORS.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.fg }]}>{severity}</Text>
    </View>
  );
}

// ---------- Input ----------
type InputProps = React.ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string | null;
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
};
export function Input({ label, error, testID, containerStyle, style, ...rest }: InputProps) {
  return (
    <View style={[{ marginBottom: SPACING.md }, containerStyle]}>
      {label ? <Text style={[TYPO.caption, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={COLORS.textTertiary}
        style={[styles.input, error ? { borderColor: COLORS.danger } : null, style]}
        {...rest}
      />
      {error ? <Text style={[TYPO.body, { color: COLORS.danger, marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

// ---------- KPI ----------
export function KpiCard({ label, value, icon, color, testID }: { label: string; value: string | number; icon?: keyof typeof any; color?: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.kpi}>
      <View style={styles.kpiRow}>
        <Text style={[TYPO.caption, { fontSize: 11 }]} numberOfLines={1}>{label}</Text>
        {icon ? <Icon name={icon} size={14} color={color || COLORS.textTertiary} /> : null}
      </View>
      <Text style={[TYPO.h1, { marginTop: 6, color: color || COLORS.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------- Skeleton ----------
export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const op = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.5, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [op]);
  return <Animated.View style={[styles.skeleton, { height, opacity: op }, style]} />;
}

// ---------- Empty State ----------
export function EmptyState({
  icon = 'cube-outline', title, subtitle, action, testID,
}: { icon?: keyof typeof any; title: string; subtitle?: string; action?: { label: string; onPress: () => void }; testID?: string }) {
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={32} color={COLORS.textTertiary} />
      </View>
      <Text style={[TYPO.h3, { marginTop: SPACING.lg, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? <Text style={[TYPO.body, { color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }]}>{subtitle}</Text> : null}
      {action ? (
        <View style={{ marginTop: SPACING.lg, width: '100%', maxWidth: 240 }}>
          <Button title={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

// ---------- Section header ----------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={TYPO.caption}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={[TYPO.bodyMedium, { color: COLORS.textPrimary, textDecorationLine: 'underline' }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------- Progress bar ----------
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  let auto = COLORS.success;
  if (pct >= 100) auto = COLORS.danger;
  else if (pct >= 80) auto = COLORS.warning;
  const c = color || auto;
  return (
    <View style={styles.progressOuter}>
      <View style={[styles.progressInner, { width: `${pct}%`, backgroundColor: c }]} />
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const initials = (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: COLORS.textInverse, fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

// ---------- Header Bar ----------
export function HeaderBar({ title, onBack, right, testID }: { title: string; onBack?: () => void; right?: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.headerBar}>
      <View style={{ width: 44 }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            testID="back-btn"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={{ width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' }}
          >
            <Icon name="chevron-back" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={[TYPO.h3, { flex: 1, textAlign: 'center', paddingHorizontal: 4 }]}>{title}</Text>
      <View style={{ minWidth: 44, maxWidth: '40%', alignItems: 'flex-end', flexShrink: 0 }}>{right}</View>
    </View>
  );
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({
  options, value, onChange, testID,
}: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <View testID={testID} style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              safeSelection();
              onChange(o.key);
            }}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[TYPO.bodyMedium, { color: active ? COLORS.textPrimary : COLORS.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- FAB ----------
export function FAB({ onPress, icon = 'add', testID }: { onPress: () => void; icon?: keyof typeof any; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      onPress={() => {
        safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={styles.fab}
    >
      <Icon name={icon} size={26} color={COLORS.textInverse} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.lg,
  },
  badge: {
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.sm, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  input: {
    height: 48, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, fontSize: 16, color: COLORS.textPrimary,
  },
  kpi: {
    flex: 1, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.lg, minHeight: 84,
  },
  kpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skeleton: {
    backgroundColor: '#E9E9E5', borderRadius: RADIUS.md, width: '100%',
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  progressOuter: {
    height: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.border, overflow: 'hidden',
  },
  progressInner: { height: 6, borderRadius: RADIUS.pill },
  avatar: {
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg, height: 56, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  segmented: {
    flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 4,
  },
  segItem: {
    flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm,
  },
  segItemActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
