import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import CycleBeads from './CycleBeads';
import { useWellnessTokens } from './theme/wellnessTokens';
import { getPhaseColor } from '../../utils/cycleDisplayUtils';
import { withAlpha } from '../../utils/colors';

interface CycleHubSummaryProps {
  cycleDay: number | null;
  cycleLength: number;
  periodLength: number;
  fertileStartDay: number | null;
  fertileEndDay: number | null;
  ovulationDay: number | null;
  phase: string;
  phaseLabel: string;
  daysLate: number;
  /** Discreet mode: the bracelet alone, no phase words or countdowns. */
  discreet?: boolean;
}

/**
 * The top of the Cycle Hub: the day-bead bracelet on the left and, beside it,
 * what is coming rather than what the ring already shows — a countdown to the
 * next period, to the fertile window and to ovulation, each in its phase's
 * colour, with a slim bar for how far through the cycle today is.
 *
 * Every figure is a count of days from today, because "in 6 days" is what a
 * plan gets made against; the dates themselves live in the calendar below.
 */
const CycleHubSummary: React.FC<CycleHubSummaryProps> = ({
  cycleDay,
  cycleLength,
  periodLength,
  fertileStartDay,
  fertileEndDay,
  ovulationDay,
  phase,
  phaseLabel,
  daysLate,
  discreet = false,
}) => {
  const { t } = useTranslation();
  const tokens = useWellnessTokens();
  const [track] = useCSSVariable(['--color-progress-track']) as string[];
  const day = cycleDay ?? 0;
  const len = Math.max(cycleLength, periodLength + 1, 14);
  const dayLabel =
    cycleDay !== null
      ? t('cycleHub.ring.day', { defaultValue: 'Day {{day}}', day: cycleDay })
      : '—';

  const beads = (
    <CycleBeads
      cycleDay={cycleDay}
      cycleLength={cycleLength}
      periodLength={periodLength}
      fertileStartDay={fertileStartDay}
      fertileEndDay={fertileEndDay}
      ovulationDay={ovulationDay}
      centerValue={dayLabel}
      centerSub={
        discreet
          ? undefined
          : t('cycleHub.ring.dayCycle', {
              defaultValue: '{{count}}-day cycle',
              count: cycleLength,
            })
      }
      size={150}
    />
  );
  if (discreet) return <View className="items-center">{beads}</View>;

  const menstrual = getPhaseColor('menstrual', tokens);
  const fertile = getPhaseColor('fertile', tokens);
  const ovulation = getPhaseColor('ovulation', tokens);

  /** Days until a cycle day, wrapping into the next cycle once it has passed. */
  const until = (target: number | null) =>
    target == null || !day
      ? null
      : target >= day
        ? target - day
        : len - day + target;

  const nextPeriod = daysLate > 0 ? null : day ? len - day + 1 : null;
  const inFertile =
    !!fertileStartDay &&
    !!fertileEndDay &&
    day >= fertileStartDay &&
    day <= fertileEndDay;

  const rows: {
    key: string;
    icon: IconName;
    color: string;
    value: string;
    label: string;
  }[] = [
    {
      key: 'period',
      icon: 'hydration',
      color: menstrual,
      value:
        daysLate > 0
          ? t('cycleHub.summary.late', {
              defaultValue: '{{count}}d late',
              count: daysLate,
            })
          : nextPeriod != null
            ? t('cycleHub.summary.inDays', {
                defaultValue: '{{count}}d',
                count: nextPeriod,
              })
            : '—',
      label: t('cycleHub.summary.nextPeriod', { defaultValue: 'Next period' }),
    },
    {
      key: 'fertile',
      icon: 'leaf',
      color: fertile,
      value: inFertile
        ? t('cycleHub.summary.now', { defaultValue: 'Now' })
        : until(fertileStartDay) != null
          ? t('cycleHub.summary.inDays', {
              defaultValue: '{{count}}d',
              count: until(fertileStartDay) ?? 0,
            })
          : '—',
      label: t('cycleHub.summary.fertileWindow', {
        defaultValue: 'Fertile window',
      }),
    },
    {
      key: 'ovulation',
      icon: 'sparkles',
      color: ovulation,
      value:
        until(ovulationDay) === 0
          ? t('cycleHub.summary.today', { defaultValue: 'Today' })
          : until(ovulationDay) != null
            ? t('cycleHub.summary.inDays', {
                defaultValue: '{{count}}d',
                count: until(ovulationDay) ?? 0,
              })
            : '—',
      label: t('cycleHub.summary.ovulation', {
        defaultValue: 'Est. ovulation',
      }),
    },
  ];
  const progress = day ? Math.min(1, day / len) : 0;

  return (
    <View className="flex-row items-center gap-4">
      {beads}
      <View className="flex-1" style={{ gap: 10 }}>
        <View>
          <Text
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: getPhaseColor(phase, tokens) }}
          >
            {phaseLabel}
          </Text>
          <View
            className="mt-1.5 rounded-full overflow-hidden"
            style={{ height: 4, backgroundColor: track }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: getPhaseColor(phase, tokens),
              }}
            />
          </View>
        </View>
        {rows.map((row) => (
          <View
            key={row.key}
            accessible
            accessibilityLabel={`${row.label} ${row.value}`}
            className="flex-row items-center"
            style={{ gap: 10 }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 30,
                height: 30,
                backgroundColor: withAlpha(row.color, 0.16),
              }}
            >
              <Icon name={row.icon} size={15} color={row.color} />
            </View>
            <View className="flex-1">
              <Text
                className="font-bold"
                style={{
                  color: row.color,
                  fontSize: 18,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {row.value}
              </Text>
              <Text className="text-text-secondary" style={{ fontSize: 12 }}>
                {row.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default CycleHubSummary;
