import type { TFunction } from 'i18next';

import type { IconName } from '../components/Icon';
import type { RecordingSport } from '../services/recording/types';

/**
 * How the Start Workout list is grouped.
 *
 * Deliberately not the exercise taxonomy the library uses: that one answers
 * "what muscle does this train", which is the wrong question when you are
 * picking what to start. These answer "what is this going to be like" — am I
 * covering ground, staying in one place, playing something, or lifting.
 */
export type SportGroup =
  'moving' | 'stationary' | 'ball' | 'studio' | 'strength';

export const SPORT_GROUPS: SportGroup[] = [
  'moving',
  'stationary',
  'ball',
  'studio',
  'strength',
];

export const SPORT_ENVIRONMENTS: SportEnvironment[] = ['indoor', 'outdoor'];

/** What the chip row filters on: a group, an environment, or nothing. */
export type SportFilter = SportGroup | SportEnvironment;

const SPORT_GROUP_ICONS: Record<SportGroup, IconName> = {
  moving: 'exercise-running-filled',
  stationary: 'exercise-rowing',
  ball: 'exercise-basketball',
  studio: 'exercise-yoga',
  strength: 'exercise-weights',
};

export function getSportGroupIcon(group: SportGroup): IconName {
  return SPORT_GROUP_ICONS[group];
}

export function getSportEnvironmentIcon(
  environment: SportEnvironment
): IconName {
  return environment === 'indoor' ? 'exercise-weights' : 'exercise-hiking';
}

export function getSportEnvironmentLabel(
  t: TFunction,
  environment: SportEnvironment
): string {
  return environment === 'indoor'
    ? t('startWorkout.groups.indoor', { defaultValue: 'Indoor' })
    : t('startWorkout.groups.outdoor', { defaultValue: 'Outdoor' });
}

export function matchesSportFilter(
  sport: WorkoutSport,
  filter: SportFilter
): boolean {
  return filter === 'indoor' || filter === 'outdoor'
    ? sport.environment === filter
    : sport.group === filter;
}

export function getSportGroupLabel(t: TFunction, group: SportGroup): string {
  switch (group) {
    case 'moving':
      return t('startWorkout.groups.moving', { defaultValue: 'Moving' });
    case 'stationary':
      return t('startWorkout.groups.stationary', {
        defaultValue: 'Stationary',
      });
    case 'ball':
      return t('startWorkout.groups.ball', { defaultValue: 'Ball' });
    case 'studio':
      return t('startWorkout.groups.studio', { defaultValue: 'Studio' });
    case 'strength':
      return t('startWorkout.groups.strength', { defaultValue: 'Strength' });
  }
}

/** Where a sport happens, the second thing the chip row filters on. */
export type SportEnvironment = 'indoor' | 'outdoor';

export interface WorkoutSport {
  id: string;
  group: SportGroup;
  environment: SportEnvironment;
  /**
   * Can be recorded with the phone's GPS. False for the studio sports: a mat
   * does not have a route, so offering to trace one is noise.
   */
  gps: boolean;
  icon: IconName;
  label: (t: TFunction) => string;
  /**
   * Recorded live with GPS, through the setup screen. Everything else starts
   * straight into a session.
   */
  recording?: RecordingSport;
  /** Stored on the exercise this sport starts, so history keeps its icon. */
  category: string;
}

/**
 * Every sport the screen offers, in the order it shows them: the two recorded
 * ones first, because they are the reason to open this screen mid-warm-up.
 *
 * The list is fixed rather than read from the library — a saved exercise is a
 * movement ("Barbell Squat"), not something you start a session as.
 */
export const WORKOUT_SPORTS: WorkoutSport[] = [
  {
    id: 'running',
    environment: 'outdoor',
    gps: true,
    group: 'moving',
    icon: 'exercise-running-filled',
    recording: 'run',
    category: 'Running',
    label: (t) => t('startWorkout.running', { defaultValue: 'Running' }),
  },
  {
    id: 'cycling',
    environment: 'outdoor',
    gps: true,
    group: 'moving',
    icon: 'exercise-cycling',
    recording: 'ride',
    category: 'Cycling',
    label: (t) => t('startWorkout.cycling', { defaultValue: 'Cycling' }),
  },
  {
    id: 'walking',
    environment: 'outdoor',
    gps: true,
    group: 'moving',
    icon: 'exercise-walking',
    category: 'Walking',
    label: (t) => t('startWorkout.sports.walking', { defaultValue: 'Walking' }),
  },
  {
    id: 'hiking',
    environment: 'outdoor',
    gps: true,
    group: 'moving',
    icon: 'exercise-hiking',
    category: 'Hiking',
    label: (t) => t('startWorkout.sports.hiking', { defaultValue: 'Hiking' }),
  },
  {
    id: 'swimming',
    environment: 'indoor',
    gps: true,
    group: 'moving',
    icon: 'exercise-swimming',
    category: 'Swimming',
    label: (t) =>
      t('startWorkout.sports.swimming', { defaultValue: 'Swimming' }),
  },
  {
    id: 'rowing',
    environment: 'indoor',
    gps: true,
    group: 'stationary',
    icon: 'exercise-rowing',
    category: 'Rowing',
    label: (t) => t('startWorkout.sports.rowing', { defaultValue: 'Rowing' }),
  },
  {
    id: 'elliptical',
    environment: 'indoor',
    gps: true,
    group: 'stationary',
    icon: 'exercise-elliptical',
    category: 'Elliptical',
    label: (t) =>
      t('startWorkout.sports.elliptical', { defaultValue: 'Elliptical' }),
  },
  {
    id: 'stair-climbing',
    environment: 'indoor',
    gps: true,
    group: 'stationary',
    icon: 'exercise-stair',
    category: 'Stair Climbing',
    label: (t) =>
      t('startWorkout.sports.stairClimbing', {
        defaultValue: 'Stair Climbing',
      }),
  },
  {
    id: 'tennis',
    environment: 'outdoor',
    gps: true,
    group: 'ball',
    icon: 'exercise-tennis',
    category: 'Tennis',
    label: (t) => t('startWorkout.sports.tennis', { defaultValue: 'Tennis' }),
  },
  {
    id: 'basketball',
    environment: 'indoor',
    gps: true,
    group: 'ball',
    icon: 'exercise-basketball',
    category: 'Basketball',
    label: (t) =>
      t('startWorkout.sports.basketball', { defaultValue: 'Basketball' }),
  },
  {
    id: 'football',
    environment: 'outdoor',
    gps: true,
    group: 'ball',
    icon: 'exercise-soccer',
    category: 'Soccer',
    label: (t) =>
      t('startWorkout.sports.football', { defaultValue: 'Football' }),
  },
  {
    id: 'yoga',
    environment: 'indoor',
    gps: false,
    group: 'studio',
    icon: 'exercise-yoga',
    category: 'Yoga',
    label: (t) => t('startWorkout.sports.yoga', { defaultValue: 'Yoga' }),
  },
  {
    id: 'pilates',
    environment: 'indoor',
    gps: false,
    group: 'studio',
    icon: 'exercise-pilates',
    category: 'Pilates',
    label: (t) => t('startWorkout.sports.pilates', { defaultValue: 'Pilates' }),
  },
  {
    id: 'dancing',
    environment: 'indoor',
    gps: false,
    group: 'studio',
    icon: 'exercise-dance',
    category: 'Dance',
    label: (t) => t('startWorkout.sports.dancing', { defaultValue: 'Dancing' }),
  },
  {
    id: 'boxing',
    environment: 'indoor',
    gps: false,
    group: 'studio',
    icon: 'exercise-boxing',
    category: 'Boxing',
    label: (t) => t('startWorkout.sports.boxing', { defaultValue: 'Boxing' }),
  },
  {
    id: 'strength-training',
    environment: 'indoor',
    gps: true,
    group: 'strength',
    icon: 'exercise-weights',
    category: 'Strength',
    label: (t) =>
      t('startWorkout.sports.strengthTraining', {
        defaultValue: 'Strength Training',
      }),
  },
  {
    id: 'crossfit',
    environment: 'indoor',
    gps: true,
    group: 'strength',
    icon: 'exercise-weights',
    category: 'Strength',
    label: (t) =>
      t('startWorkout.sports.crossfit', { defaultValue: 'CrossFit' }),
  },
  {
    id: 'hiit',
    environment: 'indoor',
    gps: true,
    group: 'strength',
    icon: 'exercise-running',
    category: 'Cardio',
    label: (t) => t('startWorkout.sports.hiit', { defaultValue: 'HIIT' }),
  },
];
