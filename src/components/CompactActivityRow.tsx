import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { ExerciseSessionResponse } from '@workspace/shared';
import Icon from './Icon';
import {
  formatDuration,
  getWorkoutIcon,
  getWorkoutSummary,
} from '../utils/workoutSession';
import { distanceFromKm } from '../utils/unitConversions';
import { formatLocalizedNumber, getAppLocale } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * Total distance in km for a session, summing a grouped workout's exercises.
 * Returns 0 rather than null so the caller's priority chain reads as one test.
 */
const sessionDistanceKm = (session: ExerciseSessionResponse): number => {
  const km =
    session.type === 'preset'
      ? session.exercises.reduce(
          (sum, exercise) => sum + Number(exercise.distance ?? 0),
          0
        )
      : Number(session.distance ?? 0);
  return Number.isFinite(km) && km > 0 ? km : 0;
};

/**
 * The card's date caption, built from the day string's own parts rather than
 * passing it to the Date constructor, which parses a bare YYYY-MM-DD as UTC and
 * so names the previous day for anyone west of Greenwich.
 */
const dayLabel = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getAppLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export interface CompactActivityRowProps {
  session: ExerciseSessionResponse;
  onPress?: () => void;
  distanceUnit?: 'km' | 'miles';
}

/**
 * One logged activity, as its own card.
 *
 * Separated cards rather than rows inside a shared card: each one is a distinct
 * thing that happened at a distinct time, and its own surface says that far
 * better than a hairline between two rows. It also gives the date somewhere to
 * live — the bottom-right corner, opposite the value, where it reads as a
 * caption on the card rather than a column in a table.
 *
 * A session carries duration, calories and often distance, and showing all
 * three gives equal weight to figures the user does not read equally — for a
 * run the distance is the fact and the rest is detail. So one headline metric
 * is chosen in the order distance → calories → duration: the first the session
 * actually recorded wins, and duration is the floor because every session has
 * one. The full breakdown is a tap away on the detail screen.
 */
const CompactActivityRow: React.FC<CompactActivityRowProps> = ({
  session,
  onPress,
  distanceUnit = 'km',
}) => {
  const { t } = useTranslation();
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const { name, duration, calories } = getWorkoutSummary(session, t);
  // Every card carries its own date, on Home as well as in the history. The
  // Home section drops the month HEADING, not the per-card date.
  const date = session.entry_date ? dayLabel(session.entry_date) : null;

  const distanceKm = sessionDistanceKm(session);
  let value: string;
  let unit: string;
  if (distanceKm > 0) {
    value = formatLocalizedNumber(distanceFromKm(distanceKm, distanceUnit), {
      maximumFractionDigits: 2,
    });
    unit =
      distanceUnit === 'miles'
        ? t('units.miles', { defaultValue: 'mi' })
        : t('units.kilometers', { defaultValue: 'km' });
  } else if (calories > 0) {
    value = formatLocalizedNumber(Math.round(calories));
    unit = t('units.kcal', { defaultValue: 'kcal' });
  } else {
    value = formatDuration(duration);
    unit = '';
  }

  return (
    <Pressable
      // Opening an activity is a navigation, so it ticks the way every other
      // card in the app does rather than being the one that opens silently.
      onPress={
        onPress
          ? () => {
              fireSelectionHaptic();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[name, `${value} ${unit}`.trim(), date]
        .filter(Boolean)
        .join(', ')}
      className="bg-surface rounded-2xl px-4 py-3 mb-3 flex-row items-center"
    >
      <View className="w-12 h-12 rounded-full bg-accent-primary/15 items-center justify-center mr-3">
        <Icon name={getWorkoutIcon(session)} size={22} color={accentColor} />
      </View>

      <View className="flex-1 mr-3">
        <Text
          className="text-base text-text-primary"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        <Text
          className="text-2xl font-bold text-accent-primary"
          numberOfLines={1}
        >
          {value}
          {unit ? (
            <Text className="text-sm font-semibold"> {unit}</Text>
          ) : null}
        </Text>
      </View>

      {/* self-end puts the date on the card's bottom edge, level with the value
          rather than with the name above it. */}
      {date ? (
        <Text className="text-sm text-text-muted self-end" numberOfLines={1}>
          {date}
        </Text>
      ) : null}
    </Pressable>
  );
};

export default CompactActivityRow;
