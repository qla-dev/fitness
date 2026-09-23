import { useEffect } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CHART_RISE_MS } from '../constants/charts';
import { useIsFocusedWhenNavigable } from './useIsFocusedWhenNavigable';

/**
 * How far a chart's series has risen out of its axis: 0 flat on the baseline,
 * 1 the data as recorded.
 *
 * Every chart on the goal screen shares this one value so the range picker
 * swaps between charts that move the same way. It is driven straight from
 * Reanimated, and the marks are scaled about the foot of the plot — see
 * `ChartRiseGroup` — rather than handed to a charting library to interpolate.
 *
 * That is the whole reason this exists in this shape. It used to commit a flat
 * copy of the series for one frame and let Victory tween the two paths, which
 * fought the library on both ends: Skia will only interpolate between paths
 * whose verbs match, so a flattened bar had to be given a sliver of height to
 * keep its rounded corners from collapsing into a plain rectangle, and a
 * flattened line had to be pinned to the bottom of its own domain so it did not
 * fly in from off-screen. Neither dodge was reliable, and a range whose data was
 * already cached came back with the same array identity and so never replayed at
 * all. Scaling the drawn group needs none of it: there is one shape throughout,
 * the library animates nothing, and the gesture is the same for bars, lines and
 * stacked blocks.
 *
 * Replayed on every focus and whenever `shapeKey` changes, so returning to a
 * range draws it again instead of revealing it already finished. `shapeKey`
 * should name the window AND what is in it — the range alone would sit still
 * while a query resolved under it.
 *
 * `hasData` holds the value at 0 while there is nothing to draw, so the rise
 * belongs to the frame the data lands on rather than to the empty state before
 * it.
 */
export function useChartRise(
  shapeKey: string,
  hasData: boolean
): SharedValue<number> {
  // Not `useIsFocused`: these charts are mounted in tests without a container,
  // and a presentational chart should not drag a navigator into one.
  const isFocused = useIsFocusedWhenNavigable();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!hasData) {
      progress.value = 0;
      return;
    }
    if (!isFocused) return;
    // Someone who has asked the system for less movement gets the chart it is
    // drawing, not a chart on its way in.
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: CHART_RISE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, hasData, reducedMotion, shapeKey, progress]);

  return progress;
}
