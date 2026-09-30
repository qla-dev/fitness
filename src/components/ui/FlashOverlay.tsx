import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import { fireSuccessHaptic } from '../../services/haptics';

const IN_MS = 260;
const OUT_MS = 220;

/**
 * A full-screen flash for a result worth a moment — a number just worked
 * out, a step just finished — over everything, the native header included,
 * which is why it is its own transparent Modal rather than a view in the
 * screen. The body is the watch-connection visual: an icon inside a halo
 * that keeps pulsing outwards. It fades in on the theme's background, holds
 * for `duration`, fades out and calls `onDone`; a tap ends it early.
 */
export default function FlashOverlay({
  visible,
  icon,
  eyebrow,
  value,
  title,
  caption,
  tint,
  duration = 2600,
  onDone,
}: {
  visible: boolean;
  icon: IconName;
  /** The small line above the value: what was worked out. */
  eyebrow?: string;
  /** The result itself, set large. */
  value: string;
  title?: string;
  caption?: string;
  /** The halo and icon colour; the accent by default. */
  tint?: string;
  duration?: number;
  onDone: () => void;
}) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  const color = tint ?? accent;
  const reducedMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const pulse = useSharedValue(0);
  // Kept mounted through the fade-out, after `visible` has gone false.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const doneRef = useRef(onDone);
  const ending = useRef(false);

  const finish = () => {
    setMounted(false);
    doneRef.current();
  };
  const end = () => {
    if (ending.current) return;
    ending.current = true;
    shown.set(
      withTiming(0, { duration: OUT_MS }, (finished) => {
        if (finished) runOnJS(finish)();
      })
    );
  };
  const endRef = useRef(end);
  useEffect(() => {
    doneRef.current = onDone;
    endRef.current = end;
  });

  useEffect(() => {
    if (!visible) return;
    ending.current = false;
    fireSuccessHaptic();
    shown.set(
      withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.cubic) })
    );
    pulse.set(
      reducedMotion
        ? 0
        : withRepeat(withTiming(1, { duration: 1400 }), -1, false)
    );
    const timer = setTimeout(() => endRef.current(), duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(pulse);
    };
  }, [visible, duration, reducedMotion, shown, pulse]);

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.value }));
  const body = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.92 + shown.value * 0.08 }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.65 }],
  }));

  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={end}
    >
      <Animated.View className="flex-1 bg-background" style={backdrop}>
        <Pressable
          className="flex-1 items-center justify-center px-8"
          onPress={end}
          accessibilityRole="button"
          accessibilityLabel={[eyebrow, value, title, caption]
            .filter(Boolean)
            .join(', ')}
        >
          <Animated.View className="items-center" style={body}>
            <View
              style={{
                width: 132,
                height: 132,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 28,
              }}
            >
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 112,
                    height: 112,
                    borderRadius: 56,
                    borderWidth: 2,
                    borderColor: color,
                  },
                  halo,
                ]}
              />
              <Icon name={icon} size={64} color={color} />
            </View>
            {eyebrow ? (
              <Text className="text-text-secondary text-base font-semibold uppercase mb-2">
                {eyebrow}
              </Text>
            ) : null}
            <Text
              accessibilityLiveRegion="polite"
              className="text-text-primary font-bold"
              style={{ fontSize: 64, fontVariant: ['tabular-nums'] }}
            >
              {value}
            </Text>
            {title ? (
              <Text
                className="text-2xl font-bold mt-1 text-center"
                style={{ color }}
              >
                {title}
              </Text>
            ) : null}
            {caption ? (
              <Text className="text-text-secondary text-base text-center mt-4">
                {caption}
              </Text>
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
