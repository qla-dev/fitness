import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useIsFocusedWhenNavigable } from '../hooks/useIsFocusedWhenNavigable';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A small ring that fills to a fraction, drawn in SVG.
 *
 * Deliberately not [`ProgressRing`], which is the same picture in Skia. That
 * one allocates a native surface per canvas, which is affordable for the one
 * or two rings a card usually carries but not for the Tracker's nutrient
 * strip: sixteen of them took the screen from five canvases to eighteen, and
 * the whole card arrived about a second late. These are ordinary native views,
 * so the strip is on screen with its tracks drawn before anything animates.
 *
 * Animated through the dash offset rather than the dash array, for the same
 * reason the Activities rings are: the offset is one number, so it
 * interpolates on the UI thread instead of rebuilding a string every frame.
 */
export default function MacroRingGauge({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
}: {
  size: number;
  strokeWidth: number;
  /** 0-1; anything outside that is clamped for display. */
  progress: number;
  color: string;
  trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const length = 2 * Math.PI * radius;
  const capped = Math.min(Math.max(progress, 0), 1);

  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(length);

  // One effect, because React's compiler cannot optimize a shared value
  // written from two. `wasFocused` separates a fresh visit — which rewinds to
  // empty first — from the value changing while the screen is already up,
  // which animates from wherever the ring already stands.
  const isFocused = useIsFocusedWhenNavigable();
  const wasFocused = useRef(false);
  useEffect(() => {
    if (!isFocused) {
      wasFocused.current = false;
      return;
    }
    const justFocused = !wasFocused.current;
    wasFocused.current = true;
    const target = length * (1 - capped);
    // Reduced motion never replays: the point of the setting is to arrive at
    // the answer without the journey.
    if (reducedMotion) {
      offset.value = target;
      return;
    }
    if (justFocused) {
      offset.value = length;
    }
    offset.value = withTiming(target, { duration: 500 });
  }, [isFocused, length, capped, reducedMotion, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={length}
        animatedProps={animatedProps}
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    </Svg>
  );
}
