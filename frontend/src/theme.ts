import { Platform } from 'react-native';

export const COLORS = {
  primary: '#0A0A0A',
  background: '#F5F5F2',
  surface: '#FFFFFF',
  border: '#E5E5E5',
  borderStrong: '#D4D4D4',
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  info: '#2563EB',
  infoBg: '#DBEAFE',
  textPrimary: '#0A0A0A',
  textSecondary: '#525252',
  textTertiary: '#A3A3A3',
  textInverse: '#FFFFFF',
  overlay: 'rgba(10,10,10,0.6)',
};

export const FONTS = {
  sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }) as string,
};

export const TYPO = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38, letterSpacing: -0.5, color: COLORS.textPrimary },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.5, color: COLORS.textPrimary },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28, letterSpacing: -0.3, color: COLORS.textPrimary },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, letterSpacing: -0.2, color: COLORS.textPrimary },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, color: COLORS.textPrimary },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, color: COLORS.textPrimary },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, color: COLORS.textPrimary },
  caption: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.6, color: COLORS.textSecondary, textTransform: 'uppercase' as const },
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const RADIUS = { sm: 2, md: 4, lg: 8, pill: 999 };

export const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING:    { bg: COLORS.warningBg, fg: COLORS.warning, label: 'PENDIENTE' },
  ACTIVE:     { bg: COLORS.successBg, fg: COLORS.success, label: 'ACTIVO' },
  PAUSED:     { bg: COLORS.infoBg,    fg: COLORS.info,    label: 'PAUSADO' },
  COMPLETED:  { bg: '#E5E5E5',        fg: COLORS.textSecondary, label: 'COMPLETADO' },
  CANCELLED:  { bg: COLORS.dangerBg,  fg: COLORS.danger,  label: 'CANCELADO' },
  APPROVED:   { bg: COLORS.successBg, fg: COLORS.success, label: 'APROBADO' },
  REJECTED:   { bg: COLORS.dangerBg,  fg: COLORS.danger,  label: 'RECHAZADO' },
};

export const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  INFO:     { bg: COLORS.infoBg,    fg: COLORS.info },
  WARNING:  { bg: COLORS.warningBg, fg: COLORS.warning },
  CRITICAL: { bg: COLORS.dangerBg,  fg: COLORS.danger },
};

export const WEATHER_OPTIONS = [
  { key: 'SUNNY',   label: 'Soleado',  icon: 'sunny-outline' },
  { key: 'CLOUDY',  label: 'Nublado',  icon: 'cloud-outline' },
  { key: 'RAINY',   label: 'Lluvia',   icon: 'rainy-outline' },
  { key: 'WINDY',   label: 'Viento',   icon: 'flag-outline' },
  { key: 'STOPPED_BY_WEATHER', label: 'Parado', icon: 'thunderstorm-outline' },
] as const;

export const PHOTO_TYPES = [
  { key: 'PROGRESS',    label: 'Avance' },
  { key: 'BEFORE',      label: 'Antes' },
  { key: 'AFTER',       label: 'Después' },
  { key: 'INCIDENT',    label: 'Incidente' },
  { key: 'MATERIAL',    label: 'Material' },
  { key: 'MEASUREMENT', label: 'Medida' },
] as const;

export const ENTRY_TYPES = [
  { key: 'PURCHASE', label: 'Compra' },
  { key: 'USAGE',    label: 'Uso' },
  { key: 'RETURN',   label: 'Devolución' },
] as const;

export const MAT_CATEGORIES = [
  { key: 'PERFILERIA',    label: 'Perfilería' },
  { key: 'VIDRIO',        label: 'Vidrio' },
  { key: 'HERRAJES',      label: 'Herrajes' },
  { key: 'SELLANTES',     label: 'Sellantes' },
  { key: 'HERRAMIENTAS',  label: 'Herramientas' },
  { key: 'CONSUMIBLES',   label: 'Consumibles' },
  { key: 'OTROS',         label: 'Otros' },
] as const;
