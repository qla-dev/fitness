import { View, type DimensionValue } from 'react-native';
import { useCSSVariable } from 'uniwind';

/**
 * A placeholder for one unresolved number.
 *
 * Only values are ever skeletoned on Home: the card titles, icons, labels and
 * ring tracks are the same whether or not the day has loaded, so replacing
 * them made the whole screen flash on every open. This stands in for the digits
 * alone, at the height of the text it replaces, so nothing shifts when the
 * number arrives.
 */
export default function ValueSkeleton({
  width = 64,
  height = 20,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const textMuted = useCSSVariable('--color-text-muted') as string;
  return (
    <View
      testID="value-skeleton"
      className="rounded-full"
      style={{
        width,
        height,
        backgroundColor: textMuted,
        opacity: 0.16,
      }}
    />
  );
}
