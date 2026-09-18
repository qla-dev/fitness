import { apiFetch } from './apiClient';
import type { DailyGoals } from '../../types/goals';
import type { FoodEntry } from '../../types/foodEntries';
import type {
  ExerciseSessionResponse,
  CalorieBalance,
  SupplementTotals,
} from '@workspace/shared';

export interface DailySummaryApiResponse {
  goals: DailyGoals;
  foodEntries: FoodEntry[];
  exerciseSessions: ExerciseSessionResponse[];
  waterIntake: number;
  stepCalories?: number;
  /**
   * 24-slot breakdowns of the day, keyed by health record type. Optional
   * because only some providers can break a metric down by hour, and only for
   * some metrics.
   */
  hourlyActivity?: Record<string, number[]>;
  /** Resting + active energy for the day, as the provider reported it. */
  totalCaloriesBurned?: number;
  calorieBalance?: CalorieBalance;
  // Optional: a client can outrun the server it talks to, and supplement totals only exist
  // on servers new enough to send them.
  supplementTotals?: SupplementTotals;
  adjustedGoals?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

export const fetchDailySummary = (
  date: string,
  userId?: string
): Promise<DailySummaryApiResponse> => {
  const params = new URLSearchParams({ date });
  if (userId) params.set('userId', userId);

  return apiFetch<DailySummaryApiResponse>({
    endpoint: `/api/daily-summary?${params.toString()}`,
    serviceName: 'Daily Summary API',
    operation: userId ? 'fetch family daily summary' : 'fetch daily summary',
  });
};
