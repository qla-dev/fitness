import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import type { WorkoutHrSample } from '../types/healthRecords';
import { formatLocalizedNumber } from '../localization';
import { DetailSectionHeading } from './WorkoutDetailsCard';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CHART_W = 300;
const CHART_H = 90;
const GROW_MS = 650;
/** Enough bars to show the shape of an hour without drawing a sample each. */
const BARS = 60;

/**
 * Five-zone split by share of max heart rate, the same bands Apple prints.
 * Bounds are the lower edge of each zone as a fraction of max.
 */
const ZONES = [
  { key: 1, from: 0, color: '#3B82F6' },
  { key: 2, from: 0.6, color: '#22D3EE' },
  { key: 3, from: 0.7, color: '#A8EF00' },
  { key: 4, from: 0.8, color: '#FB923C' },
  { key: 5, from: 0.9, color: '#FF2D78' },
] as const;

/** One bar's height is that slice's mean, so a gap in sampling reads as a gap. */
const bucket = (samples: readonly WorkoutHrSample[]): (number | null)[] => {
  if (samples.length === 0) return [];
  const sums = new Array<number>(BARS).fill(0);
  const counts = new Array<number>(BARS).fill(0);
  const first = new Date(samples[0].t).getTime();
  const last = new Date(samples[samples.length - 1].t).getTime();
  const span = Math.max(1, last - first);
  for (const sample of samples) {
    const at = new Date(sample.t).getTime();
    if (!Number.isFinite(at)) continue;
    const index = Math.min(
      BARS - 1,
      Math.floor(((at - first) / span) * (BARS - 1))
    );
    sums[index] += sample.bpm;
    counts[index] += 1;
  }
  return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] : null));
};

/**
 * A workout's heart rate: the trace, then how long was spent in each zone.
 *
 * Zones are derived from the session's own maximum rather than an age formula.
 * The app never asks for a max heart rate, and guessing one from date of birth
 * would put a number on screen that the user cannot check and did not give —
 * the observed peak is at least a fact about this session.
 */
export default function WorkoutHeartRateSection({
  samples,
  average,
}: {
  samples: readonly WorkoutHrSample[];
  average?: number | null;
}) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  const values = bucket(samples);
  const present = values.filter((v): v is number => v != null);
  const max = present.length ? Math.max(...present) : 0;
  const min = present.length ? Math.min(...present) : 0;
  const hasData = present.length > 0;

  useEffect(() => {
    if (!hasData) {
      progress.value = 0;
      return;
    }
    if (!isFocused) return;
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: GROW_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, hasData, reducedMotion, samples.length, progress]);

  const zoneTotals = ZONES.map((zone, index) => {
    const lower = zone.from * max;
    const upper = index + 1 < ZONES.length ? ZONES[index + 1].from * max :
      Number.POSITIVE_INFINITY;
    const count = samples.filter(
      (sample) => sample.bpm >= lower && sample.bpm < upper
    ).length;
    return { ...zone, count, lower: Math.round(lower) };
  });
  const totalSamples = Math.max(1, samples.length);

  if (!hasData) return null;

  const barWidth = CHART_W / BARS - 1.5;

  return (
    <View className="py-2">
      <DetailSectionHeading
        title={t('activityDetail.heartRate', { defaultValue: 'Heart rate' })}
      />
      <View className="bg-surface rounded-3xl p-4">
        {average != null && average > 0 ? (
          <Text
            style={{ color: '#FF6B35' }}
            className="text-3xl font-bold mb-2"
          >
            {formatLocalizedNumber(Math.round(average))}
            <Text className="text-base font-semibold">
              {' '}
              {t('activityDetail.bpm', { defaultValue: 'bpm' })}
            </Text>
          </Text>
        ) : null}

        <Svg
          width="100%"
          height={CHART_H}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          accessible={false}
        >
          {values.map((value, index) =>
            value == null ? null : (
              <HrBar
                key={index}
                x={index * (CHART_W / BARS)}
                width={barWidth}
                // Scaled within the session's own range, so a steady effort
                // still shows its variation instead of one flat block.
                height={
                  max > min
                    ? 8 + ((value - min) / (max - min)) * (CHART_H - 12)
                    : CHART_H / 2
                }
                progress={progress}
              />
            )
          )}
        </Svg>
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-text-muted">
            {formatLocalizedNumber(Math.round(min))}
          </Text>
          <Text className="text-xs text-text-muted">
            {formatLocalizedNumber(Math.round(max))}
          </Text>
        </View>

        <View className="mt-3">
          {zoneTotals.map((zone) => (
            <View
              key={zone.key}
              className="flex-row items-center py-1.5 border-t border-border"
            >
              <Text
                style={{ color: zone.color }}
                className="text-sm font-semibold w-16"
              >
                {t('activityDetail.zone', {
                  defaultValue: 'Zone {{n}}',
                  n: zone.key,
                })}
              </Text>
              <View className="flex-1 h-2 rounded-full bg-raised mx-2 overflow-hidden">
                <View
                  style={{
                    backgroundColor: zone.color,
                    width: `${Math.round((zone.count / totalSamples) * 100)}%`,
                  }}
                  className="h-full rounded-full"
                />
              </View>
              <Text className="text-xs text-text-muted w-20 text-right">
                {zone.lower > 0
                  ? t('activityDetail.zoneFrom', {
                      defaultValue: '{{bpm}}+ bpm',
                      bpm: zone.lower,
                    })
                  : t('activityDetail.zoneLow', { defaultValue: 'low' })}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** One bar, growing from the chart's foot. Its own component because each
 *  animates its own height and hooks cannot be called in a render loop. */
function HrBar({
  x,
  width,
  height,
  progress,
}: {
  x: number;
  width: number;
  height: number;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const grown = height * progress.value;
    return { y: CHART_H - grown, height: grown };
  });
  return (
    <AnimatedRect
      animatedProps={animatedProps}
      x={x}
      width={Math.max(1, width)}
      rx={1}
      fill="#FF6B35"
    />
  );
}
