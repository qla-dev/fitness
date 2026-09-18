import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  HEALTH_TREND_LABELS,
  type HealthTrendKey,
} from '../constants/healthTrends';
import type { SleepTrendSeries } from '../hooks/useHealthTrends';
import type {
  StepsDataPoint,
  WeightDataPoint,
} from '../hooks/useMeasurementsRange';
import type { WaterDataPoint } from '../hooks/useWaterRange';
import { formatLocalizedNumber } from '../localization';
import {
  RANGE_DAYS,
  type HealthTrendDateRange,
  type HealthTrendSeries,
} from '../types/healthTrends';
import { addDays, getTodayDate } from '../utils/dateUtils';
import HealthTrendCard from './HealthTrendCard';

interface DashboardTrendCardsProps {
  steps: HealthTrendSeries<StepsDataPoint>;
  water: HealthTrendSeries<WaterDataPoint>;
  weight: HealthTrendSeries<WeightDataPoint>;
  sleep: SleepTrendSeries;
  range: HealthTrendDateRange;
  weightUnit: 'kg' | 'lbs';
  visibleTrends: readonly HealthTrendKey[];
  /** Opens one trend's own screen, where its chart lives. */
  onOpenTrend: (trend: HealthTrendKey) => void;
}

const averageOf = (values: readonly (number | null)[]) => {
  const recorded = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  return recorded.length
    ? recorded.reduce((sum, value) => sum + value, 0) / recorded.length
    : null;
};

export default function DashboardTrendCards({
  steps,
  water,
  weight,
  sleep,
  range,
  weightUnit,
  visibleTrends,
  onOpenTrend,
}: DashboardTrendCardsProps) {
  const { t } = useTranslation();
  const days = RANGE_DAYS[range];
  const dates = Array.from({ length: days }, (_, index) =>
    addDays(getTodayDate(), index - days + 1)
  );
  const weightValues = dates.map(
    (day) => weight.data.find((point) => point.day === day)?.weight ?? null
  );
  const sleepValues = dates.map((day) => {
    const seconds = sleep.data.find(
      (point) => point.day === day
    )?.timeAsleepSeconds;
    return seconds == null ? null : seconds / 3600;
  });
  const stepValues = dates.map(
    (day) => steps.data.find((point) => point.day === day)?.steps ?? null
  );
  const weightAverage = averageOf(weightValues);
  const sleepAverage = averageOf(sleepValues);
  const stepAverage = averageOf(stepValues);
  const waterValues = dates.map(
    (day) => water.data.find((point) => point.day === day)?.waterMl ?? null
  );
  const waterAverage = averageOf(waterValues);
  const format = (value: number | null, unit?: string, digits = 0) =>
    value == null
      ? '—'
      : formatLocalizedNumber(
          value,
          unit
            ? {
                style: 'unit',
                unit,
                unitDisplay: 'short',
                maximumFractionDigits: digits,
              }
            : { maximumFractionDigits: digits }
        );
  const weightLabel = format(
    weightAverage,
    weightUnit === 'kg' ? 'kilogram' : 'pound',
    2
  );
  const sleepMinutes = Math.round((sleepAverage ?? 0) * 60);
  const sleepLabel =
    sleepAverage == null
      ? '—'
      : `${format(Math.floor(sleepMinutes / 60), 'hour')} ${format(sleepMinutes % 60, 'minute')}`;
  const stepLabel = format(stepAverage);
  const waterLabel =
    waterAverage == null
      ? '—'
      : t('charts.water.tooltip', {
          defaultValue: '{{amount}} ml',
          amount: formatLocalizedNumber(waterAverage, {
            maximumFractionDigits: 0,
          }),
        });
  const cards: Record<HealthTrendKey, ReactElement> = {
    sleep: (
      <HealthTrendCard
        title={HEALTH_TREND_LABELS.sleep(t)}
        icon="sleep-bedtime"
        color="#807AFF"
        days={days}
        description={t('dashboard.trendSleepSummary', {
          defaultValue: 'Your average recorded sleep was {{value}} per night.',
          value: sleepLabel,
        })}
        average={sleepAverage}
        averageLabel={sleepLabel}
        values={sleepValues}
        isLoading={sleep.isLoading}
        isError={sleep.isError}
        onOpen={() => onOpenTrend('sleep')}
      />
    ),
    weight: (
      <HealthTrendCard
        title={HEALTH_TREND_LABELS.weight(t)}
        icon="scale"
        color="#D844ED"
        days={days}
        description={t('dashboard.trendWeightSummary', {
          defaultValue: 'Your average recorded weight was {{value}}.',
          value: weightLabel,
        })}
        average={weightAverage}
        averageLabel={weightLabel}
        values={weightValues}
        line
        isLoading={weight.isLoading}
        isError={weight.isError}
        onOpen={() => onOpenTrend('weight')}
      />
    ),
    steps: (
      <HealthTrendCard
        title={HEALTH_TREND_LABELS.steps(t)}
        icon="exercise-walking"
        color="#00BFCF"
        days={days}
        description={t('dashboard.trendStepsSummary', {
          defaultValue:
            'Your daily step average for this period was {{value}}.',
          value: stepLabel,
        })}
        average={stepAverage}
        averageLabel={stepLabel}
        values={stepValues}
        isLoading={steps.isLoading}
        isError={steps.isError}
        onOpen={() => onOpenTrend('steps')}
      />
    ),
    water: (
      <HealthTrendCard
        title={HEALTH_TREND_LABELS.water(t)}
        icon="hydration"
        color="#2FA8F5"
        days={days}
        description={t('dashboard.trendWaterSummary', {
          defaultValue: 'You drank {{value}} a day on average.',
          value: waterLabel,
        })}
        average={waterAverage}
        averageLabel={waterLabel}
        values={waterValues}
        isLoading={water.isLoading}
        isError={water.isError}
        onOpen={() => onOpenTrend('water')}
      />
    ),
  };
  if (!visibleTrends.length)
    return (
      <Text className="text-text-muted text-base p-4">
        {t('charts.allTrendsHidden', {
          defaultValue:
            'All graphs are hidden. Choose which to show in Activities Settings.',
        })}
      </Text>
    );
  return (
    <View className="mt-3">
      {visibleTrends.map((key) => (
        <View key={key}>{cards[key]}</View>
      ))}
    </View>
  );
}
