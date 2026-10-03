import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import { fireSuccessHaptic } from '../../services/haptics';

const IN_MS = 260;
const OUT_MS = 220;
/** How far above the true centre the body sits. */
const OPTICAL_LIFT = 40;
const BADGE = 112;
/** Each block of the body lands this long after the one above it. */
const STAGGER_MS = 90;
const MARKER = 18;

/**
 * Where a value falls on a banded scale: a BMI against its categories.
 * Segments are drawn in proportion to `weight`; `position` is 0–1 along the
 * whole bar, and the marker slides there as the flash comes in.
 */
export interface FlashMeter {
  position: number;
  segments: { weight: number; color: string }[];
  /** Boundary labels, `at` on the same 0–1 scale as `position`. */
  ticks?: { at: number; label: string }[];
}

/** One figure in the tile row under the value. */
export interface FlashStat {
  key: string;
  label: string;
  value: string;
  color: string;
  icon: IconName;
}

/**
 * A full-screen flash for a result worth a moment — a number just worked
 * out, a step just finished — over everything, the native header included,
 * which is why it is its own transparent Modal rather than a view in the
 * screen. An icon in a tinted badge with halos pulsing out of it, then the
 * value, and optionally where it falls on a scale or what it breaks down
 * into. It fades in on the theme's background, holds for `duration`, fades
 * out and calls `onDone`; a tap ends it early.
 */
export default function FlashOverlay({
  visible,
  icon,
  eyebrow,
  value,
  title,
  caption,
  tint,
  meter,
  stats,
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
  /** The badge, halo and title colour; the accent by default. */
  tint?: string;
  meter?: FlashMeter;
  stats?: FlashStat[];
  duration?: number;
  onDone: () => void;
}) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  const color = tint ?? accent;
  const reducedMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const pulse = useSharedValue(0);
  const marker = useSharedValue(0);
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

  const target = meter ? Math.min(1, Math.max(0, meter.position)) : 0;
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
        : withRepeat(withTiming(1, { duration: 1800 }), -1, false)
    );
    marker.set(0);
    marker.set(
      reducedMotion
        ? target
        : withDelay(
            IN_MS + STAGGER_MS * 3,
            withTiming(target, {
              duration: 700,
              easing: Easing.out(Easing.cubic),
            })
          )
    );
    const timer = setTimeout(() => endRef.current(), duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(pulse);
    };
  }, [visible, duration, reducedMotion, shown, pulse, marker, target]);

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.value }));
  const body = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.94 + shown.value * 0.06 }],
  }));
  // Two halos half a beat apart, so one is always on its way out.
  const haloAt = (phase: number) => {
    'worklet';
    return {
      opacity: 0.4 * (1 - phase),
      transform: [{ scale: 1 + phase * 0.55 }],
    };
  };
  const halo = useAnimatedStyle(() => haloAt(pulse.value));
  const haloLate = useAnimatedStyle(() => haloAt((pulse.value + 0.5) % 1));
  const markerStyle = useAnimatedStyle(() => ({
    left: `${marker.value * 100}%`,
  }));

  // Each block after the badge lands a beat after the one above it.
  let step = 0;
  const enter = () =>
    FadeInDown.delay(IN_MS / 2 + STAGGER_MS * step++).duration(320);

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
          // Lifted off the geometric centre: the halo pulls the eye upward
          // while the value and its lines weigh the block down, so a truly
          // centred block reads as sitting low. This puts the value, the
          // thing to look at, near the middle of the screen.
          style={{ paddingBottom: OPTICAL_LIFT * 2 }}
          onPress={end}
          accessibilityRole="button"
          accessibilityLabel={[
            eyebrow,
            value,
            title,
            ...(stats ?? []).map((stat) => `${stat.label} ${stat.value}`),
            caption,
          ]
            .filter(Boolean)
            .join(', ')}
        >
          <Animated.View className="items-center w-full" style={body}>
            <View
              style={{
                width: BADGE * 1.6,
                height: BADGE * 1.6,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              {[halo, haloLate].map((style, at) => (
                <Animated.View
                  key={at}
                  style={[
                    {
                      position: 'absolute',
                      width: BADGE,
                      height: BADGE,
                      borderRadius: BADGE / 2,
                      borderWidth: 2,
                      borderColor: color,
                    },
                    style,
                  ]}
                />
              ))}
              <View
                style={{
                  width: BADGE,
                  height: BADGE,
                  borderRadius: BADGE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* The tint at low strength, as its own layer: the colour
                    comes from a theme variable, so it cannot be given an
                    alpha by string. */}
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: color,
                    opacity: 0.14,
                  }}
                />
                <Icon name={icon} size={52} color={color} />
              </View>
            </View>
            {eyebrow ? (
              <Animated.View
                entering={enter()}
                className="rounded-full px-3 py-1 mb-3 overflow-hidden"
              >
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: color,
                    opacity: 0.12,
                  }}
                />
                <Text
                  className="text-xs font-bold uppercase"
                  style={{ color, letterSpacing: 1.5 }}
                >
                  {eyebrow}
                </Text>
              </Animated.View>
            ) : null}
            <Animated.View entering={enter()} className="items-center">
              <Text
                accessibilityLiveRegion="polite"
                className="text-text-primary font-bold"
                style={{
                  fontSize: 72,
                  lineHeight: 80,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {value}
              </Text>
              {title ? (
                <Text
                  className="text-2xl font-bold text-center"
                  style={{ color }}
                >
                  {title}
                </Text>
              ) : null}
            </Animated.View>
            {meter ? (
              <Animated.View
                entering={enter()}
                className="w-full mt-7"
                style={{ maxWidth: 300 }}
              >
                <View className="flex-row" style={{ height: 10, gap: 3 }}>
                  {meter.segments.map((segment, at) => (
                    <View
                      key={at}
                      className="rounded-full"
                      style={{
                        flex: segment.weight,
                        backgroundColor: segment.color,
                      }}
                    />
                  ))}
                </View>
                <Animated.View
                  className="absolute bg-background"
                  style={[
                    {
                      top: 5 - MARKER / 2,
                      width: MARKER,
                      height: MARKER,
                      borderRadius: MARKER / 2,
                      marginLeft: -MARKER / 2,
                      borderWidth: 4,
                      borderColor: color,
                    },
                    markerStyle,
                  ]}
                />
                <View style={{ height: 22 }}>
                  {meter.ticks?.map((tick) => (
                    <Text
                      key={tick.label}
                      className="absolute text-text-muted text-xs"
                      style={{
                        top: 8,
                        left: `${tick.at * 100}%`,
                        width: 40,
                        marginLeft: -20,
                        textAlign: 'center',
                      }}
                    >
                      {tick.label}
                    </Text>
                  ))}
                </View>
              </Animated.View>
            ) : null}
            {stats?.length ? (
              <Animated.View
                entering={enter()}
                className="flex-row w-full mt-7"
                style={{ gap: 10, maxWidth: 340 }}
              >
                {stats.map((stat) => (
                  <View
                    key={stat.key}
                    className="flex-1 items-center rounded-2xl bg-surface py-3"
                  >
                    <Icon name={stat.icon} size={20} color={stat.color} />
                    <Text
                      className="text-text-primary text-lg font-bold mt-1"
                      style={{ fontVariant: ['tabular-nums'] }}
                      numberOfLines={1}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: stat.color }}
                      numberOfLines={1}
                    >
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            ) : null}
            {caption ? (
              <Animated.View entering={enter()} className="mt-6">
                <Text className="text-text-secondary text-base text-center">
                  {caption}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
