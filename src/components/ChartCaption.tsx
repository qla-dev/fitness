import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * The single line every chart reserves directly above its plot.
 *
 * Its job is to be the same height whether or not it has anything in it. Most
 * charts fill it with a tooltip that only exists while a bar is held, so a slot
 * that collapsed when empty would make the plot jump up and down under the
 * finger. The hourly chart has no tooltip at all and reserves it empty, which
 * is the other half of the same idea: the range picker swaps one chart for
 * another in this slot, and the plot's top edge has to land in the same place
 * each time or the whole page shifts when you tap D.
 *
 * A component rather than the same class list in four files, which is exactly
 * how those four drifted to 32, 40 and 44 points apart from each other.
 */
export default function ChartCaption({ children }: { children?: ReactNode }) {
  return <View className="h-6 justify-center my-1">{children}</View>;
}
