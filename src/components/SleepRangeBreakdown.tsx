import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import MenuItem from './MenuItem';
import SegmentedControl from './SegmentedControl';
import { STAGE_COLOR_VARIABLES } from './SleepTimelineChart';
import type { SleepTimelineDay } from '../types/sleep';
import { formatSleepDuration } from '../utils/sleepDay';
import { localizeSleepStage } from '../utils/sleepLocalization';
import {
  SLEEP_BREAKDOWN_STAGES,
  sleepNightStats,
  type SleepNightStats,
} from '../utils/sleepScore';
import { formatLocalizedNumber } from '../localization';

type BreakdownTab = 'stages' | 'amounts' | 'comparisons';

const PLACEHOLDER = '--';

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

function BreakdownRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View className="bg-surface rounded-xl overflow-hidden">
      <MenuItem
        trailing={
          <Text className="text-base font-bold text-text-primary">{value}</Text>
        }
      >
        <View className="flex-row items-center gap-2">
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: color,
            }}
          />
          <Text className="text-base text-text-primary" numberOfLines={1}>
            {label}
          </Text>
        </View>
      </MenuItem>
    </View>
  );
}

/**
 * The nights in the selected range, taken apart three ways: how long each
 * stage lasted on an average night, what share of the time in bed each took,
 * and how the range compares with the goal. The tabs are the same control as
 * the D / W / M picker above, so the page has one kind of switch.
 */
export default function SleepRangeBreakdown({
  days,
  goalSeconds,
}: {
  days: readonly SleepTimelineDay[];
  goalSeconds: number;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<BreakdownTab>('stages');
  const stageColors = useCSSVariable(
    SLEEP_BREAKDOWN_STAGES.map((stage) => STAGE_COLOR_VARIABLES[stage])
  ) as string[];
  const [accent, muted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];

  const nights = useMemo(
    () =>
      days
        .map(sleepNightStats)
        .filter((night): night is SleepNightStats => night !== null),
    [days]
  );
  const staged = nights.filter((night) => night.hasStages);
  const duration = (seconds: number | null) =>
    seconds == null ? PLACEHOLDER : formatSleepDuration(seconds, t);
  const percent = (share: number | null) =>
    share == null
      ? PLACEHOLDER
      : `${formatLocalizedNumber(Math.round(share * 100))}%`;

  const averageAsleep = average(nights.map((n) => n.timeAsleepSeconds));
  const averageInBed = average(nights.map((n) => n.timeInBedSeconds));

  const rows =
    tab === 'comparisons'
      ? [
          {
            key: 'asleep',
            color: accent,
            label: t('sleepBreakdown.averageAsleep', {
              defaultValue: 'Average time asleep',
            }),
            value: duration(averageAsleep),
          },
          {
            key: 'inBed',
            color: muted,
            label: t('sleepBreakdown.averageInBed', {
              defaultValue: 'Average time in bed',
            }),
            value: duration(averageInBed),
          },
          {
            key: 'goal',
            color: stageColors[2]!,
            label: t('sleepBreakdown.goal', { defaultValue: 'Sleep goal' }),
            value: duration(goalSeconds),
          },
          {
            key: 'efficiency',
            color: stageColors[3]!,
            label: t('sleepBreakdown.efficiency', {
              defaultValue: 'Asleep while in bed',
            }),
            value: percent(
              averageAsleep != null && averageInBed
                ? Math.min(1, averageAsleep / averageInBed)
                : null
            ),
          },
        ]
      : SLEEP_BREAKDOWN_STAGES.map((stage, index) => ({
          key: stage,
          color: stageColors[index]!,
          label: localizeSleepStage(t, stage),
          value:
            tab === 'stages'
              ? duration(average(staged.map((n) => n.stageSeconds[stage])))
              : percent(
                  average(
                    staged.map(
                      (n) =>
                        n.stageSeconds[stage] / Math.max(1, n.timeInBedSeconds)
                    )
                  )
                ),
        }));

  return (
    <View className="gap-2" testID="sleep-range-breakdown">
      <View className="mb-1">
        <SegmentedControl<BreakdownTab>
          segments={[
            {
              key: 'stages',
              label: t('sleepBreakdown.tabs.stages', {
                defaultValue: 'Stages',
              }),
            },
            {
              key: 'amounts',
              label: t('sleepBreakdown.tabs.amounts', {
                defaultValue: 'Amounts',
              }),
            },
            {
              key: 'comparisons',
              label: t('sleepBreakdown.tabs.comparisons', {
                defaultValue: 'Comparisons',
              }),
            },
          ]}
          activeKey={tab}
          onSelect={setTab}
          label={t('sleepBreakdown.tabs.label', { defaultValue: 'Breakdown' })}
        />
      </View>
      {rows.map((row) => (
        <BreakdownRow
          key={row.key}
          color={row.color}
          label={row.label}
          value={row.value}
        />
      ))}
    </View>
  );
}
