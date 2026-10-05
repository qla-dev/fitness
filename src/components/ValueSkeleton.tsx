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
  radius,
}: {
  width?: DimensionValue;
  height?: number;
  /** A block rather than a line of text, e.g. an image's place. */
  radius?: number;
}) {
  const textMuted = useCSSVariable('--color-text-muted') as string;
  return (
    <View
      testID="value-skeleton"
      className={radius === undefined ? 'rounded-full' : undefined}
      style={{
        width,
        height,
        ...(radius === undefined ? null : { borderRadius: radius }),
        backgroundColor: textMuted,
        opacity: 0.16,
      }}
    />
  );
}
