import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * What a trend chart sits on.
 *
 * Boxed on the dashboard, where a chart is one card among many and needs an
 * edge to tell it from its neighbours. Bare on a detail screen, where the
 * chart is the whole point of the page — a card there draws a box around the
 * only thing on screen, and nests inside the screen's own padding for no
 * reason.
 *
 * One component rather than the same two class lists in four charts, which is
 * how they drifted into being a card in the first place.
 */
export default function ChartSurface({
  bare = false,
  children,
}: {
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    // Bare carries no padding of its own: the screens that use it already pad
    // their body, the 4px it used to add horizontally put the plot a hair
    // inside whatever sat above it, and the vertical margin opened a gap under
    // the figure the chart belongs to. Boxed keeps both, because there it is
    // one card among several and needs the separation.
    <View className={bare ? '' : 'bg-surface rounded-xl p-4 my-2'}>
      {children}
    </View>
  );
}
