import type { TFunction } from 'i18next';
import { getNutrientLabel, NUTRIENT_META } from './nutrients';
import type { UserCustomNutrient } from '../hooks/useCustomNutrients';
import type { DailyGoals } from '../types/goals';

/**
 * The goals a user can edit from Profile, one screen per value.
 *
 * Only keys that exist on {@link DailyGoals} belong here: `NUTRIENT_META` also
 * carries display-only entries (glycemic index) that the goals endpoint has no
 * field for, and writing one would put a key the server never reads into the
 * payload.
 */
export const CUSTOM_GOAL_PREFIX = 'custom:';

/**
 * Sections are identified, not carried as translation keys: the header text is
 * resolved by {@link getProfileGoalSectionTitle} with literal `t()` keys so the
 * i18n audit can still see every key statically.
 */
export type ProfileGoalSectionId = 'nutrition' | 'activity' | 'custom';

export interface ProfileGoalSection {
  id: ProfileGoalSectionId;
  keys: string[];
}

const NUTRITION_GOAL_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'dietary_fiber',
  'sugars',
  'saturated_fat',
  'polyunsaturated_fat',
  'monounsaturated_fat',
  'trans_fat',
  'cholesterol',
  'sodium',
  'potassium',
  'vitamin_a',
  'vitamin_c',
  'calcium',
  'iron',
] as const;

const ACTIVITY_GOAL_KEYS = [
  'water_goal_ml',
  'target_exercise_calories_burned',
  'target_exercise_duration_minutes',
  'steps',
  'stand_hours',
] as const;

export const PROFILE_GOAL_SECTIONS: ProfileGoalSection[] = [
  { id: 'nutrition', keys: [...NUTRITION_GOAL_KEYS] },
  { id: 'activity', keys: [...ACTIVITY_GOAL_KEYS] },
];

export function getProfileGoalSectionTitle(
  t: TFunction,
  id: ProfileGoalSectionId
): string {
  switch (id) {
    case 'nutrition':
      return t('profile.goalsNutrition', { defaultValue: 'Nutrition' });
    case 'activity':
      return t('profile.goalsActivity', {
        defaultValue: 'Hydration & activity',
      });
    case 'custom':
      return t('profile.goalsCustom', { defaultValue: 'Custom nutrients' });
  }
}

/** Units for the goals that are not standard nutrients. */
const ACTIVITY_GOAL_UNITS: Record<string, string> = {
  water_goal_ml: 'ml',
  target_exercise_calories_burned: 'kcal',
  target_exercise_duration_minutes: 'min',
  steps: '',
  stand_hours: 'h',
};

/** Inclusive upper bounds for goals a larger number cannot mean. */
const GOAL_MAXIMUMS: Record<string, number> = {
  stand_hours: 24,
};

/**
 * Inclusive lower bounds where zero is not a goal but a broken one. A 0 kcal
 * day target puts a zero under every "remaining" and percentage the app
 * computes; nutrient goals keep accepting 0, which reads as "avoid".
 */
const GOAL_MINIMUMS: Record<string, number> = {
  calories: 1,
};

export function isCustomGoalKey(key: string): boolean {
  return key.startsWith(CUSTOM_GOAL_PREFIX);
}

export function customGoalName(key: string): string {
  return key.slice(CUSTOM_GOAL_PREFIX.length);
}

export function goalMaximum(key: string): number | undefined {
  return GOAL_MAXIMUMS[key];
}

export function goalMinimum(key: string): number {
  return GOAL_MINIMUMS[key] ?? 0;
}

export function getProfileGoalLabel(
  t: TFunction,
  key: string,
  customNutrients: UserCustomNutrient[] = []
): string {
  if (isCustomGoalKey(key)) {
    const name = customGoalName(key);
    return (
      customNutrients.find((nutrient) => nutrient.name === name)?.name ?? name
    );
  }
  switch (key) {
    case 'water_goal_ml':
      return t('dashboard.hydration', { defaultValue: 'Hydration' });
    case 'target_exercise_calories_burned':
      return t('dashboard.activityMove', { defaultValue: 'Move' });
    case 'target_exercise_duration_minutes':
      return t('dashboard.activityExercise', { defaultValue: 'Exercise' });
    case 'steps':
      return t('dashboard.activitySteps', { defaultValue: 'Steps' });
    case 'stand_hours':
      return t('dashboard.activityStand', { defaultValue: 'Stand' });
    default:
      return getNutrientLabel(t, key);
  }
}

export function getProfileGoalUnit(
  key: string,
  customNutrients: UserCustomNutrient[] = []
): string {
  if (isCustomGoalKey(key)) {
    const name = customGoalName(key);
    return (
      customNutrients.find((nutrient) => nutrient.name === name)?.unit ?? ''
    );
  }
  return ACTIVITY_GOAL_UNITS[key] ?? NUTRIENT_META[key]?.unit ?? '';
}

/** Reads one goal value out of a fetched goals payload. */
export function readGoalValue(
  goals: DailyGoals | undefined,
  key: string
): number | undefined {
  if (!goals) return undefined;
  if (isCustomGoalKey(key)) {
    const raw = goals.custom_nutrients?.[customGoalName(key)];
    const value = typeof raw === 'string' ? Number(raw) : raw;
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }
  const value = (goals as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
