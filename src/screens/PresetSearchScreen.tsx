import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LibrarySearchBar from '../components/LibrarySearchBar';
import StartWorkoutExercises, {
  ALL_SPORTS,
} from '../components/StartWorkoutExercises';
import FilterChipRow from '../components/FilterChipRow';
import { useCreateExercise } from '../hooks/useExerciseMutations';
import { useExercisesLibrary } from '../hooks/useExercisesLibrary';
import { useNavigationActionGuard } from '../hooks/useNavigationActionGuard';
import {
  HEADER_CONTENT_GAP,
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
import { useStartLiveWorkout } from '../hooks/useStartLiveWorkout';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { getTodayDate } from '../utils/dateUtils';
import { buildSingleExerciseStartPayload } from '../utils/workoutSession';
import {
  SPORT_ENVIRONMENTS,
  SPORT_GROUPS,
  getSportEnvironmentLabel,
  getSportGroupLabel,
  type SportFilter,
  type WorkoutSport,
} from '../constants/workoutSports';
import type { RootStackScreenProps } from '../types/navigation';

type PresetSearchScreenProps = RootStackScreenProps<'PresetSearch'>;

/**
 * Start Workout: the exercises you can begin a session from.
 *
 * Deliberately has nothing to do with saved programs. Those are their own
 * thing, opened from the profile and stocked from the store, and mixing them
 * in here made one screen answer two questions — "which of my programs do I
 * run today" and "what am I about to lift" — with a different layout depending
 * on whether the user happened to have saved any.
 *
 * Every card starts a workout with the movement on it. There is no separate
 * "empty workout" row because there is nothing for it to do that a card does
 * not already do in one tap instead of two.
 */
const PresetSearchScreen: React.FC<PresetSearchScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const [accessoryHeight, setAccessoryHeight] = useState(0);
  const [group, setGroup] = useState<SportFilter | typeof ALL_SPORTS>(
    ALL_SPORTS
  );

  // Fixed options rather than whatever the library happens to hold: the chip
  // row is part of the screen's shape, so it cannot appear and disappear with
  // the contents of somebody's exercise list. Groups first — what a session is
  // like — then where it happens, in the same row, because both narrow the one
  // list and a second row would double the header's height.
  const groupOptions = useMemo(
    () => [
      { value: ALL_SPORTS, label: t('common.all', { defaultValue: 'All' }) },
      ...SPORT_GROUPS.map((id) => ({
        value: id,
        label: getSportGroupLabel(t, id),
      })),
      ...SPORT_ENVIRONMENTS.map((id) => ({
        value: id,
        label: getSportEnvironmentLabel(t, id),
      })),
    ],
    [t]
  );

  const [searchText, setSearchText] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  const { startLiveWorkout } = useStartLiveWorkout(navigation);
  const { createExerciseAsync } = useCreateExercise();
  // Matched by name so a sport started twice reuses the exercise it made the
  // first time rather than filling the library with duplicates.
  const { exercises } = useExercisesLibrary('');
  const { runNavigationAction } = useNavigationActionGuard(navigation);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Manual logging sits beside the live start: this screen is where the tab
  // header's workouts button lands, so the two after-the-fact entries the add
  // sheet used to carry are its right-hand buttons. Neither passes
  // `skipDraftLoad`, so an unfinished draft is picked back up rather than
  // silently replaced.
  const header = useScreenHeader({
    variant: 'transparent',
    accessory: (
      <>
        <LibrarySearchBar
          glass
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('exerciseSearch.search.placeholder', {
            defaultValue: 'Search exercises...',
          })}
          testID="start-workout-search"
        />
        <FilterChipRow
          value={group}
          options={groupOptions}
          onChange={(value) =>
            setGroup(value as SportFilter | typeof ALL_SPORTS)
          }
          clearValue={ALL_SPORTS}
        />
      </>
    ),
    onAccessoryHeight: setAccessoryHeight,
    title: t('presetSearch.title', { defaultValue: 'Start Workout' }),
    borderless: true,
    left: {
      kind: 'dismiss',
      onPress: handleCancel,
      identifier: 'preset-search-cancel',
    },
    right: [
      {
        kind: 'icon',
        sfSymbol: 'figure.strengthtraining.traditional',
        ionicon: 'barbell-outline',
        accessibilityLabel: t('activityHistory.logWorkout', {
          defaultValue: 'Log workout',
        }),
        identifier: 'preset-search-log-workout',
        onPress: () =>
          runNavigationAction(() =>
            navigation.navigate('WorkoutAdd', { date: getTodayDate() })
          ),
        separated: true,
      },
      {
        kind: 'icon',
        sfSymbol: 'square.and.pencil',
        ionicon: 'create-outline',
        accessibilityLabel: t('activityHistory.logActivity', {
          defaultValue: 'Log activity',
        }),
        identifier: 'preset-search-log-activity',
        onPress: () =>
          runNavigationAction(() =>
            navigation.navigate('ActivityAdd', { date: getTodayDate() })
          ),
        // Own glass capsule each, or iOS 26 merges the pair into one control.
        separated: true,
      },
    ],
  });

  // A recorded sport goes through setup first: it has a goal to pick and a
  // body weight to confirm, neither of which the rest need.
  const handleRecord = useCallback(
    (sport: WorkoutSport) => {
      runNavigationAction(() =>
        navigation.navigate('WorkoutSetup', {
          sport: sport.recording ?? 'run',
          sportId: sport.id,
        })
      );
    },
    [runNavigationAction, navigation]
  );

  // A session is logged against an exercise, so a sport with no exercise of
  // its own gets one the first time it is started — named and categorised
  // after the sport, which is what keeps its history carrying the right icon.
  // The pressed card is marked by its own id, so the spinner lands on the one
  // that was tapped rather than on the list as a whole.
  const handleStartSport = useCallback(
    (sport: WorkoutSport) => {
      setStartingId(sport.id);
      const name = sport.label(t);
      void (async () => {
        try {
          const existing = exercises.find(
            (exercise) =>
              exercise.name.trim().toLowerCase() === name.toLowerCase()
          );
          const exercise =
            existing ??
            (await createExerciseAsync({
              name,
              category: sport.category,
              description: null,
              // Duration-based: a sport is timed, not counted in reps.
              modality: 'duration',
            }));
          await startLiveWorkout({
            exercises: buildSingleExerciseStartPayload(exercise),
          });
        } finally {
          setStartingId(null);
        }
      })();
    },
    [createExerciseAsync, exercises, startLiveWorkout, t]
  );

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      <StartWorkoutExercises
        group={group}
        contentTopInset={
          usesNativeHeader
            ? headerOffset + accessoryHeight + HEADER_CONTENT_GAP
            : 0
        }
        searchText={searchText}
        startingId={startingId}
        onStart={handleStartSport}
        onRecord={handleRecord}
      />
    </View>
  );
};

export default PresetSearchScreen;
