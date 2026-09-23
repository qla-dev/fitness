import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchWaterRange } from '../services/api/measurementsApi';
import { waterRangeQueryKey } from './queryKeys';
import { RANGE_DAYS, type HealthTrendDateRange } from '../types/healthTrends';
import { addDays, getTodayDate } from '../utils/dateUtils';

export type WaterDataPoint = {
  day: string;
  waterMl: number;
};

/** The empty series as one array, not a fresh one per render — see `useMeasurementsRange`. */
const EMPTY_WATER: WaterDataPoint[] = [];

interface UseWaterRangeOptions {
  range: HealthTrendDateRange;
  enabled?: boolean;
}

/**
 * Daily hydration totals across a window, for the water trend.
 *
 * Padded to one point per day rather than returning only the days with an
 * entry: a bar chart's gaps are the story — a day nobody drank on is a real
 * zero, and a series that simply omits it draws a narrower week instead.
 */
export function useWaterRange({ range, enabled = true }: UseWaterRangeOptions) {
  const today = getTodayDate();
  const days = RANGE_DAYS[range];
  const startDate = addDays(today, -(days - 1));

  const query = useQuery({
    queryKey: waterRangeQueryKey(startDate, today),
    // The previous range stays on screen while the next one loads, which is
    // what lets the chart morph rather than cut. Without it the query has no
    // rows for a new key, the chart unmounts for its loading state, and the
    // bars it would have animated between never share a mounted chart.
    placeholderData: keepPreviousData,
    queryFn: () => fetchWaterRange(startDate, today),
    enabled,
    select: (rows): WaterDataPoint[] => {
      const byDay = new Map(
        rows.map((row) => [row.entry_date, Number(row.water_ml) || 0])
      );
      return Array.from({ length: days }, (_, index) => {
        const day = addDays(today, index - days + 1);
        return { day, waterMl: byDay.get(day) ?? 0 };
      });
    },
  });

  return {
    waterData: query.data ?? EMPTY_WATER,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
