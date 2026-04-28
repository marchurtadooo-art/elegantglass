import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../src/theme';
import { Button } from '../src/ui';
import { FadeInUp } from '../src/animations';
import { useAuth } from '../src/auth';
import { prefs } from '../src/prefs';

type Slide = { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; bullets?: string[]; tone?: 'dark' | 'light' };

const ADMIN_SLIDES: Slide[] = [
  {
    icon: 'sparkles-outline',
    title: 'Bienvenido a GLASSWORK',
    description: 'Gestiona tu carpintería de aluminio y vidrio desde una sola app: obras, partes, fotos, materiales y reportes.',
    tone: 'dark',
  },
  {
    icon: 'briefcase-outline',
    title: 'Tus obras, controladas',
    description: 'Crea proyectos en 4 pasos con presupuesto y operarios asignados. Ve avance, gasto y balance en tiempo real.',
    bullets: ['Estados color-coded (activo, pausado, completado)', 'Gráficas de gasto por obra', 'Aprobación de partes con un toque'],
  },
  {
    icon: 'people-outline',
    title: 'Operarios al campo',
    description: 'Tus operarios envían parte diario, fotos y materiales desde el móvil. Tú apruebas, ellos no ven números financieros.',
    bullets: ['Subida con cámara o galería', 'Catálogo de 50+ materiales reales', 'Alertas automáticas de incidentes'],
  },
  {
    icon: 'document-text-outline',
    title: 'Reportes profesionales',
    description: 'Genera PDF y Excel semanales con un toque. Datos listos para compartir con clientes y contabilidad.',
    bullets: ['PDF maquetado con KPIs', 'Excel con 4 hojas', 'Exportar todo (GDPR)'],
  },
];

const WORKER_SLIDES: Slide[] = [
  {
    icon: 'sparkles-outline',
    title: 'Bienvenido a GLASSWORK',
    description: 'Tu app diaria para gestionar la jornada en obra: parte diario, fotos y materiales sin papeleo.',
    tone: 'dark',
  },
  {
    icon: 'clipboard-outline',
    title: 'Tu parte en 30 segundos',
    description: 'Selecciona la obra, marca horas, describe la actividad, sube fotos. Listo. Tu jefe lo aprueba en remoto.',
    bullets: ['Stepper de horas con incrementos de 0,5h', 'Selector visual de meteorología', 'Reporta incidentes al instante'],
  },
  {
    icon: 'camera-outline',
    title: 'Documenta el avance',
    description: 'Fotos clasificadas (Antes, Avance, Después, Incidente, Material, Medida) con compresión automática.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Tu privacidad',
    description: 'Como operario nunca verás presupuestos, costes ni datos financieros. Tu acceso está limitado a tu trabajo del día.',
  },
];

const { width } = Dimensions.get('window');

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWorker = user?.role === 'WORKER';
  const slides = isWorker ? WORKER_SLIDES : ADMIN_SLIDES;
  const ref = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const goNext = async () => {
    if (index < slides.length - 1) {
      ref.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      if (user?.id) await prefs.setBool(`onboarding_${user.id}`, true);
      if (isWorker) router.replace('/(worker)/home');
      else router.replace('/(manager)/dashboard');
    }
  };

  const skip = async () => {
    if (user?.id) await prefs.setBool(`onboarding_${user.id}`, true);
    if (isWorker) router.replace('/(worker)/home');
    else router.replace('/(manager)/dashboard');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>GLASSWORK</Text>
        <TouchableOpacity onPress={skip} testID="onboarding-skip"><Text style={styles.skip}>Saltar</Text></TouchableOpacity>
      </View>
      <FlatList
        ref={ref}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => <SlideView slide={item} active={i === index} />}
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          title={index === slides.length - 1 ? '¡Empezar!' : 'Siguiente'}
          icon={index === slides.length - 1 ? 'rocket-outline' : 'arrow-forward'}
          onPress={goNext}
          testID="onboarding-next"
        />
      </View>
    </View>
  );
}

function SlideView({ slide, active }: { slide: Slide; active: boolean }) {
  const dark = slide.tone === 'dark';
  return (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.card, dark && styles.cardDark]}>
        {active ? (
          <FadeInUp delay={120} distance={20}>
            <View style={[styles.iconWrap, dark && styles.iconWrapDark]}>
              <Ionicons name={slide.icon} size={42} color={dark ? COLORS.primary : COLORS.surface} />
            </View>
          </FadeInUp>
        ) : (
          <View style={[styles.iconWrap, dark && styles.iconWrapDark]}>
            <Ionicons name={slide.icon} size={42} color={dark ? COLORS.primary : COLORS.surface} />
          </View>
        )}
        {active ? (
          <FadeInUp delay={220} distance={16}>
            <Text style={[styles.title, dark && { color: COLORS.surface }]}>{slide.title}</Text>
          </FadeInUp>
        ) : (
          <Text style={[styles.title, dark && { color: COLORS.surface }]}>{slide.title}</Text>
        )}
        {active ? (
          <FadeInUp delay={320} distance={12}>
            <Text style={[styles.desc, dark && { color: 'rgba(255,255,255,0.85)' }]}>{slide.description}</Text>
          </FadeInUp>
        ) : (
          <Text style={[styles.desc, dark && { color: 'rgba(255,255,255,0.85)' }]}>{slide.description}</Text>
        )}
        {slide.bullets ? (
          <View style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}>
            {slide.bullets.map((b, i) => (
              active ? (
                <FadeInUp key={i} delay={420 + i * 100} distance={10}>
                  <View style={styles.bullet}>
                    <Ionicons name="checkmark-circle" size={18} color={dark ? COLORS.surface : COLORS.success} />
                    <Text style={[styles.bulletText, dark && { color: 'rgba(255,255,255,0.92)' }]}>{b}</Text>
                  </View>
                </FadeInUp>
              ) : (
                <View key={i} style={styles.bullet}>
                  <Ionicons name="checkmark-circle" size={18} color={dark ? COLORS.surface : COLORS.success} />
                  <Text style={[styles.bulletText, dark && { color: 'rgba(255,255,255,0.92)' }]}>{b}</Text>
                </View>
              )
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  brand: { fontSize: 14, fontWeight: '900', letterSpacing: 4, color: COLORS.primary },
  skip: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, padding: 8 },
  slide: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, justifyContent: 'center' },
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 22 },
});
