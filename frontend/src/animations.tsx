import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';

/** Fade-in + translateY entrance. Stagger via `delay`. */
export function FadeInUp({
  children, delay = 0, distance = 16, duration = 360, style,
}: { children: React.ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // run once
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

/** Stagger any list of children by mapping each into FadeInUp with incremental delay. */
export function Stagger({ children, baseDelay = 0, step = 60, distance, style }: { children: React.ReactNode; baseDelay?: number; step?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const arr = React.Children.toArray(children);
  return (
    <View style={style}>
      {arr.map((child, i) => (
        <FadeInUp key={i} delay={baseDelay + i * step} distance={distance}>{child}</FadeInUp>
      ))}
    </View>
  );
}

/** Pressable with subtle scale-down on press. Wraps content. */
export function PressScale({
  onPress, children, style, scaleTo = 0.97, disabled, testID,
}: { onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number; disabled?: boolean; testID?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
      onPress={onPress}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Number count-up animation (cubic ease-out). */
export function CountUp({
  value, duration = 700, format, style,
}: { value: number; duration?: number; format?: (n: number) => string; style?: StyleProp<TextStyle> }) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    const from = previous.current;
    const start = Date.now();
    let raf: any;
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (value - from) * eased;
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
      else previous.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{format ? format(display) : Math.round(display).toString()}</Text>;
}
