import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import StatusView from './StatusView';
import TrainingCard from './TrainingCard';
import {
  WORKOUT_SPORTS,
  matchesSportFilter,
  type SportFilter,
  type WorkoutSport,
} from '../constants/workoutSports';

/** The chip row's leading option: no group filter. */
export const ALL_SPORTS = '__all__';

/**
 * The sports you can start a session as, as cards.
 *
 * A fixed catalogue rather than the exercise library. A saved exercise is a
 * movement — "Barbell Squat" — and picking one is a different question from
 * "what am I about to spend the next hour doing". Reading the library here
 * also showed running and cycling twice, once as the recorded entry and again
 * as whatever happened to be saved under the same name.
 */
export default function StartWorkoutExercises({
  searchText,
  onStart,
  onRecord,
  startingId,
  contentTopInset = 0,
  group = ALL_SPORTS,
}: {
  searchText: string;
  /** Starts a session measured by a paired watch. */
  onStart: (sport: WorkoutSport) => void;
  /** Opens setup for a session recorded with the phone's GPS. */
  onRecord: (sport: WorkoutSport) => void;
  /** Where content starts, below a transparent header and its accessory. */
  contentTopInset?: number;
  /** Chip row filter — a group or an environment; {@link ALL_SPORTS} shows everything. */
  group?: SportFilter | typeof ALL_SPORTS;
  /** The sport currently starting a session, if any. */
  startingId?: string | null;
}) {
  const { t } = useTranslation();

  // The chip row and the search box narrow the same list, so both apply at
  // once: a filter the header still shows has to keep applying while typing.
  // The recorded sports are in the list rather than pinned above it, or they
  // would survive a filter that excludes them.
  const sports = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return WORKOUT_SPORTS.filter((sport) => {
      if (group !== ALL_SPORTS && !matchesSportFilter(sport, group))
        return false;
      if (!term) return true;
      return sport.label(t).toLowerCase().includes(term);
    });
  }, [group, searchText, t]);

  if (sports.length === 0) {
    return (
      <StatusView
        title={t('startWorkout.noMatches', {
          defaultValue: 'No exercises found',
        })}
      />
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      data={sports}
      keyExtractor={(sport) => sport.id}
      contentContainerStyle={{ padding: 16, paddingTop: contentTopInset }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <TrainingCard
          testID={`start-workout-${item.id}`}
          title={item.label(t)}
          icon={item.icon}
          starting={startingId === item.id}
          // The card itself starts the way the sport is usually measured; the
          // two buttons under it name the instrument explicitly.
          // A studio sport has no route to trace, so it offers the watch
          // alone — full width rather than half a row with a gap beside it.
          onPress={() => (item.gps ? onRecord(item) : onStart(item))}
          onGps={item.gps ? () => onRecord(item) : undefined}
          onWatch={() => onStart(item)}
        />
      )}
      ListFooterComponent={<View style={{ height: 8 }} />}
    />
  );
}
