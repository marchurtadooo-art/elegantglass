import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/Icon';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button } from '../src/ui';
import { useAuth } from '../src/auth';
import { prefs } from '../src/prefs';

type Slide = {
  icon: keyof typeof any;
  title: string;
  description: string;
  bullets?: string[];
  tone?: 'dark' | 'light';
};

const ADMIN_SLIDES: Slide[] = [
  {
    icon: 'sparkles-outline',
    title: 'Bienvenido a GLASSWORK',
    description:
      'Gestiona tu carpintería de aluminio y vidrio desde una sola app: obras, partes, fotos, materiales y reportes.',
    tone: 'dark',
  },
  {
    icon: 'briefcase-outline',
    title: 'Tus obras, controladas',
    description:
      'Crea proyectos en 4 pasos con presupuesto y operarios asignados. Ve avance, gasto y balance en tiempo real.',
    bullets: [
      'Estados color-coded (activo, pausado, completado)',
      'Gráficas de gasto por obra',
      'Aprobación de partes con un toque',
    ],
  },
  {
    icon: 'people-outline',
    title: 'Operarios al campo',
    description:
      'Tus operarios envían parte diario, fotos y materiales desde el móvil. Tú apruebas, ellos no ven números financieros.',
    bullets: [
      'Subida con cámara o galería',
      'Catálogo de 50+ materiales reales',
      'Alertas automáticas de incidentes',
    ],
  },
  {
    icon: 'cube-outline',
    title: 'Almacén con QR',
    description:
      'Lotes con códigos QR propios, zonas, movimientos y stock bajo. Pistola lectora compatible.',
    bullets: ['Etiquetado térmico (cuando conectes la impresora)', 'Trazabilidad por proyecto', 'Inventario en tiempo real'],
  },
  {
    icon: 'document-text-outline',
    title: 'Reportes para cliente',
    description:
      'Genera un PDF premium por cada obra finalizada para enviar al cliente con un toque profesional.',
    bullets: ['Portada con logo y cliente', 'Galería fotográfica antes/después', 'Firma digital del responsable'],
  },
];

const WORKER_SLIDES: Slide[] = [
  {
    icon: 'sparkles-outline',
    title: 'Bienvenido a GLASSWORK',
    description:
      'Tu app diaria para gestionar la jornada en obra: parte diario, fotos y materiales sin papeleo.',
    tone: 'dark',
  },
  {
    icon: 'clipboard-outline',
    title: 'Tu parte en 30 segundos',
    description:
      'Selecciona la obra, marca horas, describe la actividad, sube fotos. Listo. Tu jefe lo aprueba en remoto.',
    bullets: [
      'Stepper de horas con incrementos de 0,5h',
      'Selector visual de meteorología',
      'Reporta incidentes al instante',
    ],
  },
  {
    icon: 'camera-outline',
    title: 'Documenta el avance',
    description:
      'Fotos clasificadas (Antes, Avance, Después, Incidente, Material, Medida) con compresión automática.',
  },
  {
    icon: 'qr-code-outline',
    title: 'Escanea materiales',
    description:
      'Usa el botón QR flotante en cualquier pantalla para escanear lotes del almacén y registrar consumos al instante.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Tu privacidad',
    description:
      'Como operario nunca verás presupuestos, costes ni datos financieros. Tu acceso está limitado a tu trabajo del día.',
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';
  const slides = isWorker ? WORKER_SLIDES : ADMIN_SLIDES;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  // Animate fade on slide change
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [index, fade]);

  const finish = async () => {
    if (user?.id) {
      try { await prefs.setBool(`onboarding_${user.id}`, true); } catch {}
    }
    if (isWorker) router.replace('/(worker)/home');
    else router.replace('/(manager)/dashboard');
  };

  const goNext = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (isLast) { finish(); return; }
    setIndex(i => Math.min(i + 1, slides.length - 1));
  };

  const goPrev = () => {
    if (index === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setIndex(i => Math.max(0, i - 1));
  };

  const goTo = (i: number) => {
    if (i === index) return;
    setIndex(i);
  };

  const dark = slide.tone === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>GLASSWORK</Text>
        <TouchableOpacity onPress={finish} testID="onboarding-skip" hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Text style={styles.skip}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: SPACING.lg, justifyContent: 'center' }}>
        <Animated.View style={[styles.card, dark && styles.cardDark, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={[styles.iconWrap, dark && styles.iconWrapDark]}>
            <Icon name={slide.icon} size={42} color={dark ? COLORS.primary : COLORS.surface} />
          </View>
          <Text style={[styles.title, dark && { color: COLORS.surface }]}>{slide.title}</Text>
          <Text style={[styles.desc, dark && { color: 'rgba(255,255,255,0.85)' }]}>{slide.description}</Text>
          {slide.bullets ? (
            <View style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}>
              {slide.bullets.map((b, i) => (
                <View key={i} style={styles.bullet}>
                  <Icon name="checkmark-circle" size={18} color={dark ? COLORS.surface : COLORS.success} />
                  <Text style={[styles.bulletText, dark && { color: 'rgba(255,255,255,0.92)' }]}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}>
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          {index > 0 ? (
            <TouchableOpacity onPress={goPrev} style={styles.backBtn} testID="onboarding-prev">
              <Icon name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title={isLast ? '¡Empezar!' : 'Siguiente'}
              icon={isLast ? 'rocket-outline' : 'arrow-forward'}
              onPress={goNext}
              testID="onboarding-next"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  brand: { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: COLORS.primary },
  skip: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, padding: 8 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.xl, alignItems: 'center', minHeight: 480,
  },
  cardDark: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
    marginTop: SPACING.lg,
  },
  iconWrapDark: { backgroundColor: COLORS.surface, borderColor: COLORS.surface },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: COLORS.primary, marginTop: SPACING.xl, letterSpacing: -0.4 },
  desc: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.md, paddingHorizontal: SPACING.md },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  bulletText: { marginLeft: 10, fontSize: 14, color: COLORS.textPrimary, flex: 1, lineHeight: 20 },
  bottom: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, backgroundColor: COLORS.background },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 22 },
  backBtn: {
    width: 48, height: 48, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
});
