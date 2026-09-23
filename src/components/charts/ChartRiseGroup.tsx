import type { ReactNode } from 'react';
import { Group } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Draws its marks growing up out of the plot's baseline.
 *
 * The group is scaled about `baseline` rather than each mark being animated
 * individually, which is what lets one gesture cover bars, a line and the sleep
 * chart's stacked blocks without any of them knowing about it. Victory clips
 * its children to the plot rect, so nothing can escape the axes on the way up.
 *
 * Its own component because `useDerivedValue` is a hook and the caller only
 * learns the baseline inside `CartesianChart`'s render prop, which is a
 * callback rather than a component and so cannot hold hooks of its own.
 */
export default function ChartRiseGroup({
  progress,
  baseline,
  children,
}: {
  /** 0 flat on the baseline, 1 at full height. See `useChartRise`. */
  progress: SharedValue<number>;
  /** The y the marks stand on — the foot of the plot, in canvas coordinates. */
  baseline: number;
  children: ReactNode;
}) {
  const transform = useDerivedValue(
    () => [
      { translateY: baseline },
      { scaleY: progress.value },
      { translateY: -baseline },
    ],
    [baseline, progress]
  );

  return <Group transform={transform}>{children}</Group>;
}
