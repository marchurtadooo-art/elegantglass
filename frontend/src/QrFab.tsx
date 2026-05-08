import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from './theme';

/**
 * Floating QR scan button — always visible above the tab bar.
 * Tapping it opens the warehouse QR scanner from anywhere in the app.
 * Hidden automatically while the user is already inside the scanner screen
 * to avoid overlapping the camera preview.
 */
export default function QrFab() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname() || '';
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
      delay: 250,
    }).start();
  }, [scale]);

  // Hide the FAB while inside the scanner screen itself
  if (pathname.includes('/warehouse/scan')) return null;

  const onPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push('/warehouse/scan');
  };

  // Bottom offset: tab bar height (64) + safe area + a small gap
  const bottom = 64 + Math.max(insets.bottom, 8) + 12;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Escanear código QR"
          testID="qr-fab"
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
        >
          <Icon name="qr-code" size={26} color={COLORS.surface} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    alignItems: 'flex-start',
    zIndex: 999,
    elevation: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
