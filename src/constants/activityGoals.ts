import type { TFunction } from 'i18next';
import type { IconName } from '../components/Icon';
import type { DailySummary } from '../types/dailySummary';

/**
 * The goals the Activities screen shows, as one registry.
 *
 * The dashboard cards and the goal detail screen both read from here, so a
 * metric's colour, unit and how its value is derived are stated once. Adding a
 * goal means adding an entry, not editing two screens that have to agree.
 */
export type ActivityGoalKey =
  'move' | 'exercise' | 'stand' | 'steps' | 'distance';

export interface ActivityGoalInputs {
  summary: DailySummary;
  steps?: number | null;
  distance?: number | null;
  standHours?: number | null;
  standGoal?: number;
  stepsGoal?: number;
  distanceUnit: 'km' | 'miles';
}

export interface ActivityGoalDefinition {
  key: ActivityGoalKey;
  icon: IconName;
  color: string;
  label: (t: TFunction) => string;
  unit: (t: TFunction, inputs: ActivityGoalInputs) => string;
  value: (inputs: ActivityGoalInputs) => number;
  goal: (inputs: ActivityGoalInputs) => number;
  /** Decimals the value is written with; distance is the only fractional one. */
  precision: number;
}

export const ACTIVITY_GOALS: ActivityGoalDefinition[] = [
  {
    key: 'move',
    icon: 'flame',
    color: '#FF375F',
    label: (t) => t('dashboard.activityMove', { defaultValue: 'Move' }),
    unit: (t) => t('dashboard.activityKcal', { defaultValue: 'kcal' }),
    value: ({ summary }) =>
      summary.activeCalories + summary.otherExerciseCalories,
    goal: ({ summary }) => summary.exerciseCaloriesGoal,
    precision: 0,
  },
  {
    key: 'exercise',
    icon: 'exercise-running',
    color: '#A8EF00',
    label: (t) => t('dashboard.activityExercise', { defaultValue: 'Exercise' }),
    unit: (t) => t('dashboard.activityMinutes', { defaultValue: 'min' }),
    value: ({ summary }) => summary.exerciseMinutes,
    goal: ({ summary }) => summary.exerciseMinutesGoal,
    precision: 0,
  },
  {
    key: 'stand',
    icon: 'exercise-walking',
    color: '#00D8EB',
    label: (t) => t('dashboard.activityStand', { defaultValue: 'Stand' }),
    unit: (t) => t('dashboard.activityHours', { defaultValue: 'h' }),
    value: ({ standHours }) => standHours ?? 0,
    goal: ({ standGoal }) => standGoal ?? 0,
    precision: 0,
  },
  {
    key: 'steps',
    icon: 'exercise-walking',
    color: '#00D8EB',
    label: (t) => t('dashboard.activitySteps', { defaultValue: 'Steps' }),
    unit: () => '',
    value: ({ steps }) => steps ?? 0,
    goal: ({ stepsGoal }) => stepsGoal ?? 0,
    precision: 0,
  },
  {
    key: 'distance',
    icon: 'measurements',
    color: '#00D8EB',
    label: (t) => t('dashboard.activityDistance', { defaultValue: 'Distance' }),
    unit: (t, { distanceUnit }) =>
      distanceUnit === 'km'
        ? t('dashboard.activityKilometers', { defaultValue: 'km' })
        : t('dashboard.activityMiles', { defaultValue: 'mi' }),
    value: ({ distance }) => distance ?? 0,
    // Distance is tracked, not targeted: the tile has never had a goal and the
    // detail screen reports it as a plain total rather than inventing one.
    goal: () => 0,
    precision: 2,
  },
];

export const activityGoalByKey = (
  key: ActivityGoalKey
): ActivityGoalDefinition => {
  const found = ACTIVITY_GOALS.find((goal) => goal.key === key);
  // Total by construction: the key type is this table's own key set.
  if (!found) throw new Error(`Unknown activity goal: ${key}`);
  return found;
};
