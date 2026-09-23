import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Makes a chart's series grow out of its baseline whenever the data changes.
 *
 * Victory animates between paths, not from nothing: `useAnimatedPath` seeds the
 * path it is animating *from* with the path it is first handed, so a chart that
 * mounts — or that is handed a new range — simply appears at full height. That
 * is the right behaviour for a value ticking up in place, and the wrong one for
 * the range picker, where tapping W should feel like the week being drawn
 * rather than like a different image being swapped in.
 *
 * So the flat shape is committed for one frame and the real one the frame
 * after, and Victory's own 300ms tween does the rest. A frame rather than a
 * microtask is the whole trick: both shapes inside one commit are one path as
 * far as Skia is concerned, and nothing animates.
 *
 * Keyed on the array's identity, the same signal the tooltip reset already
 * trusts — a new range and a pull-to-refresh both hand down a new array, and
 * both are worth redrawing. A caller that rebuilds the array on every render
 * would cancel the pending frame every render and never reveal anything, so
 * the range hooks return a shared constant while they are empty rather than
 * `?? []`.
 *
 * `flatten` decides what "flat" means, because it is not always zero: a bar
 * chart's floor is the axis, but a weight line lives in a domain that starts
 * near the reading, and dropping it to zero would send it below the plot and
 * fly it back in from off-screen.
 */
export function useChartRise<T>(data: T[], flatten: (point: T) => T): T[] {
  const reducedMotion = useReducedMotion();
  // The dataset whose flat frame has already been drawn. Anything else is a
  // dataset still owed its one frame, so `risen` is derived rather than stored
  // and the two can never disagree.
  const [risenFor, setRisenFor] = useState<T[] | null>(null);
  const risen = risenFor === data;

  // `data` belongs in the dependencies, not just `risen`. Keyed on `risen`
  // alone, a dataset that arrived while the previous frame was still in flight
  // left the effect with unchanged dependencies and nothing scheduled, and the
  // chart stayed flat under a correctly scaled axis until the screen was left
  // and re-entered.
  useEffect(() => {
    if (risen) return;
    const frame = requestAnimationFrame(() => setRisenFor(data));
    return () => cancelAnimationFrame(frame);
  }, [risen, data]);

  const flat = useMemo(() => data.map(flatten), [data, flatten]);

  // Someone who has asked the system for less movement gets the chart it is
  // drawing, not a chart on its way in. The same answer `ActivityMetricChart`
  // gives its hourly bars.
  if (reducedMotion) return data;

  return risen ? data : flat;
}
