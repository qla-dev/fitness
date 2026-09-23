import { useQuery } from '@tanstack/react-query';
import type { ActivityGoalKey } from '../constants/activityGoals';
import type { HealthTrendKey } from '../constants/healthTrends';
import {
  fetchActivityRange,
  fetchMeasurementsRange,
  fetchWaterRange,
} from '../services/api/measurementsApi';
import { fetchSleepEntries } from '../services/api/sleepApi';
import {
  activityRangeQueryKey,
  measurementsRangeQueryKey,
  sleepRangeQueryKey,
  waterRangeQueryKey,
} from './queryKeys';
import { buildSleepTimelineSummary } from './useSleepRange';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import { usePreferences } from './usePreferences';
import { addDays } from '../utils/dateUtils';
import type { GoalFactPoint } from '../utils/goalFacts';
import { distanceFromKm, weightFromKg } from '../utils/unitConversions';

/** Fixed fact windows are independent of the main chart's selected range. */
export function useGoalFactHistory(
  metric: ActivityGoalKey | HealthTrendKey,
  date: string,
  weightUnit: 'kg' | 'lbs',
  distanceUnit: 'km' | 'miles'
) {
  const { preferences } = usePreferences();
  const start =
    metric === 'steps'
      ? `${Number(date.slice(0, 4)) - 1}-01-01`
      : addDays(date, -27);
  const measurements = useQuery({
    queryKey: measurementsRangeQueryKey(start, date),
    queryFn: () => fetchMeasurementsRange(start, date),
    enabled: metric === 'steps' || metric === 'weight',
  });
  const activity = useQuery({
    queryKey: activityRangeQueryKey(start, date),
    queryFn: () => fetchActivityRange(start, date),
    enabled: ['move', 'exercise', 'stand', 'distance'].includes(metric),
  });
  const water = useQuery({
    queryKey: waterRangeQueryKey(start, date),
    queryFn: () => fetchWaterRange(start, date),
    enabled: metric === 'water',
  });
  const sleep = useQuery({
    queryKey: sleepRangeQueryKey(start, date),
    queryFn: () => fetchSleepEntries(start, date),
    enabled: metric === 'sleep',
  });
  const query =
    metric === 'steps' || metric === 'weight'
      ? measurements
      : metric === 'water'
        ? water
        : metric === 'sleep'
          ? sleep
          : activity;
  useRefetchOnFocus(query.refetch, true);
  let points: GoalFactPoint[] = [];
  if (metric === 'steps' || metric === 'weight') {
    const byDay = new Map<string, GoalFactPoint>();
    for (const row of [...(measurements.data ?? [])].sort((a, b) =>
      String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
    )) {
      const value =
        metric === 'steps'
          ? row.steps
          : row.weight == null
            ? null
            : weightFromKg(row.weight, weightUnit);
      if (value != null && Number.isFinite(value) && !byDay.has(row.entry_date))
        byDay.set(row.entry_date, {
          day: row.entry_date,
          value,
          hourly: row.hourly_steps,
        });
    }
    points = [...byDay.values()];
  } else if (metric === 'water') {
    points = (water.data ?? []).map((p) => ({
      day: p.entry_date,
      value: p.water_ml,
    }));
  } else if (metric === 'sleep') {
    points = buildSleepTimelineSummary(
      sleep.data ?? [],
      date,
      28,
      preferences?.timezone
    ).days.flatMap((p) =>
      p.timeAsleepSeconds == null
        ? []
        : [{ day: p.day, value: p.timeAsleepSeconds }]
    );
  } else {
    points = (activity.data ?? []).map((p) => ({
      day: p.entry_date,
      value:
        metric === 'move'
          ? p.active_calories
          : metric === 'exercise'
            ? p.exercise_minutes
            : metric === 'stand'
              ? p.stand_hours
              : distanceFromKm(p.distance_m / 1000, distanceUnit),
    }));
  }
  return {
    points: points.sort((a, b) => a.day.localeCompare(b.day)),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
