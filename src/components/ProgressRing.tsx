import React, { useEffect, useMemo, useRef } from 'react';
import {
  Canvas,
  Path,
  Circle as SkiaCircle,
  Skia,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { NavigationContext, useIsFocused } from '@react-navigation/native';

/**
 * Whether the screen holding this ring is showing, or `true` where there is no
 * navigator to ask.
 *
 * `useIsFocused` throws outside a navigation container, which turned this
 * presentational ring into something a caller could only render inside one —
 * and a card that draws a ring should not drag a NavigationContainer into
 * every test that mounts it. Nothing is on top of a ring with no navigator
 * above it, so "focused" is the honest answer.
 */
function useIsFocusedWhenNavigable(): boolean {
  const navigable = React.useContext(NavigationContext) != null;
  // Both hooks run on every render: the context decides which answer is used,
  // never whether a hook is called.
  const focused = useIsFocusedSafely(navigable);
  return navigable ? focused : true;
}

/** `useIsFocused`, but only consulted where a navigator exists to consult. */
function useIsFocusedSafely(navigable: boolean): boolean {
  try {
    return useIsFocused();
  } catch {
    return !navigable;
  }
}

/** Where an arc starts and how far it runs, in Skia's degrees (0 = 3 o'clock). */
const SWEEPS = {
  full: { start: -90, total: 360 },
  // The top half, opening downwards, so the figure it measures can sit in the
  // gap rather than being ringed by it.
  half: { start: 180, total: 180 },
} as const;

export type ProgressArc = keyof typeof SWEEPS;

/** Canvas height for an arc of this shape — a half arc needs only its band. */
export const progressArcHeight = (
  size: number,
  strokeWidth: number,
  arc: ProgressArc = 'full'
) => (arc === 'half' ? size / 2 + strokeWidth : size);

interface ProgressRingProps {
  progress: number; // 0-1 value (capped at 1 for display)
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor: string;
  /** A closed ring, or the top half of one. */
  arc?: ProgressArc;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor,
  arc = 'full',
}) => {
  const { start, total } = SWEEPS[arc];
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const progressCapped = Math.min(Math.max(progress, 0), 1);

  const animatedProgress = useSharedValue(0);

  // Replay the 0 -> current entrance animation each time the screen regains
  // focus, then smoothly follow later progress changes (e.g. a per-second timer
  // tick) without resetting to zero. Both writes to `animatedProgress` live in
  // a single effect (React's compiler can't optimize a shared value mutated
  // across two effects); `wasFocused` distinguishes a fresh focus — which resets
  // to zero first — from an in-place value change.
  const isFocused = useIsFocusedWhenNavigable();
  const wasFocused = useRef(false);
  useEffect(() => {
    // Skip animating while blurred so a mounted-but-hidden ring (e.g. the
    // fasting/calorie ring on the Dashboard while another screen is on top)
    // doesn't schedule frames for a per-second progress tick no one can see.
    if (!isFocused) {
      wasFocused.current = false;
      return;
    }
    const justFocused = !wasFocused.current;
    wasFocused.current = true;
    if (justFocused) {
      animatedProgress.value = 0;
    }
    animatedProgress.value = withTiming(progressCapped, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progressCapped, animatedProgress]);

  const oval = useMemo(
    () => ({
      x: center - radius,
      y: center - radius,
      width: radius * 2,
      height: radius * 2,
    }),
    [center, radius]
  );

  const progressPath = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const sweepAngle = animatedProgress.value * total;
    if (sweepAngle > 0) {
      builder.addArc(oval, start, sweepAngle);
    }
    return builder.build();
  });

  // A closed ring's track is a circle; a half arc's has to be a path, or the
  // unfilled remainder runs all the way round behind the gap.
  const trackPath = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    builder.addArc(oval, start, total);
    return builder.build();
  }, [oval, start, total]);

  return (
    <Canvas
      style={{ width: size, height: progressArcHeight(size, strokeWidth, arc) }}
    >
      {arc === 'full' ? (
        <SkiaCircle
          cx={center}
          cy={center}
          r={radius}
          style="stroke"
          strokeWidth={strokeWidth}
          color={backgroundColor}
        />
      ) : (
        <Path
          path={trackPath}
          style="stroke"
          strokeWidth={strokeWidth}
          color={backgroundColor}
          strokeCap="round"
        />
      )}
      <Path
        path={progressPath}
        style="stroke"
        strokeWidth={strokeWidth}
        color={color}
        strokeCap="round"
      />
    </Canvas>
  );
};

export default ProgressRing;
