import { useQuery } from '@tanstack/react-query';
import {
  fetchActivityRange,
  type ActivityRangeDay,
} from '../services/api/measurementsApi';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import { activityRangeQueryKey } from './queryKeys';
import { getTodayDate, addDays } from '../utils/dateUtils';
import { RANGE_DAYS, type HealthTrendDateRange } from '../types/healthTrends';
import type { ActivityGoalKey } from '../constants/activityGoals';

export type ActivityDataPoint = {
  day: string;
  value: number;
};

/**
 * Which column of the day's row each metric reads.
 *
 * Steps is absent on purpose: it has been on the check-in row since long
 * before this existed and already has its own history through
 * `useMeasurementsRange`. Pointing a second query at the same number would
 * only create somewhere for the two to disagree.
 */
const COLUMN: Partial<Record<ActivityGoalKey, keyof ActivityRangeDay>> = {
  move: 'active_calories',
  exercise: 'exercise_minutes',
  stand: 'stand_hours',
  distance: 'distance_m',
};

/** Whether this metric has a history chart of its own. */
export const hasActivityHistory = (metric: ActivityGoalKey): boolean =>
  metric in COLUMN;

interface UseActivityRangeOptions {
  metric: ActivityGoalKey;
  range: HealthTrendDateRange;
  enabled?: boolean;
}

/**
 * One activity metric's daily history, as one point per day in the range.
 *
 * Every day in the window gets a point, including the ones with nothing in
 * them: a bar chart with gaps in it reads as missing data rather than as a day
 * you did not move, and the two are different answers.
 */
export function useActivityRange({
  metric,
  range,
  enabled = true,
}: UseActivityRangeOptions) {
  const today = getTodayDate();
  const days = RANGE_DAYS[range];
  const startDate = addDays(today, -(days - 1));
  const column = COLUMN[metric];

  const query = useQuery({
    queryKey: activityRangeQueryKey(startDate, today),
    queryFn: () => fetchActivityRange(startDate, today),
    enabled: enabled && column != null,
    select: (rows): ActivityDataPoint[] => {
      if (!column) return [];
      const byDay = new Map<string, number>();
      for (const row of rows) byDay.set(row.entry_date, Number(row[column]));

      const points: ActivityDataPoint[] = [];
      for (let index = 0; index < days; index += 1) {
        const day = addDays(today, -(days - 1 - index));
        points.push({ day, value: byDay.get(day) ?? 0 });
      }
      return points;
    },
  });

  useRefetchOnFocus(query.refetch, enabled);

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
