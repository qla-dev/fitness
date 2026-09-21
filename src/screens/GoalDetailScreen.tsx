import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActivityMetricChart from '../components/ActivityMetricChart';
import ActivityTrendChart from '../components/ActivityTrendChart';
import Icon from '../components/Icon';
import TrendRangeSelector from '../components/TrendRangeSelector';
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
import {
  useActivityRange,
  hasActivityHistory,
} from '../hooks/useActivityRange';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
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
  HEALTH_TREND_COLORS,
  type HealthTrendKey,
} from '../constants/healthTrends';
import { distanceFromKm, weightFromKg } from '../utils/unitConversions';
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
    steps: { icon: 'exercise-walking', color: HEALTH_TREND_COLORS.steps },
    weight: { icon: 'scale', color: HEALTH_TREND_COLORS.weight },
    sleep: { icon: 'sleep-bedtime', color: HEALTH_TREND_COLORS.sleep },
    water: { icon: 'hydration', color: HEALTH_TREND_COLORS.water },
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
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const { metric, date } = route.params;
  const [range, setRange] = useState<HealthTrendDateRange>('w');

  const activity = isActivityKey(metric) ? activityGoalByKey(metric) : null;
  const trend = isTrendKey(metric) ? metric : null;

  // Steps keeps its long-standing measurements-range history; the other four
  // Activities metrics read theirs from the day rows the local layer folds for
  // them, so a history can never disagree with the number above it.
  const activityHistory = useActivityRange({
    metric: metric as ActivityGoalKey,
    range,
    enabled: activity != null && hasActivityHistory(metric as ActivityGoalKey),
  });

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

  const showActivityHistory =
    activity != null && hasActivityHistory(metric as ActivityGoalKey);

  const chrome = activity
    ? { icon: activity.icon, color: activity.color }
    : TREND_CHROME[trend ?? 'steps'];
  const title = activity
    ? activity.label(t)
    : HEALTH_TREND_LABELS[trend ?? 'steps'](t);

  // Same header as the Profile screen: transparent, so iOS 26 puts no glass
  // over the content, and the title is handed to the bar by hand once the
  // content has scrolled under it.
  const header = useScreenHeader({
    variant: 'transparent',
    left: { kind: 'back' },
    nativeTitle: showHeaderTitle ? title : '',
    borderless: true,
  });

  /**
   * Today's figure. Activity metrics read it off the day's summary; weight and
   * sleep have no goal but still have a reading, and a screen that opened
   * straight onto a 90-day chart never answered "what about today".
   */
  // Metres on the check-in row, the user's own unit on screen — the same
  // conversion the Activities card makes, against the same stored field.
  const distanceUnit =
    (preferences?.default_distance_unit as 'km' | 'miles') ?? 'km';
  const dayDistance = (() => {
    const metres = measurements?.distance_m;
    if (metres == null || !Number.isFinite(Number(metres))) return undefined;
    return distanceFromKm(Number(metres) / 1000, distanceUnit);
  })();

  // Three metrics can answer "when in the day", each from its own source:
  // exercise from the logged sessions, the other two from the provider's own
  // breakdown. The rest have no hourly meaning and show no chart at all.
  const hourlyForMetric =
    metric === 'exercise'
      ? hourlyExercise
      : metric === 'move'
        ? summary?.hourlyMove
        : metric === 'stand'
          ? summary?.hourlyStand
          : undefined;

  const today = (() => {
    if (activity && summary) {
      const inputs: ActivityGoalInputs = {
        summary,
        steps: measurements?.steps,
        distance: dayDistance,
        standHours: measurements?.stand_hours,
        standGoal: summary.goals.stand_hours,
        stepsGoal: summary.goals.steps,
        distanceUnit,
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
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const offset =
            nativeEvent.contentOffset.y + nativeEvent.contentInset.top;
          setShowHeaderTitle(offset > 16);
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4">
          <View className="flex-row items-center gap-2">
            <Icon name={chrome.icon} size={22} color={chrome.color} />
            <Text className="text-text-primary text-3xl font-bold">
              {title}
            </Text>
          </View>
          {/* The picker sits where the date used to, the way the Health app
              puts its own under the title. The date has not been dropped — it
              moved into the summary card below, which is the thing that is
              actually about one day. */}
          {trend || showActivityHistory ? (
            <View className="mt-3">
              <TrendRangeSelector range={range} onSelect={setRange} />
            </View>
          ) : null}
        </View>

        {isLoading && !today ? (
          <ActivityIndicator className="mt-4" />
        ) : today ? (
          <View
            testID="goal-detail-summary"
            className="bg-surface rounded-xl p-4 mb-3"
          >
            {/* The date, not the word "Today": this screen opens on whichever
                day you came from, so a fixed label contradicted the header on
                every day but one. */}
            <Text
              testID="goal-detail-subtitle"
              className="text-sm text-text-muted"
            >
              {formatDateLabel(date, t, getAppLocale())}
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

        {hourlyForMetric ? (
          <View className="bg-surface rounded-xl p-4 mb-3">
            <ActivityMetricChart
              title={t('goalDetail.byHour', { defaultValue: 'By hour' })}
              icon={chrome.icon}
              color={chrome.color}
              value={today?.value}
              goal={today?.goal}
              unit={today?.unit ?? ''}
              hourlyValues={hourlyForMetric}
              binary={metric === 'stand'}
              showValue={false}
            />
          </View>
        ) : null}

        {trend || showActivityHistory ? (
          <>
            {/* Bare: on this screen the chart is the content, so it sits in
                the body under the screen's own padding rather than inside a
                card of its own. The dashboard still boxes them, where a chart
                is one card among several. */}
            {showActivityHistory ? (
              <ActivityTrendChart
                metric={metric as ActivityGoalKey}
                data={activityHistory.data}
                isLoading={activityHistory.isLoading}
                isError={activityHistory.isError}
                range={range}
                distanceUnit={distanceUnit}
                bare
              />
            ) : trend === 'steps' ? (
              <StepsBarChart
                {...trends.steps}
                range={range}
                color={HEALTH_TREND_COLORS.steps}
                bare
              />
            ) : trend === 'weight' ? (
              <WeightLineChart
                {...weightSeries}
                range={range}
                unit={weightUnit}
                bare
              />
            ) : trend === 'water' ? (
              <WaterBarChart
                {...trends.water}
                range={range}
                color={HEALTH_TREND_COLORS.water}
                bare
              />
            ) : (
              <SleepTimelineChart {...trends.sleep} range={range} bare />
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
