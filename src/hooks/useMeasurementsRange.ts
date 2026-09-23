import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMeasurementsRange } from '../services/api/measurementsApi';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import { measurementsRangeQueryKey } from './queryKeys';
import { getTodayDate, addDays } from '../utils/dateUtils';
import { RANGE_DAYS, type HealthTrendDateRange } from '../types/healthTrends';

export type StepsDataPoint = {
  day: string;
  steps: number;
};

export type WeightDataPoint = {
  day: string;
  weight: number;
};

/**
 * The empty series, as one array rather than a fresh one per render.
 *
 * `?? []` looks harmless and is not: while the query is loading it hands every
 * render a new array, and everything downstream keys on identity — the charts'
 * tooltip reset, their `useMemo`s, and `useChartRise`, which cancelled and
 * rescheduled its reveal on every render and so never revealed anything. The
 * chart sat empty under a correctly scaled axis until you left the screen and
 * came back, because only then was the data cached and the identity stable from
 * the first render. `useSleepRange` has always returned a constant for this.
 */
const EMPTY_STEPS: StepsDataPoint[] = [];
const EMPTY_WEIGHT: WeightDataPoint[] = [];

interface UseMeasurementsRangeOptions {
  range: HealthTrendDateRange;
  enabled?: boolean;
}

export function useMeasurementsRange({
  range,
  enabled = true,
}: UseMeasurementsRangeOptions) {
  const today = getTodayDate();
  const days = RANGE_DAYS[range];
  const startDate = addDays(today, -(days - 1));

  const query = useQuery({
    queryKey: measurementsRangeQueryKey(startDate, today),
    // The previous range stays on screen while the next one loads, which is
    // what lets the chart morph rather than cut. Without it the query has no
    // rows for a new key, the chart unmounts for its loading state, and the
    // bars it would have animated between never share a mounted chart.
    placeholderData: keepPreviousData,
    queryFn: () => fetchMeasurementsRange(startDate, today),
    enabled,
    select: (data) => {
      const stepsMap = new Map<string, number>();
      const weightMap = new Map<string, number>();

      // API returns DESC by updated_at — first entry per date is the most recent
      for (const entry of data) {
        if (!stepsMap.has(entry.entry_date)) {
          stepsMap.set(entry.entry_date, entry.steps ?? 0);
        }
        if (
          !weightMap.has(entry.entry_date) &&
          entry.weight != null &&
          entry.weight > 0
        ) {
          weightMap.set(entry.entry_date, entry.weight);
        }
      }

      const stepsData: StepsDataPoint[] = [];
      const weightData: WeightDataPoint[] = [];

      // Fill all days in range, chronologically ascending
      for (let i = 0; i < days; i++) {
        const day = addDays(today, -(days - 1 - i));
        stepsData.push({ day, steps: stepsMap.get(day) ?? 0 });
        const weight = weightMap.get(day);
        if (weight != null) {
          weightData.push({ day, weight });
        }
      }

      return { stepsData, weightData };
    },
  });

  useRefetchOnFocus(query.refetch, enabled);

  return {
    stepsData: query.data?.stepsData ?? EMPTY_STEPS,
    weightData: query.data?.weightData ?? EMPTY_WEIGHT,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
