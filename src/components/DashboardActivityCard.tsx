import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Svg, { Circle } from 'react-native-svg';
import { formatLocalizedNumber } from '../localization';
import type { DailySummary } from '../types/dailySummary';
import { useManualHealthSync } from '../hooks/useManualHealthSync';
import Icon, { type IconName } from './Icon';
import { ACTIVITY_RING_COLORS } from '../constants/activityRings';

export default function DashboardActivityCard({
  summary,
  steps,
}: {
  summary: DailySummary;
  steps?: number | null;
}) {
  const { t } = useTranslation();
  const { sync, isPending } = useManualHealthSync();
  const [textMuted] = useCSSVariable(['--color-text-muted']) as string[];
  const number = (value: number) =>
    formatLocalizedNumber(value, { maximumFractionDigits: 0 });
  const metrics = [
    {
      icon: 'flame' as IconName,
      label: t('dashboard.activityMove', { defaultValue: 'Move' }),
      value: summary.activeCalories + summary.otherExerciseCalories,
      goal: summary.exerciseCaloriesGoal,
      unit: t('dashboard.activityKcal', { defaultValue: 'kcal' }),
      color: ACTIVITY_RING_COLORS.move,
    },
    {
      icon: 'exercise-running' as IconName,
      label: t('dashboard.activityExercise', { defaultValue: 'Exercise' }),
      value: summary.exerciseMinutes,
      goal: summary.exerciseMinutesGoal,
      unit: t('dashboard.activityMinutes', { defaultValue: 'min' }),
      color: ACTIVITY_RING_COLORS.exercise,
    },
    {
      icon: 'exercise-walking' as IconName,
      label: t('dashboard.activitySteps', { defaultValue: 'Steps' }),
      value: steps,
      goal: summary.goals.steps ?? 0,
      unit: '',
      color: ACTIVITY_RING_COLORS.steps,
    },
  ];
  return (
    <View>
      <View className="bg-surface rounded-2xl p-4 mb-3">
        <View className="flex-row items-center justify-between mb-3">
          <DashboardCardTitle>
            {t('dashboard.activityRings', { defaultValue: 'Activity Rings' })}
          </DashboardCardTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.activitySync', {
              defaultValue: 'Sync health data',
            })}
            accessibilityState={{ disabled: isPending, busy: isPending }}
            disabled={isPending}
            onPress={() => void sync()}
            hitSlop={12}
            // Fixed box so swapping the icon for the spinner cannot nudge the
            // title or change the card's height mid-sync.
            className="w-6 h-6 items-center justify-center"
          >
            {isPending ? (
              <ActivityIndicator size="small" color={textMuted} />
            ) : (
              <Icon name="sync" size={18} color={textMuted} />
            )}
          </Pressable>
        </View>
        <View className="flex-row items-center gap-3">
          <Svg
            width={144}
            height={144}
            viewBox="0 0 144 144"
            accessible={false}
          >
            {metrics.map((metric, index) => {
              const radius = 61 - index * 16;
              return (
                <Circle
                  key={metric.label + '-track'}
                  cx={72}
                  cy={72}
                  r={radius}
                  fill="none"
                  stroke={metric.color}
                  strokeOpacity={0.18}
                  strokeWidth={12}
                />
              );
            })}
            {metrics.map((metric, index) => {
              const radius = 61 - index * 16;
              const length = 2 * Math.PI * radius;
              const progress =
                metric.goal > 0
                  ? Math.min(1, Math.max(0, (metric.value ?? 0) / metric.goal))
                  : 0;
              return progress > 0 ? (
                <Circle
                  key={metric.label}
                  cx={72}
                  cy={72}
                  r={radius}
                  fill="none"
                  stroke={metric.color}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={`${length * progress} ${length}`}
                  rotation={-90}
                  origin="72, 72"
                />
              ) : null;
            })}
          </Svg>
          <View className="flex-1 gap-2">
            {metrics.map((metric) => (
              <View key={metric.label}>
                <View className="flex-row items-center gap-2">
                  <Icon name={metric.icon} size={18} color={metric.color} />
                  <Text className="text-text-secondary text-base flex-shrink">
                    {metric.label}
                  </Text>
                </View>
                {/* Nothing recorded is a real zero, not an unknown: "0/200
                    kcal" states the day so far, where an em dash reads as a
                    fault in the app. */}
                <Text
                  style={{ color: metric.color }}
                  className="font-bold text-xl"
                >
                  {number(metric.value ?? 0)}
                  {metric.goal > 0 ? `/${number(metric.goal)}` : ''}{' '}
                  {metric.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View className="flex-row gap-3 mb-3">
        {metrics
          .slice(1)
          .reverse()
          .map((metric) => (
            <View
              key={metric.label}
              className="flex-1 bg-surface rounded-2xl p-4"
            >
              <View className="flex-row items-center gap-2">
                <Icon name={metric.icon} size={18} color={metric.color} />
                <DashboardCardTitle>{metric.label}</DashboardCardTitle>
              </View>
              {/* The tiles carry the same value/goal pair as the ring legend
                  above, so the two never disagree at a glance. */}
              <Text
                style={{ color: metric.color }}
                className="text-3xl font-semibold mt-1"
              >
                {number(metric.value ?? 0)}
                {metric.goal > 0 ? `/${number(metric.goal)}` : ''}
              </Text>
              <Text className="text-text-muted text-sm mt-1">
                {metric.unit ||
                  (metric.goal > 0
                    ? t('dashboard.activitySteps', { defaultValue: 'Steps' })
                    : t('dashboard.activityNoStepGoal', {
                        defaultValue: 'No step goal set',
                      }))}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}
