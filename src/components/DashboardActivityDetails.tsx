import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { formatLocalizedNumber } from '../localization';
import type { DailySummary } from '../types/dailySummary';
import ActivityMetricChart from './ActivityMetricChart';
import CardChevron from './CardChevron';
import Icon from './Icon';
import { formatCompactCount } from '../utils/compactNumber';
import type { ActivityGoalKey } from '../constants/activityGoals';

interface DashboardActivityDetailsProps {
  summary: DailySummary;
  steps?: number | null;
  distance?: number | null;
  distanceUnit: 'km' | 'miles';
  standHours?: number | null;
  standGoal?: number;
  /** Daily step target; the tile drops the denominator when none is set. */
  stepsGoal?: number;
  hourlyMove?: readonly (number | null)[];
  hourlyExercise?: readonly (number | null)[];
  hourlyStand?: readonly (number | null)[];
  /** Opens one metric's own screen. Every block here drills into the same one. */
  onOpenGoal?: (metric: ActivityGoalKey) => void;
}

/** Daily activity detail independent of the summary tab above Water. */
export default function DashboardActivityDetails({
  summary,
  steps,
  distance,
  distanceUnit,
  standHours,
  standGoal,
  stepsGoal,
  hourlyMove,
  hourlyExercise,
  hourlyStand,
  onOpenGoal,
}: DashboardActivityDetailsProps) {
  const { t } = useTranslation();
  // Apple prints a long exercise total as "6 h 20 m" rather than "380 min",
  // and past an hour the minute count stops being readable at a glance.
  const exerciseTotal = (minutes: number) => {
    const whole = Math.round(minutes);
    const hours = Math.floor(whole / 60);
    const rest = whole % 60;
    const minuteLabel = t('dashboard.activityMinutes', { defaultValue: 'min' });
    if (hours <= 0) return `${formatLocalizedNumber(rest)} ${minuteLabel}`;
    const hourLabel = t('dashboard.activityHours', { defaultValue: 'h' });
    return `${formatLocalizedNumber(hours)} ${hourLabel} ${formatLocalizedNumber(rest)} ${minuteLabel}`;
  };
  return (
    <View className="bg-surface rounded-2xl p-4 mb-3">
      <DashboardCardTitle className="mb-3">
        {t('dashboard.activityDetails', { defaultValue: 'Activity Details' })}
      </DashboardCardTitle>
      <ActivityMetricChart
        title={t('dashboard.activityMove', { defaultValue: 'Move' })}
        icon="flame"
        color="#FF375F"
        value={summary.activeCalories + summary.otherExerciseCalories}
        goal={summary.exerciseCaloriesGoal}
        unit={t('dashboard.activityKcal', { defaultValue: 'kcal' })}
        hourlyValues={hourlyMove}
        onOpen={onOpenGoal ? () => onOpenGoal('move') : undefined}
      />
      <ActivityMetricChart
        title={t('dashboard.activityExercise', { defaultValue: 'Exercise' })}
        icon="exercise-running"
        color="#A8EF00"
        value={summary.exerciseMinutes}
        goal={summary.exerciseMinutesGoal}
        unit={t('dashboard.activityMinutes', { defaultValue: 'min' })}
        hourlyValues={hourlyExercise}
        formatTotal={exerciseTotal}
        onOpen={onOpenGoal ? () => onOpenGoal('exercise') : undefined}
      />
      <ActivityMetricChart
        title={t('dashboard.activityStand', { defaultValue: 'Stand' })}
        icon="exercise-walking"
        color="#00D8EB"
        value={standHours}
        goal={standGoal}
        unit={t('dashboard.activityHours', { defaultValue: 'h' })}
        hourlyValues={hourlyStand}
        binary
        onOpen={onOpenGoal ? () => onOpenGoal('stand') : undefined}
      />
      {/* Both tiles read a missing value as 0 for the same reason the charts
          above do: an unrecorded step count is zero steps, not unknown. */}
      <View className="flex-row gap-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Icon name="exercise-walking" size={18} color="#00D8EB" />
            <DashboardCardTitle>
              {t('dashboard.activitySteps', { defaultValue: 'Steps' })}
            </DashboardCardTitle>
            <View className="flex-1" />
            {onOpenGoal ? (
              <CardChevron
                accessibilityLabel={t('dashboard.activitySteps', {
                  defaultValue: 'Steps',
                })}
                onPress={() => onOpenGoal('steps')}
              />
            ) : null}
          </View>
          {/* Compact past a thousand: the value and its goal share half a row,
              and two five-digit counts either wrapped or shrank the type. */}
          <Text className="text-text-primary text-3xl font-semibold mt-1">
            {formatCompactCount(steps ?? 0)}
            {stepsGoal && stepsGoal > 0
              ? `/${formatCompactCount(stepsGoal)}`
              : ''}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Icon name="measurements" size={18} color="#00D8EB" />
            <DashboardCardTitle>
              {t('dashboard.activityDistance', { defaultValue: 'Distance' })}
            </DashboardCardTitle>
            <View className="flex-1" />
            {onOpenGoal ? (
              <CardChevron
                accessibilityLabel={t('dashboard.activityDistance', {
                  defaultValue: 'Distance',
                })}
                onPress={() => onOpenGoal('distance')}
              />
            ) : null}
          </View>
          {/* Unit on the value's own baseline, not stacked under it: the
              Steps tile beside this one is a single line, and a second line
              here made the pair sit at different heights. */}
          <View className="flex-row items-end mt-1">
            <Text className="text-text-primary text-3xl font-semibold">
              {formatLocalizedNumber(distance ?? 0, {
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text className="text-text-muted text-sm ml-1 mb-1">
              {distanceUnit === 'km'
                ? t('dashboard.activityKilometers', { defaultValue: 'km' })
                : t('dashboard.activityMiles', { defaultValue: 'mi' })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
