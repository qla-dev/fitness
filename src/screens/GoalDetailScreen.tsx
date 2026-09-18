import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActivityMetricChart from '../components/ActivityMetricChart';
import Icon from '../components/Icon';
import SegmentedControl from '../components/SegmentedControl';
import SleepTimelineChart from '../components/SleepTimelineChart';
import StepsBarChart from '../components/StepsBarChart';
import WaterBarChart from '../components/WaterBarChart';
import WeightLineChart from '../components/WeightLineChart';
import {
  useDailySummary,
  useHealthTrends,
  useMeasurements,
  usePreferences,
} from '../hooks';
import { useSleepDay } from '../hooks/useSleepDay';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { formatLocalizedNumber, getAppLocale } from '../localization';
import {
  activityGoalByKey,
  ACTIVITY_GOALS,
  type ActivityGoalInputs,
  type ActivityGoalKey,
} from '../constants/activityGoals';
import {
  HEALTH_TREND_LABELS,
  HEALTH_TREND_KEYS,
  type HealthTrendKey,
} from '../constants/healthTrends';
import { weightFromKg } from '../utils/unitConversions';
import { buildHourlyExerciseMinutes } from '../utils/hourlyActivity';
import { formatSleepDuration } from '../utils/sleepDay';
import { formatDateLabel } from '../utils/dateUtils';
import type { HealthTrendDateRange } from '../types/healthTrends';
import type { RootStackScreenProps } from '../types/navigation';

type GoalDetailScreenProps = RootStackScreenProps<'GoalDetail'>;
type IconName = React.ComponentProps<typeof Icon>['name'];

const isActivityKey = (metric: string): metric is ActivityGoalKey =>
  ACTIVITY_GOALS.some((goal) => goal.key === metric);
const isTrendKey = (metric: string): metric is HealthTrendKey =>
  (HEALTH_TREND_KEYS as readonly string[]).includes(metric);

/** Chrome for the two metrics that exist only as trends. */
const TREND_CHROME: Record<HealthTrendKey, { icon: IconName; color: string }> =
  {
    steps: { icon: 'exercise-walking', color: '#00BFCF' },
    weight: { icon: 'scale', color: '#D844ED' },
    sleep: { icon: 'sleep-bedtime', color: '#807AFF' },
    water: { icon: 'hydration', color: '#2FA8F5' },
  };

/**
 * One goal, whichever list you came from.
 *
 * Steps appears on the Activities screen as today's count against a target and
 * on the Goals screen as a history, and opening it used to land on two
 * different screens depending on which card you tapped. It is one thing, so it
 * is one screen: today's figure first, then the history under it. A metric
 * simply omits the half it has no source for — Move has no chart, weight has
 * no daily target — rather than getting a screen of its own.
 */
export default function GoalDetailScreen({ route }: GoalDetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { metric, date } = route.params;
  const [range, setRange] = useState<HealthTrendDateRange>('7d');

  const activity = isActivityKey(metric) ? activityGoalByKey(metric) : null;
  const trend = isTrendKey(metric) ? metric : null;

  const { summary, isLoading } = useDailySummary({ date });
  const { measurements } = useMeasurements({ date });
  const { preferences } = usePreferences();
  const { wakeUp } = useSleepDay(date);
  // Only the trend this screen shows is fetched; the other two stay idle.
  const trends = useHealthTrends({
    range,
    enabled: trend !== null,
    activeTrends: trend ? [trend] : [],
  });

  const weightUnit =
    (preferences?.default_weight_unit ?? 'kg') === 'kg' ? 'kg' : 'lbs';
  const weightSeries = useMemo(
    () =>
      weightUnit === 'kg'
        ? trends.weight
        : {
            ...trends.weight,
            data: trends.weight.data.map((point) => ({
              ...point,
              weight: weightFromKg(point.weight, weightUnit),
            })),
          },
    [trends.weight, weightUnit]
  );

  const hourlyExercise = useMemo(
    () => buildHourlyExerciseMinutes(summary?.exerciseEntries),
    [summary?.exerciseEntries]
  );

  const chrome = activity
    ? { icon: activity.icon, color: activity.color }
    : TREND_CHROME[trend ?? 'steps'];
  const title = activity
    ? activity.label(t)
    : HEALTH_TREND_LABELS[trend ?? 'steps'](t);

  const header = useScreenHeader({
    left: { kind: 'back' },
    nativeTitle: title,
  });

  /**
   * Today's figure. Activity metrics read it off the day's summary; weight and
   * sleep have no goal but still have a reading, and a screen that opened
   * straight onto a 90-day chart never answered "what about today".
   */
  const today = (() => {
    if (activity && summary) {
      const inputs: ActivityGoalInputs = {
        summary,
        steps: measurements?.steps,
        // No source on this side yet, the same as the Activities cards.
        distance: undefined,
        standHours: undefined,
        standGoal: summary.goals.stand_hours,
        stepsGoal: summary.goals.steps,
        distanceUnit:
          (preferences?.default_distance_unit as 'km' | 'miles') ?? 'km',
      };
      const value = activity.value(inputs);
      return {
        text: formatLocalizedNumber(value, {
          maximumFractionDigits: activity.precision,
        }),
        unit: activity.unit(t, inputs),
        value,
        goal: activity.goal(inputs),
      };
    }
    if (trend === 'weight') {
      const kg = measurements?.weight;
      if (kg == null) return null;
      const shown = weightFromKg(kg, weightUnit) ?? kg;
      return {
        text: formatLocalizedNumber(shown, { maximumFractionDigits: 1 }),
        unit: weightUnit,
        value: shown,
        goal: 0,
      };
    }
    if (trend === 'sleep' && wakeUp) {
      const seconds =
        wakeUp.time_asleep_in_seconds ?? wakeUp.duration_in_seconds;
      return {
        text: formatSleepDuration(seconds, t),
        unit: '',
        value: seconds ?? 0,
        goal: 0,
      };
    }
    return null;
  })();

  // Capped at 100: a bar running past its track says nothing the number above
  // it has not already said.
  const percent =
    today && today.goal > 0
      ? Math.min(100, Math.round((today.value / today.goal) * 100))
      : 0;

  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4">
          <View className="flex-row items-center gap-2">
            <Icon name={chrome.icon} size={22} color={chrome.color} />
            <Text className="text-text-primary text-3xl font-bold">
              {title}
            </Text>
          </View>
          <Text
            testID="goal-detail-subtitle"
            className="text-text-secondary text-base mt-1"
          >
            {formatDateLabel(date, t, getAppLocale())}
          </Text>
        </View>

        {isLoading && !today ? (
          <ActivityIndicator className="mt-4" />
        ) : today ? (
          <View
            testID="goal-detail-summary"
            className="bg-surface rounded-xl p-4 mb-3"
          >
            <Text className="text-sm text-text-muted">
              {t('goalDetail.today', { defaultValue: 'Today' })}
            </Text>
            <View className="flex-row items-end gap-2 mt-1">
              <Text className="text-4xl font-bold text-text-primary">
                {today.text}
              </Text>
              {today.unit ? (
                <Text className="text-base text-text-secondary mb-1">
                  {today.unit}
                </Text>
              ) : null}
            </View>

            {today.goal > 0 ? (
              <>
                <View
                  className="bg-raised rounded-full overflow-hidden mt-4"
                  style={{ height: 10 }}
                >
                  <View
                    style={{
                      width: `${percent}%`,
                      height: '100%',
                      backgroundColor: chrome.color,
                    }}
                  />
                </View>
                <Text className="text-sm text-text-secondary mt-2">
                  {t('goalDetail.ofGoal', {
                    defaultValue: '{{percent}}% of {{goal}} {{unit}}',
                    percent: formatLocalizedNumber(percent),
                    goal: formatLocalizedNumber(today.goal, {
                      maximumFractionDigits: activity?.precision ?? 0,
                    }),
                    unit: today.unit,
                  })}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        {metric === 'exercise' ? (
          <View className="bg-surface rounded-xl p-4 mb-3">
            <ActivityMetricChart
              title={t('goalDetail.byHour', { defaultValue: 'By hour' })}
              icon={chrome.icon}
              color={chrome.color}
              value={today?.value}
              goal={today?.goal}
              unit={today?.unit ?? ''}
              hourlyValues={hourlyExercise}
            />
          </View>
        ) : null}

        {trend ? (
          <>
            <Text className="text-sm text-text-muted mb-2">
              {t('goalDetail.history', { defaultValue: 'History' })}
            </Text>
            <SegmentedControl<HealthTrendDateRange>
              segments={[
                { key: '7d', label: t('ranges.7d', { defaultValue: '7d' }) },
                { key: '30d', label: t('ranges.30d', { defaultValue: '30d' }) },
                { key: '90d', label: t('ranges.90d', { defaultValue: '90d' }) },
              ]}
              activeKey={range}
              onSelect={setRange}
            />
            <View className="bg-surface rounded-3xl p-4 mt-3">
              {trend === 'steps' ? (
                <StepsBarChart {...trends.steps} range={range} />
              ) : trend === 'weight' ? (
                <WeightLineChart
                  {...weightSeries}
                  range={range}
                  unit={weightUnit}
                />
              ) : trend === 'water' ? (
                <WaterBarChart {...trends.water} range={range} />
              ) : (
                <SleepTimelineChart {...trends.sleep} range={range} />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
