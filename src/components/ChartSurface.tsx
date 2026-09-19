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
    <View className={bare ? 'px-1 my-2' : 'bg-surface rounded-xl p-4 my-2'}>
      {children}
    </View>
  );
}
