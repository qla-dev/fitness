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

/** Move, Exercise and Steps as 0–1 progress, the way the Activities card fills its rings. */
export function activityRingProgress(
  summary: DailySummary,
  steps: number | null | undefined
): ActivityRingProgress {
  return {
    move: ratio(
      summary.activeCalories + summary.otherExerciseCalories,
      summary.exerciseCaloriesGoal
    ),
    exercise: ratio(summary.exerciseMinutes, summary.exerciseMinutesGoal),
    steps: ratio(steps, summary.goals.steps ?? 0),
  };
}
