import type { DailySummary } from '../types/dailySummary';

/** Ring colours shared by the Activities card and the ring calendar. */
export const ACTIVITY_RING_COLORS = {
  move: '#FF375F',
  exercise: '#A8EF00',
  steps: '#00D8EB',
} as const;

export interface ActivityRingProgress {
  move: number;
  exercise: number;
  steps: number;
}

const ratio = (value: number | null | undefined, goal: number) =>
  goal > 0 ? Math.min(1, Math.max(0, (value ?? 0) / goal)) : 0;

/**
 * The values a day's rings need, without a whole `DailySummary`. The ring
 * calendar reads a month in one request and gets these per day, so it never
 * has to build 31 summaries to draw 31 sets of rings.
 */
export interface ActivityRingParts {
  activeCalories: number;
  otherExerciseCalories: number;
  exerciseMinutes: number;
  steps: number | null | undefined;
  exerciseCaloriesGoal: number;
  exerciseMinutesGoal: number;
  stepsGoal: number;
}

/** Single source of the ring ratios, shared by the Activities card and the calendar. */
export function ringProgressFromParts(
  parts: ActivityRingParts
): ActivityRingProgress {
  return {
    move: ratio(
      parts.activeCalories + parts.otherExerciseCalories,
      parts.exerciseCaloriesGoal
    ),
    exercise: ratio(parts.exerciseMinutes, parts.exerciseMinutesGoal),
    steps: ratio(parts.steps, parts.stepsGoal),
  };
}

/** Move, Exercise and Steps as 0–1 progress, the way the Activities card fills its rings. */
export function activityRingProgress(
  summary: DailySummary,
  steps: number | null | undefined
): ActivityRingProgress {
  return ringProgressFromParts({
    activeCalories: summary.activeCalories,
    otherExerciseCalories: summary.otherExerciseCalories,
    exerciseMinutes: summary.exerciseMinutes,
    steps,
    exerciseCaloriesGoal: summary.exerciseCaloriesGoal,
    exerciseMinutesGoal: summary.exerciseMinutesGoal,
    stepsGoal: summary.goals.steps ?? 0,
  });
}
