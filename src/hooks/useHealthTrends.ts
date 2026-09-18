import { useCallback } from 'react';
import type { HealthTrendKey } from '../constants/healthTrends';
import type {
  HealthTrendDateRange,
  HealthTrendSeries,
} from '../types/healthTrends';
import type { SleepTimelineDay, SleepTimelineSummary } from '../types/sleep';
import {
  useMeasurementsRange,
  type StepsDataPoint,
  type WeightDataPoint,
} from './useMeasurementsRange';
import { useSleepRange } from './useSleepRange';
import { useWaterRange, type WaterDataPoint } from './useWaterRange';

interface UseHealthTrendsOptions {
  range: HealthTrendDateRange;
  enabled?: boolean;
  activeTrends: readonly HealthTrendKey[];
}

/**
 * The sleep page needs more than a series: its headline tiles show window averages, and
 * `nightsWithData` is what decides whether the page appears at all — `data` is padded to
 * one entry per day and so is never empty.
 */
export type SleepTrendSeries = HealthTrendSeries<SleepTimelineDay> &
  Omit<SleepTimelineSummary, 'days'>;

interface HealthTrends {
  steps: HealthTrendSeries<StepsDataPoint>;
  weight: HealthTrendSeries<WeightDataPoint>;
  sleep: SleepTrendSeries;
  water: HealthTrendSeries<WaterDataPoint>;
  refetch: () => Promise<void>;
}

/**
 * Every series behind the dashboard's Health Trends pager, from one call.
 */
export function useHealthTrends({
  range,
  enabled = true,
  activeTrends,
}: UseHealthTrendsOptions): HealthTrends {
  const isMeasurementsEnabled =
    enabled &&
    (activeTrends.includes('steps') || activeTrends.includes('weight'));
  const isSleepEnabled = enabled && activeTrends.includes('sleep');
  const isWaterEnabled = enabled && activeTrends.includes('water');

  const {
    stepsData,
    weightData,
    isLoading: isMeasurementsLoading,
    isError: isMeasurementsError,
    refetch: refetchMeasurements,
  } = useMeasurementsRange({ range, enabled: isMeasurementsEnabled });

  const {
    sleep,
    isLoading: isSleepLoading,
    isError: isSleepError,
    refetch: refetchSleep,
  } = useSleepRange({ range, enabled: isSleepEnabled });

  const {
    waterData,
    isLoading: isWaterLoading,
    isError: isWaterError,
    refetch: refetchWater,
  } = useWaterRange({ range, enabled: isWaterEnabled });

  const refetch = useCallback(async () => {
    await Promise.all([
      isMeasurementsEnabled ? refetchMeasurements() : Promise.resolve(),
      isSleepEnabled ? refetchSleep() : Promise.resolve(),
      isWaterEnabled ? refetchWater() : Promise.resolve(),
    ]);
  }, [
    isMeasurementsEnabled,
    isSleepEnabled,
    isWaterEnabled,
    refetchMeasurements,
    refetchSleep,
    refetchWater,
  ]);

  return {
    // Steps and weight share one request, so they necessarily share its fetch state.
    steps: {
      data: stepsData,
      isLoading: isMeasurementsLoading,
      isError: isMeasurementsError,
    },
    weight: {
      data: weightData,
      isLoading: isMeasurementsLoading,
      isError: isMeasurementsError,
    },
    sleep: {
      data: sleep.days,
      averageTimeInBedSeconds: sleep.averageTimeInBedSeconds,
      averageTimeAsleepSeconds: sleep.averageTimeAsleepSeconds,
      nightsWithData: sleep.nightsWithData,
      isLoading: isSleepLoading,
      isError: isSleepError,
    },
    water: {
      data: waterData,
      isLoading: isWaterLoading,
      isError: isWaterError,
    },
    refetch,
  };
}
