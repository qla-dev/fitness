import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import DashboardCardTitle from './DashboardCardTitle';
import ValueSkeleton from './ValueSkeleton';
import Icon, { type IconName } from './Icon';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Chart box, in the viewBox units the Svg below declares. */
const CHART_W = 300;
/** Where a flat series sits: the foot of the plot, not the middle. */
const BASELINE = 108;
const GROW_MS = 650;

interface HealthTrendCardProps {
  title: string;
  icon: IconName;
  color: string;
  description: string;
  average: number | null;
  averageLabel: string;
  values: readonly (number | null)[];
  days: number;
  line?: boolean;
  isLoading: boolean;
  isError: boolean;
  /** Opens this trend's own screen, where the full chart lives. */
  onOpen: () => void;
}

/**
 * A trend's summary: its average, a sparkline, and a way through to the chart.
 *
 * It used to unfold in place. The interactive chart is a screenful on its own —
 * scrubbable, with its own range — and opening one pushed every card below it
 * off the screen, so reading two trends meant closing the first. It now sits on
 * its own screen and this card is the link to it, which is also why the chevron
 * points the way it does.
 *
 * The card is drawn in full from the first frame, flat. It used to swap the
 * whole body for a spinner while the range loaded, so the screen arrived as a
 * column of spinners that each resized when its numbers landed. Now the chrome —
 * title, icon, axis, period — is present immediately because none of it depends
 * on the data, only the digits are skeletoned (see ValueSkeleton), and the
 * series grows from the baseline once it is known. Nothing moves except the
 * chart, because nothing else was ever missing.
 */
export default function HealthTrendCard({
  title,
  icon,
  color,
  description,
  average,
  averageLabel,
  values,
  days,
  line = false,
  isLoading,
  isError,
  onOpen,
}: HealthTrendCardProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();

  const valid = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  const hasSeries = valid.length > 0 && average != null;

  const min = line && valid.length ? Math.min(...valid) * 0.98 : 0;
  const max = Math.max(min + 1, ...valid) * 1.02;
  const y = (value: number) => BASELINE - ((value - min) / (max - min)) * 92;
  const x = (index: number) =>
    5 + (index / Math.max(1, values.length - 1)) * 290;

  // Plain arrays of numbers so the worklets below can read them off the UI
  // thread without touching the nullable source series.
  const points = values.flatMap((value, index) =>
    value == null ? [] : [{ x: x(index), y: y(value) }]
  );
  const barWidth = Math.max(1, CHART_W / Math.max(1, values.length) - 3);
  const bars = values.flatMap((value, index) =>
    value == null
      ? []
      : [
          {
            x: (index * CHART_W) / Math.max(1, values.length) + 1,
            y: y(value),
          },
        ]
  );
  const averageY = average == null ? BASELINE : y(average);

  // 0 = flat on the baseline, 1 = the real shape. Starts flat every time the
  // screen is focused, which is what makes the chart grow on each visit rather
  // than only on the very first mount.
  const progress = useSharedValue(0);
  const seriesKey = `${values.length}:${average ?? ''}:${hasSeries}`;

  // useIsFocused + useEffect rather than useFocusEffect: the same shape
  // ArcGauge uses, and the only one the immutability lint allows a shared value
  // to be written from. seriesKey is in the deps so a range change replays the
  // growth while the screen is already open.
  useEffect(() => {
    if (!hasSeries) {
      progress.value = 0;
      return;
    }
    if (!isFocused) return;
    if (reducedMotion) {
      // The point of the setting is to arrive at the answer without the journey.
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: GROW_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, hasSeries, reducedMotion, seriesKey, progress]);

  const seriesProps = useAnimatedProps(() => {
    'worklet';
    const grown = progress.value;
    if (line) {
      if (points.length === 0) return { d: '' };
      let d = '';
      for (let i = 0; i < points.length; i += 1) {
        const py = BASELINE + (points[i].y - BASELINE) * grown;
        d += `${i === 0 ? 'M' : 'L'}${points[i].x},${py}`;
      }
      return { d };
    }
    let d = '';
    for (let i = 0; i < bars.length; i += 1) {
      const py = BASELINE + (bars[i].y - BASELINE) * grown;
      const height = BASELINE - py;
      if (height <= 0) continue;
      d += `M${bars[i].x},${BASELINE}V${py}h${barWidth}V${BASELINE}Z`;
    }
    return { d };
  });

  const averageProps = useAnimatedProps(() => {
    'worklet';
    const py = BASELINE + (averageY - BASELINE) * progress.value;
    return { y1: py, y2: py };
  });

  const body = () => {
    if (isError) {
      return (
        <Text className="text-text-muted text-base">
          {t('dashboard.trendLoadFailed', {
            defaultValue: 'Unable to load this trend.',
          })}
        </Text>
      );
    }
    if (!isLoading && average == null) {
      return (
        <Text className="text-text-muted text-base">
          {t('dashboard.trendNoData', {
            defaultValue: 'No recorded data for this period.',
          })}
        </Text>
      );
    }
    return (
      <>
        {isLoading ? (
          <View className="mb-4">
            <ValueSkeleton width="60%" height={22} />
          </View>
        ) : (
          <Text className="text-text-primary text-lg font-semibold mb-4">
            {description}
          </Text>
        )}
        <View className="border-t border-border pt-3">
          {isLoading ? (
            <View className="mb-1">
              <ValueSkeleton width={96} height={16} />
            </View>
          ) : (
            <Text style={{ color }} className="text-sm font-semibold mb-1">
              {averageLabel}
            </Text>
          )}
          <Svg
            width="100%"
            height={120}
            viewBox="0 0 300 120"
            preserveAspectRatio="none"
            accessible={false}
          >
            {/* One animated path for the whole series — a line or every bar —
                rather than an animated node per point, so a 90-day range
                interpolates one string per frame instead of ninety. */}
            <AnimatedPath
              animatedProps={seriesProps}
              fill={line ? 'none' : color}
              stroke={line ? color : 'none'}
              strokeWidth={line ? 2 : 0}
              strokeOpacity={0.3}
              opacity={line ? 1 : 0.25}
            />
            <AnimatedLine
              animatedProps={averageProps}
              x1={0}
              x2={CHART_W}
              stroke={color}
              strokeWidth={3}
            />
          </Svg>
        </View>
      </>
    );
  };

  return (
    <View className="bg-surface rounded-3xl p-4 mb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onOpen}
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Icon name={icon} size={20} color={color} />
          <View className="flex-1">
            <DashboardCardTitle>{title}</DashboardCardTitle>
          </View>
          <Icon name="chevron-forward" size={18} color={color} />
        </View>
        {body()}
        <Text style={{ color }} className="text-sm font-medium mt-2">
          {t('dashboard.trendPeriod', {
            count: days,
            defaultValue: 'Last {{count}} days',
            defaultValue_one: 'Last {{count}} day',
            defaultValue_other: 'Last {{count}} days',
          })}
        </Text>
      </Pressable>
    </View>
  );
}
