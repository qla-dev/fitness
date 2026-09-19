import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useIsFocusedWhenNavigable } from '../hooks/useIsFocusedWhenNavigable';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The height an arc of this width needs: its top band, and the half-stroke
 * that hangs below the ends.
 *
 * The extra full stroke rather than half is deliberate slack, so a cap never
 * clips against the bottom of the view.
 */
export const arcGaugeHeight = (size: number, strokeWidth: number) =>
  size / 2 + strokeWidth;

/**
 * A dome that fills left to right — the top half of a ring, opening downward
 * so the figure it measures can sit in the gap rather than being circled by it.
 *
 * SVG rather than Skia for the same reason [`MacroRingGauge`] is: a Skia
 * canvas allocates a native surface, and these two arcs mounted visibly later
 * than the rest of the card — the inner one later than the outer, because they
 * initialise in tree order. As native views they are simply there.
 */
export default function ArcGauge({
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
  const centre = size / 2;
  // Half a circumference: the path runs from the left end over the top to the
  // right, which is the whole of what this gauge draws.
  const length = Math.PI * radius;
  const capped = Math.min(Math.max(progress, 0), 1);
  const d = `M ${centre - radius} ${centre} A ${radius} ${radius} 0 0 1 ${centre + radius} ${centre}`;

  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(length);

  // One effect, because React's compiler cannot optimize a shared value
  // written from two. `wasFocused` separates a fresh visit — which rewinds to
  // empty first — from the value changing while the screen is already up.
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
    <Svg width={size} height={arcGaugeHeight(size, strokeWidth)}>
      <Path
        d={d}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <AnimatedPath
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={length}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
