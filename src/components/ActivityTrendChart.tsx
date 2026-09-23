import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StepsBarChart from './StepsBarChart';
import { formatLocalizedNumber } from '../localization';
import type { ActivityDataPoint } from '../hooks/useActivityRange';
import {
  activityGoalByKey,
  type ActivityGoalKey,
} from '../constants/activityGoals';
import type { HealthTrendDateRange } from '../types/healthTrends';

/**
 * One activity metric's daily history, as one bar per day.
 *
 * The same chart steps and hydration already use — a daily total is a daily
 * total, whether it is counted in kcal, minutes, hours or metres, and drawing
 * four more of them would have meant four more tooltips and empty states to
 * keep in step. Only the copy and the unit differ.
 */
export default function ActivityTrendChart({
  metric,
  data,
  isLoading,
  isError,
  range,
  distanceUnit,
  bare,
  hideTitle,
}: {
  metric: ActivityGoalKey;
  data: ActivityDataPoint[];
  isLoading: boolean;
  isError: boolean;
  range: HealthTrendDateRange;
  /** Only read for distance, which is the one metric stored in another unit. */
  distanceUnit?: 'km' | 'miles';
  bare?: boolean;
  /** Forwarded: the goal screen names the metric beside its value. */
  hideTitle?: boolean;
}) {
  const { t } = useTranslation();

  // Metres on the row, the user's own unit on the chart — the conversion has
  // to happen before the bars are drawn or the axis would be labelled in one
  // unit and the tooltip in another. Distance is the only metric stored in
  // anything but the unit it is shown in, so everything else divides by one.
  const divisor =
    metric !== 'distance' ? 1 : distanceUnit === 'miles' ? 1609.344 : 1000;

  // `steps` names the axis the chart reads, not what is being counted.
  const points = useMemo(
    () =>
      data.map((point) => ({ day: point.day, steps: point.value / divisor })),
    [data, divisor]
  );

  const labels = useMemo(() => {
    const amount = (value: number, digits: number) =>
      formatLocalizedNumber(value, { maximumFractionDigits: digits });
    const forMetric = {
      move: {
        title: t('charts.move.title', { defaultValue: 'Move' }),
        loadFailed: t('charts.move.loadFailed', {
          defaultValue: 'Failed to load move data',
        }),
        empty: t('charts.move.empty', {
          defaultValue: 'No move data for this period',
        }),
        tooltip: (value: number) =>
          t('charts.move.tooltip', {
            defaultValue: '{{amount}} kcal',
            amount: amount(value, 0),
          }),
      },
      exercise: {
        title: t('charts.exercise.title', { defaultValue: 'Exercise' }),
        loadFailed: t('charts.exercise.loadFailed', {
          defaultValue: 'Failed to load exercise data',
        }),
        empty: t('charts.exercise.empty', {
          defaultValue: 'No exercise data for this period',
        }),
        tooltip: (value: number) =>
          t('charts.exercise.tooltip', {
            defaultValue: '{{amount}} min',
            amount: amount(value, 0),
          }),
      },
      stand: {
        title: t('charts.stand.title', { defaultValue: 'Stand' }),
        loadFailed: t('charts.stand.loadFailed', {
          defaultValue: 'Failed to load stand data',
        }),
        empty: t('charts.stand.empty', {
          defaultValue: 'No stand data for this period',
        }),
        tooltip: (value: number) =>
          t('charts.stand.tooltip', {
            defaultValue: '{{amount}} h',
            amount: amount(value, 0),
          }),
      },
      distance: {
        title: t('charts.distance.title', { defaultValue: 'Distance' }),
        loadFailed: t('charts.distance.loadFailed', {
          defaultValue: 'Failed to load distance data',
        }),
        empty: t('charts.distance.empty', {
          defaultValue: 'No distance data for this period',
        }),
        tooltip: (value: number) =>
          distanceUnit === 'miles'
            ? t('charts.distance.tooltipMiles', {
                defaultValue: '{{amount}} mi',
                amount: amount(value, 2),
              })
            : t('charts.distance.tooltipKm', {
                defaultValue: '{{amount}} km',
                amount: amount(value, 2),
              }),
      },
    } as const;
    return forMetric[metric as keyof typeof forMetric];
  }, [metric, t, distanceUnit]);

  if (!labels) return null;

  return (
    <StepsBarChart
      data={points}
      isLoading={isLoading}
      hideTitle={hideTitle}
      isError={isError}
      range={range}
      labels={labels}
      color={activityGoalByKey(metric)?.color}
      bare={bare}
    />
  );
}
