import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StepsBarChart from './StepsBarChart';
import { formatLocalizedNumber } from '../localization';
import type { WaterDataPoint } from '../hooks/useWaterRange';
import type { HealthTrendDateRange } from '../types/healthTrends';

/**
 * Hydration as one bar per day.
 *
 * The same chart the step count uses, which is the point: a daily total in
 * millilitres and a daily total in steps are the same shape of thing, and
 * drawing them twice would have meant two tooltips, two empty states and two
 * sets of touch handling to keep in step. Only the copy differs.
 */
export default function WaterBarChart({
  data,
  isLoading,
  isError,
  range,
  color,
  bare,
}: {
  data: WaterDataPoint[];
  isLoading: boolean;
  isError: boolean;
  range: HealthTrendDateRange;
  color?: string;
  bare?: boolean;
}) {
  const { t } = useTranslation();

  // `steps` names the axis the chart reads, not what is being counted.
  const points = useMemo(
    () => data.map((point) => ({ day: point.day, steps: point.waterMl })),
    [data]
  );

  const labels = useMemo(
    () => ({
      title: t('charts.water.title', { defaultValue: 'Water' }),
      loadFailed: t('charts.water.loadFailed', {
        defaultValue: 'Failed to load hydration data',
      }),
      empty: t('charts.water.empty', {
        defaultValue: 'No hydration data for this period',
      }),
      tooltip: (value: number) =>
        t('charts.water.tooltip', {
          defaultValue: '{{amount}} ml',
          amount: formatLocalizedNumber(value, { maximumFractionDigits: 0 }),
        }),
    }),
    [t]
  );

  return (
    <StepsBarChart
      data={points}
      isLoading={isLoading}
      isError={isError}
      range={range}
      labels={labels}
      color={color}
      bare={bare}
    />
  );
}
