import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { formatLocalizedNumber } from '../localization';
import type { DailySummary } from '../types/dailySummary';
import ActivityMetricChart from './ActivityMetricChart';
import Icon from './Icon';

interface DashboardActivityDetailsProps {
  summary: DailySummary;
  steps?: number | null;
  distance?: number | null;
  distanceUnit: 'km' | 'miles';
  standHours?: number | null;
  standGoal?: number;
  hourlyMove?: readonly (number | null)[];
  hourlyExercise?: readonly (number | null)[];
  hourlyStand?: readonly (number | null)[];
}

/** Daily activity detail independent of the summary tab above Water. */
export default function DashboardActivityDetails({
  summary,
  steps,
  distance,
  distanceUnit,
  standHours,
  standGoal,
  hourlyMove,
  hourlyExercise,
  hourlyStand,
}: DashboardActivityDetailsProps) {
  const { t } = useTranslation();
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
      />
      <ActivityMetricChart
        title={t('dashboard.activityExercise', { defaultValue: 'Exercise' })}
        icon="exercise-running"
        color="#A8EF00"
        value={summary.exerciseMinutes}
        goal={summary.exerciseMinutesGoal}
        unit={t('dashboard.activityMinutes', { defaultValue: 'min' })}
        hourlyValues={hourlyExercise}
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
      />
      <View className="flex-row gap-4">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Icon name="exercise-walking" size={18} color="#00D8EB" />
            <DashboardCardTitle>
              {t('dashboard.activitySteps', { defaultValue: 'Steps' })}
            </DashboardCardTitle>
          </View>
          <Text className="text-text-primary text-3xl font-semibold mt-1">
            {steps == null
              ? '—'
              : formatLocalizedNumber(steps, { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Icon name="measurements" size={18} color="#00D8EB" />
            <DashboardCardTitle>
              {t('dashboard.activityDistance', { defaultValue: 'Distance' })}
            </DashboardCardTitle>
          </View>
          <Text className="text-text-primary text-3xl font-semibold mt-1">
            {distance == null
              ? '—'
              : formatLocalizedNumber(distance, { maximumFractionDigits: 2 })}
          </Text>
          <Text className="text-text-muted text-sm">
            {distanceUnit === 'km'
              ? t('dashboard.activityKilometers', { defaultValue: 'km' })
              : t('dashboard.activityMiles', { defaultValue: 'mi' })}
          </Text>
        </View>
      </View>
    </View>
  );
}
