import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActivityMetricChart from '../components/ActivityMetricChart';
import ActivityTrendChart from '../components/ActivityTrendChart';
import Icon from '../components/Icon';
import TrendRangeSelector from '../components/TrendRangeSelector';
import SleepTimelineChart from '../components/SleepTimelineChart';
import StepsBarChart from '../components/StepsBarChart';
import WaterBarChart from '../components/WaterBarChart';
import WeightLineChart from '../components/WeightLineChart';
import ValueSkeleton from '../components/ValueSkeleton';
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
import { addDays, formatDateLabel } from '../utils/dateUtils';
import { CHART_PLOT_HEIGHT } from '../constants/charts';
import { RANGE_DAYS } from '../types/healthTrends';
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
 * The goal each metric is edited through, for the header's change-goal button.
 *
 * Only the metrics that HAVE a target appear here. Distance is tracked rather
 * than targeted — `ACTIVITY_GOALS` returns 0 for it on purpose — and weight and
 * sleep are readings this screen charts but the app sets no goal for. Those
 * three get no button at all rather than one that opens an editor for nothing.
 *
 * Steps maps once and covers both routes into it: the same key names the
 * activity goal and the trend.
 */
/**
 * How many of the period the headline names fit in each window.
 *
 * The figure over the chart is that period's own total: a week's steps on W, a
 * month's on M, and on the longer windows the average month inside them. Day
 * is not here because a day's figure is the day itself, not a total of
 * anything.
 */
const SUMMARY_PERIODS: Record<HealthTrendDateRange, number> = {
  d: 1,
  w: 1,
  m: 1,
  '6m': 6,
  y: 12,
};

/**
 * Metrics whose headline stays an average of the days rather than a total.
 *
 * A total only means something for a flow — steps taken, water drunk, minutes
 * moved. Weight is a level and sleep is a nightly reading, and adding either up
 * across a window produces a number nobody wants.
 */
const AVERAGED_METRICS = new Set(['weight', 'sleep']);

const GOAL_KEY_BY_METRIC: Record<string, string> = {
  move: 'target_exercise_calories_burned',
  exercise: 'target_exercise_duration_minutes',
  stand: 'stand_hours',
  steps: 'steps',
  water: 'water_goal_ml',
  weight: 'target_weight',
  sleep: 'sleep_goal_hours',
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
export default function GoalDetailScreen({
  navigation,
  route,
}: GoalDetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
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

  // The system bar, not the transparent one: this screen is a plain titled
  // page — back, title, one action — and the transparent variant exists for a
  // screen that carries its own big title in the content, which this no longer
  // does. The title stays in the bar rather than appearing on scroll.
  // A native header button: the hook mirrors `kind: 'icon'` into the native
  // stack's own right-hand items, so UIKit draws it in the bar with its own
  // Liquid Glass capsule, and Android gets the same item in the screen-owned
  // header. Icon alone, no label — the large title beside it already names the
  // goal, so spelling out "Change goal" would say the noun twice.
  //
  // Built in a closure so the key is narrowed to a string before `onPress`
  // captures it, rather than staying `string | undefined` from the lookup.
  const changeGoalAction = (() => {
    const key = GOAL_KEY_BY_METRIC[metric];
    if (!key) return undefined;
    return {
      kind: 'icon' as const,
      sfSymbol: 'target',
      ionicon: 'locate-outline',
      accessibilityLabel: t('goalDetail.changeGoal', {
        defaultValue: 'Change goal',
      }),
      identifier: 'goal-detail-change-goal',
      onPress: () => navigation.navigate('GoalEdit', { goalKey: key }),
    };
  })();

  // The Food dashboard's header, exactly: the transparent variant with the
  // title held in the bar the whole time rather than faded in on scroll. The
  // screen carries no big title of its own, so there is nothing to hand off
  // from and nothing said twice. The scroll view below pairs it with
  // `contentInsetAdjustmentBehavior`, which a transparent bar requires because
  // it reserves no space of its own.
  const header = useScreenHeader({
    variant: 'transparent',
    left: { kind: 'back' },
    title,
    ...(changeGoalAction ? { right: changeGoalAction } : {}),
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

  /**
   * The day broken into hours, where the metric can answer "when".
   *
   * Exercise comes from the logged sessions; the rest from the provider's own
   * breakdown, which the importer attaches beside each day's total. Steps is
   * the newest of them — HealthKit always had the hours, the importer simply
   * never asked for them.
   *
   * Water and weight are absent for different reasons: the diary stores water
   * as a day's total rather than as the pours that made it, and a weight is a
   * reading at a moment, so a bar per hour would be inventing a rate that was
   * never measured.
   */
  const hourlyForMetric =
    metric === 'exercise'
      ? hourlyExercise
      : metric === 'move'
        ? summary?.hourlyMove
        : metric === 'stand'
          ? summary?.hourlyStand
          : metric === 'steps'
            ? summary?.hourlySteps
            : undefined;

  /**
   * Day draws the day, not one bar.
   *
   * A single column labelled with today's weekday says nothing the figure
   * above it has not already said. Where the hours exist they replace it; where
   * they do not, the daily chart stands in and the range still reads correctly.
   */
  const showHourly = range === 'd' && (hourlyForMetric?.length ?? 0) > 0;

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
        // Shown in the same unit as the reading above it, from the kilograms it
        // is stored in. Deliberately NOT fed to the percentage below: a target
        // weight is somewhere you are heading, not a share of a day you have
        // completed, and "117% of 85 kg" would be a boast about missing it.
        goal: 0,
        target:
          summary?.goals.target_weight != null
            ? weightFromKg(summary.goals.target_weight, weightUnit)
            : undefined,
      };
    }
    if (trend === 'sleep' && wakeUp) {
      const seconds =
        wakeUp.time_asleep_in_seconds ?? wakeUp.duration_in_seconds;
      // The goal is set in hours and the reading arrives in seconds, so the
      // comparison happens in seconds — the unit the finer of the two uses.
      const goalHours = summary?.goals.sleep_goal_hours;
      return {
        text: formatSleepDuration(seconds, t),
        unit: '',
        value: seconds ?? 0,
        goal: goalHours != null ? goalHours * 3600 : 0,
      };
    }
    return null;
  })();

  /**
   * The numbers behind whichever chart is on screen.
   *
   * One array rather than five branches further down: every metric plots a
   * value per day, and the only thing that differs is which field carries it.
   */
  const rangeSeries = useMemo<number[]>(() => {
    if (showActivityHistory)
      return activityHistory.data.map((point) => point.value);
    if (trend === 'steps') return trends.steps.data.map((point) => point.steps);
    if (trend === 'weight')
      return weightSeries.data.map((point) => point.weight);
    if (trend === 'water')
      return trends.water.data.map((point) => point.waterMl);
    if (trend === 'sleep')
      return trends.sleep.data.map((night) => night.timeAsleepSeconds ?? 0);
    return [];
  }, [
    showActivityHistory,
    activityHistory.data,
    trend,
    trends.steps.data,
    trends.water.data,
    trends.sleep.data,
    weightSeries.data,
  ]);

  /**
   * What the headline reports, which depends on the range under it.
   *
   * On Day it is the day itself. On any longer range a single day's figure
   * would contradict the chart beside it, so it becomes the DAILY AVERAGE
   * across the window — the same reading the trend cards give, and the one
   * the Health app puts above the same chart.
   *
   * Days with no reading are dropped rather than counted as zero: a week with
   * two weigh-ins averages those two, and a missing day is missing, not a day
   * you weighed nothing.
   */
  // Placeholder rows belong to the previous range; only the chart may use
  // them for its transition, never the selected range's headline.
  const rangeSummaryPending =
    range !== 'd' &&
    (showActivityHistory
      ? activityHistory.isLoading || activityHistory.isPlaceholderData
      : trend !== null &&
        (trends[trend].isLoading || trends.isPlaceholderData));

  const summaryValue = useMemo(() => {
    if (rangeSummaryPending) return undefined;
    if (range === 'd') return today?.value;
    const recorded = rangeSeries.filter((value) => value > 0);
    if (recorded.length === 0) return undefined;
    const total = recorded.reduce((sum, value) => sum + value, 0);
    // Weight is a level, not a flow: a week of weigh-ins summed is not a
    // weight, it is nonsense with a kilogram sign after it. Sleep is the same
    // kind of reading — the useful figure is a night, not a week's worth of
    // nights — so both stay an average of the days that have one.
    if (AVERAGED_METRICS.has(metric)) return total / recorded.length;
    return total / SUMMARY_PERIODS[range];
  }, [range, today?.value, rangeSeries, metric, rangeSummaryPending]);

  /**
   * The headline as text, in whatever shape the metric writes itself. Sleep
   * counts seconds and writes them as hours and minutes; everything else is a
   * number with the metric's own precision.
   */
  const summaryText = useMemo(() => {
    if (summaryValue === undefined) return undefined;
    if (range === 'd') return today?.text;
    if (trend === 'sleep') return formatSleepDuration(summaryValue, t);
    return formatLocalizedNumber(summaryValue, {
      maximumFractionDigits:
        activity?.precision ?? (trend === 'weight' ? 1 : 0),
    });
  }, [summaryValue, range, today?.text, trend, activity?.precision, t]);

  /**
   * What the figure above the chart is, in words.
   *
   * It has to name the same period the figure covers, or the two contradict
   * each other the moment the picker moves: a week's steps under the word
   * "daily" reads as a very good day. Day is the date itself, because on that
   * range the figure is not an average of anything.
   *
   * The metrics that stay a per-day average keep saying so, whatever the
   * window — see AVERAGED_METRICS.
   */
  const summaryLabel = useMemo(() => {
    // On Day the date is already the line under the number, so this says what
    // KIND of figure it is instead of repeating "Today". A flow metric's day
    // is a total; weight and sleep are readings, so theirs is an average.
    if (range === 'd')
      return AVERAGED_METRICS.has(metric)
        ? t('goalDetail.average', { defaultValue: 'Average' })
        : t('goalDetail.total', { defaultValue: 'Total' });
    if (AVERAGED_METRICS.has(metric))
      return t('goalDetail.dailyAverage', { defaultValue: 'Daily average' });
    if (range === 'w')
      return t('goalDetail.weeklyAverage', { defaultValue: 'Weekly average' });
    return t('goalDetail.monthlyAverage', {
      defaultValue: 'Monthly average',
    });
  }, [range, metric, t]);

  /**
   * The window the figure covers, written out under it — one date on Day, and
   * the two ends of the window on anything longer.
   *
   * Without it the headline and the chart disagree silently: "Weekly average"
   * says how the number was made but not which week, and the axis underneath
   * only labels weekdays. The Health app puts the same line in the same place.
   */
  const summaryPeriod = useMemo(() => {
    const locale = getAppLocale();
    if (range === 'd') return formatDateLabel(date, t, locale);
    const first = addDays(date, -(RANGE_DAYS[range] - 1));
    return `${formatDateLabel(first, t, locale)} – ${formatDateLabel(date, t, locale)}`;
  }, [range, date, t]);

  // Capped at 100: a bar running past its track says nothing the number above
  // it has not already said.
  const percent =
    today && today.goal > 0 && summaryValue !== undefined
      ? Math.min(100, Math.round((summaryValue / today.goal) * 100))
      : 0;

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        className="flex-1"
        // No horizontal padding: the card below runs edge to edge, so the
        // padding belongs to the blocks inside it rather than to the page.
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
        showsVerticalScrollIndicator={false}
      >
        {/* One surface, edge to edge: the picker, the number it changes and the
            chart it changes. They were three stacked cards, which drew two
            rules across a screen that is about a single figure — and put the
            picker outside the thing it controls. No corner radius and no side
            padding of its own, so the plot inside can run the full width the
            way the Health app's does. */}
        <View className="bg-surface pb-2 mb-3">
          {trend || showActivityHistory ? (
            <View className="px-4 pt-3 pb-2">
              <TrendRangeSelector range={range} onSelect={setRange} />
            </View>
          ) : null}

          {today || isLoading ? (
            <View testID="goal-detail-summary" className="px-4">
              {/* What the figure is — Today, or the average it stands for.
                  Which days it covers is the line under the number, so this
                  one stays short. */}
              <Text
                testID="goal-detail-subtitle"
                className="text-xs text-text-muted uppercase"
              >
                {summaryLabel}
              </Text>
              <View className="flex-row items-end gap-2">
                <View className="min-h-9 justify-center">
                  {rangeSummaryPending || (isLoading && !today) ? (
                    <ValueSkeleton width={96} height={30} />
                  ) : (
                    <Text className="text-3xl font-bold text-text-primary">
                      {summaryText ?? (range === 'd' ? today?.text : '—')}
                    </Text>
                  )}
                </View>
                {/* The metric's unit where it has one, and its name where it
                    does not: "1,478 Steps" reads the way the Health app writes
                    it, and it is why the charts below drop their own heading —
                    it was saying the same word again, a gap further down. */}
                <Text className="text-sm text-text-secondary mb-1">
                  {today?.unit || title}
                </Text>
              </View>
              <Text className="text-xs text-text-muted mt-0.5">
                {summaryPeriod}
              </Text>

              {today && today.goal > 0 && summaryValue !== undefined ? (
                <>
                  <View
                    className="bg-raised rounded-full overflow-hidden mt-2"
                    style={{ height: 6 }}
                  >
                    <View
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: chrome.color,
                      }}
                    />
                  </View>
                  <Text className="text-xs text-text-secondary mt-1.5">
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

          {trend || showActivityHistory ? (
            // The same gutter as the summary above it, so the plot's left edge
            // lines up with the number rather than sitting a few pixels inside
            // it.
            <View className="px-4">
              {showHourly && hourlyForMetric ? (
                <ActivityMetricChart
                  title=""
                  icon={chrome.icon}
                  color={chrome.color}
                  value={today?.value}
                  goal={today?.goal}
                  unit={today?.unit ?? ''}
                  hourlyValues={hourlyForMetric}
                  binary={metric === 'stand'}
                  showValue={false}
                  // The size, the scale and the box the range charts have, so
                  // tapping D swaps the chart without moving the page.
                  bare
                  plotHeight={CHART_PLOT_HEIGHT}
                  showYAxis
                />
              ) : showActivityHistory ? (
                <ActivityTrendChart
                  metric={metric as ActivityGoalKey}
                  data={activityHistory.data}
                  isLoading={activityHistory.isLoading}
                  isError={activityHistory.isError}
                  range={range}
                  distanceUnit={distanceUnit}
                  bare
                  hideTitle
                />
              ) : trend === 'steps' ? (
                <StepsBarChart
                  {...trends.steps}
                  range={range}
                  color={HEALTH_TREND_COLORS.steps}
                  bare
                  hideTitle
                />
              ) : trend === 'weight' ? (
                <WeightLineChart
                  {...weightSeries}
                  range={range}
                  unit={weightUnit}
                  bare
                  hideTitle
                />
              ) : trend === 'water' ? (
                <WaterBarChart
                  {...trends.water}
                  range={range}
                  color={HEALTH_TREND_COLORS.water}
                  bare
                  hideTitle
                />
              ) : (
                <SleepTimelineChart
                  {...trends.sleep}
                  range={range}
                  bare
                  hideTitle
                />
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
