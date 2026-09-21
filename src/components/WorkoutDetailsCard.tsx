import { Pressable, Text, View } from 'react-native';
import Icon from './Icon';

/**
 * Apple's activity-ring palette, which the Activities cards already use as
 * literals. Each metric keeps the same colour everywhere it appears, so a
 * number is recognisable before it is read.
 */
export const METRIC_COLORS = {
  duration: '#FFD60A',
  calories: '#FF375F',
  distance: '#00D8EB',
  pace: '#00D8EB',
  heartRate: '#FF6B35',
} as const;

export interface DetailStat {
  label: string;
  value: string;
  unit?: string;
  color: string;
  /** Spans the full width instead of sharing its row. */
  wide?: boolean;
}

/**
 * A section heading that sits above a card rather than inside it.
 *
 * The chevron is part of the heading, not a row accessory: the whole section is
 * the thing you open, and a chevron on the card would suggest only the card's
 * first row leads anywhere.
 */
export function DetailSectionHeading({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) {
  const content = (
    <View className="flex-row items-center gap-1 mb-3">
      <Text
        accessibilityRole="header"
        className="text-2xl font-bold text-text-primary"
      >
        {title}
      </Text>
      {onPress ? (
        <Icon name="chevron-forward" size={18} color="#8E8E93" />
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

/**
 * A workout's headline numbers, paired two to a row inside one card.
 *
 * Two to a row rather than a tile each: a tile per stat gives every number the
 * same weight and the same box, so four of them read as a dashboard instead of
 * as one workout's summary. Pairing them under a shared surface, with the label
 * above the value and a hairline between rows, is the shape Apple's own workout
 * detail uses and it survives long localized labels far better than a grid of
 * fixed tiles does.
 *
 * A stat marked `wide` takes a row to itself, which is how a metric with no
 * natural partner (active energy, between duration and total energy) avoids
 * leaving a hole beside it.
 */
export default function WorkoutDetailsCard({
  stats,
}: {
  stats: readonly DetailStat[];
}) {
  if (stats.length === 0) return null;

  // Packed here rather than by the caller so the `wide` rule lives with the
  // layout it affects.
  const rows: DetailStat[][] = [];
  let pending: DetailStat[] = [];
  for (const stat of stats) {
    if (stat.wide) {
      if (pending.length) {
        rows.push(pending);
        pending = [];
      }
      rows.push([stat]);
      continue;
    }
    pending.push(stat);
    if (pending.length === 2) {
      rows.push(pending);
      pending = [];
    }
  }
  if (pending.length) rows.push(pending);

  return (
    <View className="bg-surface rounded-3xl px-4">
      {rows.map((row, index) => (
        <View
          key={row.map((stat) => stat.label).join('|')}
          className={`flex-row py-3 ${index > 0 ? 'border-t border-border' : ''}`}
        >
          {row.map((stat) => (
            <View key={stat.label} className="flex-1 pr-3">
              <Text
                className="text-base text-text-primary mb-0.5"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {stat.label}
              </Text>
              <Text
                style={{ color: stat.color }}
                className="text-3xl font-bold"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {stat.value}
                {stat.unit ? (
                  <Text className="text-base font-semibold"> {stat.unit}</Text>
                ) : null}
              </Text>
            </View>
          ))}
          {/* Only a two-up row that came up short needs filling; a `wide` stat
              is meant to span. */}
          {row.length === 1 && !row[0].wide ? (
            <View className="flex-1" />
          ) : null}
        </View>
      ))}
    </View>
  );
}
