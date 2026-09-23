import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { useIsFocusedWhenNavigable } from '../hooks/useIsFocusedWhenNavigable';
import { formatLocalizedNumber } from '../localization';
import type { DailySummary } from '../types/dailySummary';
import { useManualHealthSync } from '../hooks/useManualHealthSync';
import CardChevron from './CardChevron';
import CardPressable from './CardPressable';
import { formatCompactCount } from '../utils/compactNumber';
import type { ActivityGoalKey } from '../constants/activityGoals';
import Icon, { type IconName } from './Icon';
import { ACTIVITY_RING_COLORS } from '../constants/activityRings';
import { fireRefreshHaptic } from '../services/haptics';
import ValueSkeleton from './ValueSkeleton';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * One filled ring. It mounts empty and grows to its value, so the card can be
 * on screen with its tracks and labels before the day's numbers arrive and
 * then fill in place — no skeleton standing in for it.
 *
 * It empties and refills on every visit to the screen, not only on the first
 * one, matching the Tracker's rings: a cached day would otherwise be sitting
 * there already filled, so whether the rings played depended on whether the
 * data happened to be warm.
 *
 * Drawn with a full dasharray and an animated offset rather than an animated
 * dasharray: the offset is a single number, so it interpolates on the UI
 * thread instead of rebuilding a string every frame.
 */
function ProgressRing({
  radius,
  color,
  progress,
}: {
  radius: number;
  color: string;
  progress: number;
}) {
  const length = 2 * Math.PI * radius;
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(length);

  // One effect, because React's compiler cannot optimize a shared value
  // written from two. `wasFocused` is what separates a fresh visit — which
  // rewinds to empty first — from the value simply changing while on screen,
  // which animates from wherever it already is.
  const isFocused = useIsFocusedWhenNavigable();
  const wasFocused = useRef(false);
  useEffect(() => {
    if (!isFocused) {
      wasFocused.current = false;
      return;
    }
    const justFocused = !wasFocused.current;
    wasFocused.current = true;
    const target = length * (1 - progress);
    // Reduced motion never replays: the point of the setting is to arrive at
    // the answer without the journey.
    if (reducedMotion) {
      offset.value = target;
      return;
    }
    if (justFocused) {
      offset.value = length;
    }
    offset.value = withTiming(target, { duration: 650 });
  }, [isFocused, length, progress, reducedMotion, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedCircle
      cx={72}
      cy={72}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={12}
      strokeLinecap="round"
      strokeDasharray={length}
      animatedProps={animatedProps}
      rotation={-90}
      origin="72, 72"
    />
  );
}

export default function DashboardActivityCard({
  summary,
  steps,
  loading = false,
  onOpenGoal,
}: {
  summary: DailySummary;
  steps?: number | null;
  /** Only the numbers wait: the rings, icons and labels are already correct. */
  loading?: boolean;
  /**
   * Opens a metric's own screen, from the two tiles below the rings. The rings
   * card itself carries no chevron: it is three metrics at once, so there is no
   * single screen for it to open.
   */
  onOpenGoal?: (metric: ActivityGoalKey) => void;
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
      metric: 'move' as ActivityGoalKey,
    },
    {
      icon: 'exercise-running' as IconName,
      label: t('dashboard.activityExercise', { defaultValue: 'Exercise' }),
      value: summary.exerciseMinutes,
      goal: summary.exerciseMinutesGoal,
      unit: t('dashboard.activityMinutes', { defaultValue: 'min' }),
      color: ACTIVITY_RING_COLORS.exercise,
      metric: 'exercise' as ActivityGoalKey,
    },
    {
      icon: 'exercise-walking' as IconName,
      label: t('dashboard.activitySteps', { defaultValue: 'Steps' }),
      value: steps,
      goal: summary.goals.steps ?? 0,
      unit: '',
      color: ACTIVITY_RING_COLORS.steps,
      // Compacted in the tiles below, where the pair shares half a row with
      // nowhere to grow. The legend beside the rings keeps the real figure —
      // it has the width, and this is the one place the exact count is read.
      compact: true,
      metric: 'steps' as ActivityGoalKey,
    },
  ];
  return (
    <View>
      <View className="bg-surface rounded-2xl px-4 pt-3 pb-4 mb-3">
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
            // The same tap a pull-to-refresh gives, because it is the same
            // act: this button is the pull for a card you cannot pull.
            onPress={() => {
              fireRefreshHaptic();
              void sync();
            }}
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
            {metrics.map((metric, index) => (
              <ProgressRing
                key={metric.label}
                radius={61 - index * 16}
                color={metric.color}
                progress={
                  metric.goal > 0
                    ? Math.min(
                        1,
                        Math.max(0, (metric.value ?? 0) / metric.goal)
                      )
                    : 0
                }
              />
            ))}
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
                    fault in the app. Until the day has loaded there is no
                    figure to state either way, so the digits alone wait. */}
                {loading ? (
                  <View className="h-7 justify-center">
                    <ValueSkeleton width={96} />
                  </View>
                ) : (
                  <Text
                    style={{ color: metric.color }}
                    className="font-bold text-xl"
                  >
                    {number(metric.value ?? 0)}
                    {metric.goal > 0 ? `/${number(metric.goal)}` : ''}{' '}
                    {metric.unit}
                  </Text>
                )}
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
            <CardPressable
              key={metric.label}
              className="flex-1 bg-surface rounded-2xl px-4 pt-3 pb-4"
              accessibilityLabel={metric.label}
              onPress={onOpenGoal ? () => onOpenGoal(metric.metric) : undefined}
            >
              <View className="flex-row items-center gap-2">
                <Icon name={metric.icon} size={18} color={metric.color} />
                <DashboardCardTitle>{metric.label}</DashboardCardTitle>
                <View className="flex-1" />
                {onOpenGoal ? (
                  <CardChevron accessibilityLabel={metric.label} />
                ) : null}
              </View>
              {/* The tiles carry the same value/goal pair as the ring legend
                  above, so the two never disagree at a glance. */}
              {loading ? (
                <View className="h-9 justify-center mt-1">
                  <ValueSkeleton width={88} height={26} />
                </View>
              ) : (
                <Text
                  style={{ color: metric.color }}
                  className="text-3xl font-semibold mt-1"
                >
                  {metric.compact
                    ? formatCompactCount(metric.value ?? 0)
                    : number(metric.value ?? 0)}
                  {metric.goal > 0
                    ? `/${
                        metric.compact
                          ? formatCompactCount(metric.goal)
                          : number(metric.goal)
                      }`
                    : ''}
                </Text>
              )}
              <Text className="text-text-muted text-sm mt-1">
                {metric.unit ||
                  (metric.goal > 0
                    ? t('dashboard.activitySteps', { defaultValue: 'Steps' })
                    : t('dashboard.activityNoStepGoal', {
                        defaultValue: 'No step goal set',
                      }))}
              </Text>
            </CardPressable>
          ))}
      </View>
    </View>
  );
}
