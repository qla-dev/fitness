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
 * both are worth redrawing. A parent that rebuilt the array on every render
 * would animate forever, which is why every caller memoizes it.
 *
 * `flatten` decides what "flat" means, because it is not always zero: a bar
 * chart's floor is the axis, but a weight line lives in a domain that starts
 * near the reading, and dropping it to zero would send it below the plot and
 * fly it back in from off-screen.
 */
export function useChartRise<T>(data: T[], flatten: (point: T) => T): T[] {
  const reducedMotion = useReducedMotion();
  const [risen, setRisen] = useState(false);
  // The dataset the current animation belongs to. Compared during render so
  // the flat frame IS the first render of the new data, rather than a second
  // render that arrives after the full-height one has already been drawn.
  const [source, setSource] = useState(data);
  if (source !== data) {
    setSource(data);
    setRisen(false);
  }

  useEffect(() => {
    if (risen) return;
    const frame = requestAnimationFrame(() => setRisen(true));
    return () => cancelAnimationFrame(frame);
  }, [risen]);

  const flat = useMemo(() => data.map(flatten), [data, flatten]);

  // Someone who has asked the system for less movement gets the chart it is
  // drawing, not a chart on its way in. The same answer `ActivityMetricChart`
  // gives its hourly bars.
  if (reducedMotion) return data;

  return risen ? data : flat;
}
