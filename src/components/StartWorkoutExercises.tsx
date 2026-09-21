import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import StatusView from './StatusView';
import TrainingCard from './TrainingCard';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import { useExerciseSearch } from '../hooks/useExerciseSearch';
import { useSuggestedExercises } from '../hooks/useSuggestedExercises';
import type { RecordingSport } from '../services/recording/types';
import type { Exercise } from '../types/exercise';

/**
 * The exercises you can start a workout from, as cards.
 *
 * This is what the Start Workout screen shows in place of an empty programs
 * list. A screen that said "no programs yet" and offered one "pick your first
 * exercise" row made you tap twice to reach the only thing you could actually
 * do; every card here *is* that empty workout, started with the exercise on it.
 *
 * Local exercises only — no provider tab. Starting a workout is a gym-floor
 * action, and a picker that can fall back to a network search is the wrong
 * shape for it: what you want is the thing you already train.
 */
export default function StartWorkoutExercises({
  searchText,
  onSelect,
  onInfo,
  onRecord,
  startingId,
  contentTopInset = 0,
}: {
  searchText: string;
  onSelect: (exercise: Exercise) => void;
  onInfo: (exercise: Exercise) => void;
  /** Opens setup for a recorded workout — running first, cycling second. */
  onRecord: (sport: RecordingSport) => void;
  /** Where content starts, below a transparent header and its accessory. */
  contentTopInset?: number;
  /** The exercise currently starting a session, if any. */
  startingId?: string | null;
}) {
  const { t } = useTranslation();
  const { getImageSource } = useExerciseImageSource();
  const { recentExercises, topExercises, isLoading, isError, refetch } =
    useSuggestedExercises();
  const { searchResults, isSearching, isSearchActive, isSearchError } =
    useExerciseSearch(searchText);

  // Recent first, then popular, with anything that appears in both kept once:
  // a duplicate card is read as two exercises with the same name.
  const suggested = useMemo(() => {
    const seen = new Set<string>();
    return [...recentExercises, ...topExercises].filter((exercise) => {
      if (seen.has(exercise.id)) return false;
      seen.add(exercise.id);
      return true;
    });
  }, [recentExercises, topExercises]);

  const exercises = isSearchActive ? searchResults : suggested;

  // Left out of a search: these two are fixed entries, not library matches,
  // and a search that returned them alongside real hits would read as a
  // result for whatever was typed.
  const recorded = isSearchActive ? null : (
    <>
      <TrainingCard
        testID="start-workout-run"
        title={t('startWorkout.running', { defaultValue: 'Running' })}
        subtitle={t('startWorkout.recorded', { defaultValue: 'GPS tracked' })}
        icon="exercise-running-filled"
        onPress={() => onRecord('run')}
      />
      <TrainingCard
        testID="start-workout-ride"
        title={t('startWorkout.cycling', { defaultValue: 'Cycling' })}
        subtitle={t('startWorkout.recorded', { defaultValue: 'GPS tracked' })}
        icon="exercise-cycling"
        onPress={() => onRecord('ride')}
      />
    </>
  );

  if (isSearchActive ? isSearchError : isError) {
    return (
      <StatusView
        icon="alert-circle"
        title={t('startWorkout.loadFailed', {
          defaultValue: 'Failed to load exercises',
        })}
        action={
          isSearchActive
            ? undefined
            : {
                label: t('common.retry', { defaultValue: 'Retry' }),
                onPress: () => refetch(),
              }
        }
      />
    );
  }

  if (exercises.length === 0) {
    if (isSearchActive ? isSearching : isLoading) return <StatusView loading />;
    return (
      <View className="flex-1">
        {recorded ? <View className="px-4 pt-4">{recorded}</View> : null}
        <StatusView
          title={
            isSearchActive
              ? t('startWorkout.noMatches', {
                  defaultValue: 'No exercises found',
                })
              : t('startWorkout.noExercises', {
                  defaultValue: 'No exercises yet',
                })
          }
          subtitle={
            isSearchActive
              ? undefined
              : t('startWorkout.noExercisesMessage', {
                  defaultValue: 'Add an exercise to your library to start here',
                })
          }
        />
      </View>
    );
  }

  return (
    <FlatList
      data={exercises}
      keyExtractor={(exercise) => exercise.id}
      contentContainerStyle={{ padding: 16, paddingTop: contentTopInset + 16 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={recorded}
      renderItem={({ item }) => (
        <TrainingCard
          testID={`start-workout-${item.id}`}
          title={item.name}
          subtitle={item.category}
          imageUri={
            item.images?.[0]
              ? (getImageSource(item.images[0])?.uri ?? null)
              : null
          }
          starting={startingId === item.id}
          onPress={() => onSelect(item)}
          onInfo={() => onInfo(item)}
        />
      )}
      ListFooterComponent={<View style={{ height: 8 }} />}
    />
  );
}
