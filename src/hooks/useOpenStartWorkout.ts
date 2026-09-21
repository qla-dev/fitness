import { useCallback } from 'react';

type StartWorkoutNavigation = {
  navigate: (screen: 'PresetSearch') => void;
};

/**
 * The workouts button every tab header carries: open Start Workout.
 *
 * One place says where that button goes, so the five headers that carry it
 * cannot drift apart. It deliberately does no active-workout checking of its
 * own — opening the list is harmless, and the "Workout in progress" prompt
 * belongs to the moment a movement is actually picked, which
 * `useStartLiveWorkout` already owns.
 */
export function useOpenStartWorkout(navigation: StartWorkoutNavigation) {
  return useCallback(() => navigation.navigate('PresetSearch'), [navigation]);
}
