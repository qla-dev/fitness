import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import type { SleepTimelineDay } from '../types/sleep';
import type { EntryTimeFormat } from '../utils/entryTimeDisplay';
import { formatClockTime, formatSleepDuration } from '../utils/sleepDay';
import {
  computeSleepScore,
  sleepNightStats,
  sleepScoreRating,
  type SleepNightStats,
  type SleepScorePart,
} from '../utils/sleepScore';
import { formatLocalizedNumber } from '../localization';
import { MenuItemDivider } from './MenuItem';

const RING_SIZE = 124;
const RING_STROKE = 16;
/** The clear space between two arcs, measured along the ring, in points. */
const GAP_POINTS = 6;

const polar = (radius: number, degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: RING_SIZE / 2 + radius * Math.cos(radians),
    y: RING_SIZE / 2 + radius * Math.sin(radians),
  };
};

const arcPath = (radius: number, from: number, to: number) => {
  const start = polar(radius, from);
  const end = polar(radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
};

/**
 * The score as three arcs around the number, each as long as that part is
 * worth — duration half the ring, bedtime under a third, interruptions the
 * rest — and filled as far as the night earned it.
 */
function ScoreRing({
  total,
  parts,
}: {
  total: number;
  parts: { part: SleepScorePart; color: string }[];
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const toDegrees = (points: number) => (points / radius) * (180 / Math.PI);
  // A round cap reaches half the stroke past the end of its arc, so each arc
  // is drawn that far inside its slot. Otherwise the caps eat the gaps, which
  // then read uneven: wide where an arc is short, closed where two meet.
  const cap = toDegrees(RING_STROKE / 2);
  const gapDegrees = toDegrees(GAP_POINTS);
  const available = 360 - gapDegrees * parts.length;
  const sweeps = parts.map(({ part }) => (available * part.max) / 100);
  const starts = sweeps.map(
    (_, index) =>
      gapDegrees / 2 +
      sweeps.slice(0, index).reduce((sum, sweep) => sum + sweep + gapDegrees, 0)
  );
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {parts.map(({ part, color }, index) => {
          const sweep = sweeps[index]!;
          const from = starts[index]!;
          const drawn = Math.max(0, sweep - 2 * cap);
          const filled = drawn * (part.points / part.max);
          return (
            <React.Fragment key={index}>
              <Path
                d={arcPath(radius, from + cap, from + cap + drawn)}
                stroke={color}
                strokeOpacity={0.25}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
              />
              {part.points > 0 ? (
                <Path
                  d={arcPath(radius, from + cap, from + cap + filled)}
                  stroke={color}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-3xl font-bold text-text-primary">
          {formatLocalizedNumber(total)}
        </Text>
      </View>
    </View>
  );
}

function ScoreRow({
  color,
  label,
  value,
  detail,
  part,
}: {
  color: string;
  label: string;
  value?: string;
  detail: string;
  part: SleepScorePart;
}) {
  return (
    <View className="flex-row items-start py-3 gap-2">
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
          marginTop: 5,
        }}
      />
      <View className="flex-1">
        <Text className="text-base text-text-primary">
          <Text className="font-bold">{label}</Text>
          {value ? ` ${value}` : ''}
        </Text>
        <Text className="text-base text-text-primary mt-0.5">{detail}</Text>
      </View>
      <Text className="text-base font-bold text-text-primary">
        {`${formatLocalizedNumber(part.points)}/${formatLocalizedNumber(part.max)}`}
      </Text>
    </View>
  );
}

/**
 * Last night's sleep score, broken into what it was made of.
 *
 * `days` is a window of nights ending with the one scored: the most recent
 * night with data is scored, and the others supply the usual bedtime it is
 * measured against. Renders nothing until there is a night to score.
 */
export default function SleepScoreCard({
  days,
  goalSeconds,
  timeFormat,
}: {
  days: readonly SleepTimelineDay[];
  goalSeconds: number;
  timeFormat?: EntryTimeFormat | null;
}) {
  const { t } = useTranslation();
  const [durationColor, bedtimeColor, interruptionColor] = useCSSVariable([
    '--color-cat-blue',
    '--color-cat-teal',
    '--color-cat-orange',
  ]) as [string, string, string];

  const nights = useMemo(
    () =>
      days
        .map(sleepNightStats)
        .filter((night): night is SleepNightStats => night !== null),
    [days]
  );
  const night = nights[nights.length - 1];
  if (!night) return null;
  const score = computeSleepScore(night, nights.slice(0, -1), goalSeconds);

  const durationDetail = score.lowRestorative
    ? t('sleepScore.duration.lowRestorative', {
        defaultValue: 'Not enough REM and deep sleep',
      })
    : night.timeAsleepSeconds >= goalSeconds
      ? t('sleepScore.duration.metGoal', {
          defaultValue: 'You met your {{goal}} goal',
          goal: formatSleepDuration(goalSeconds, t),
        })
      : t('sleepScore.duration.shortOfGoal', {
          defaultValue: 'Short of your {{goal}} goal',
          goal: formatSleepDuration(goalSeconds, t),
        });

  return (
    <View testID="sleep-score-card">
      <Text
        accessibilityRole="header"
        className="text-lg font-bold text-text-primary mb-3 px-1"
      >
        {t('sleepScore.heading', { defaultValue: 'Sleep score' })}
      </Text>
      {/* Short at the foot: the last row already carries 12 of its own, so a
          full p-4 left 28 under it against 16 above the ring. */}
      <View className="bg-surface rounded-xl px-4 pt-4 pb-1">
        <View className="flex-row items-center gap-5 pb-3">
          <ScoreRing
            total={score.total}
            parts={[
              { part: score.duration, color: durationColor },
              { part: score.bedtime, color: bedtimeColor },
              { part: score.interruptions, color: interruptionColor },
            ]}
          />
          <Text className="text-3xl font-bold text-text-primary flex-1">
            {sleepScoreRating(score.total, t)}
          </Text>
        </View>
        <MenuItemDivider inset={0} />
        <ScoreRow
          color={durationColor}
          label={t('sleepScore.duration.label', { defaultValue: 'Duration:' })}
          value={formatSleepDuration(night.timeAsleepSeconds, t)}
          detail={durationDetail}
          part={score.duration}
        />
        <MenuItemDivider inset={0} />
        <ScoreRow
          color={bedtimeColor}
          label={t('sleepScore.bedtime.label', { defaultValue: 'Bedtime:' })}
          detail={t('sleepScore.bedtime.detail', {
            defaultValue: 'Fell asleep at {{time}}',
            time: formatClockTime(
              new Date(night.bedtimeMs).toISOString(),
              timeFormat,
              night.zone
            ),
          })}
          part={score.bedtime}
        />
        <MenuItemDivider inset={0} />
        <ScoreRow
          color={interruptionColor}
          label={t('sleepScore.interruptions.label', {
            defaultValue: 'Interruptions:',
          })}
          detail={t('sleepScore.interruptions.detail', {
            count: night.awakenings,
            formattedCount: formatLocalizedNumber(night.awakenings),
            duration: formatSleepDuration(night.awakeSeconds, t),
            defaultValue: '{{formattedCount}} wake-ups, {{duration}} total',
            defaultValue_one: '{{formattedCount}} wake-up, {{duration}} total',
            defaultValue_other:
              '{{formattedCount}} wake-ups, {{duration}} total',
          })}
          part={score.interruptions}
        />
      </View>
    </View>
  );
}
