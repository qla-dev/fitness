import type { TFunction } from 'i18next';
import type { SleepStageLane, SleepTimelineDay } from '../types/sleep';

/** The stages a night is broken into on screen. `other` is a source with no stages. */
export const SLEEP_BREAKDOWN_STAGES = [
  'awake',
  'rem',
  'light',
  'deep',
] as const;
export type SleepBreakdownStage = (typeof SLEEP_BREAKDOWN_STAGES)[number];

export interface SleepNightStats {
  day: string;
  /** The wall clock the night was recorded against, for its clock times. */
  zone: SleepTimelineDay['zone'];
  bedtimeMs: number;
  wakeMs: number;
  timeInBedSeconds: number;
  timeAsleepSeconds: number;
  stageSeconds: Record<SleepStageLane, number>;
  /** Whether the source split the night into stages at all. */
  hasStages: boolean;
  /** Awake stretches between falling asleep and the final waking. */
  awakenings: number;
  awakeSeconds: number;
}

const emptyStages = (): Record<SleepStageLane, number> => ({
  awake: 0,
  rem: 0,
  light: 0,
  deep: 0,
  other: 0,
});

/**
 * One night's figures, read off its segments. A day with no segments is no
 * night at all and returns null, so an empty day never averages in as zero.
 */
export function sleepNightStats(day: SleepTimelineDay): SleepNightStats | null {
  const segments = [...day.segments].sort((a, b) => a.startMs - b.startMs);
  if (segments.length === 0) return null;
  const stageSeconds = emptyStages();
  for (const segment of segments) {
    stageSeconds[segment.stage] += (segment.endMs - segment.startMs) / 1000;
  }
  const asleep = segments.filter((segment) => segment.stage !== 'awake');
  const firstAsleep = asleep[0]?.startMs ?? Infinity;
  const lastAsleep = asleep[asleep.length - 1]?.endMs ?? -Infinity;
  // Lying awake before sleep and getting up after it are not interruptions.
  const interruptions = segments.filter(
    (segment) =>
      segment.stage === 'awake' &&
      segment.startMs >= firstAsleep &&
      segment.endMs <= lastAsleep
  );
  const bedtimeMs = segments[0]!.startMs;
  const wakeMs = Math.max(...segments.map((segment) => segment.endMs));
  const asleepFromStages =
    stageSeconds.rem +
    stageSeconds.light +
    stageSeconds.deep +
    stageSeconds.other;
  return {
    day: day.day,
    zone: day.zone,
    bedtimeMs,
    wakeMs,
    timeInBedSeconds: day.timeInBedSeconds || (wakeMs - bedtimeMs) / 1000,
    timeAsleepSeconds: day.timeAsleepSeconds ?? asleepFromStages,
    stageSeconds,
    hasStages: stageSeconds.rem + stageSeconds.light + stageSeconds.deep > 0,
    awakenings: interruptions.length,
    awakeSeconds: interruptions.reduce(
      (sum, segment) => sum + (segment.endMs - segment.startMs) / 1000,
      0
    ),
  };
}

/** Minutes after noon, so 23:00 and 01:00 sit two hours apart, not 22. */
const minutesFromNoon = (ms: number) => {
  const date = new Date(ms);
  return (date.getHours() * 60 + date.getMinutes() - 720 + 1440) % 1440;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export interface SleepScorePart {
  points: number;
  max: number;
}

export interface SleepScore {
  total: number;
  duration: SleepScorePart;
  bedtime: SleepScorePart;
  interruptions: SleepScorePart;
  /** Whether REM and deep together fell under a healthy share of the night. */
  lowRestorative: boolean;
}

/** Nights before the scored one needed before its bedtime is judged against them. */
const BEDTIME_BASELINE_NIGHTS = 3;

/**
 * A 0–100 score for one night, split the way the Health app splits its own:
 * duration against the goal (50), bedtime against the usual one (30) and
 * interruptions (20).
 *
 * Bedtime is consistency, not an ideal hour: within half an hour of the
 * median of the other nights scores in full, two and a half hours off scores
 * nothing. Too few other nights to know a habit, and it is not held against
 * the night.
 */
export function computeSleepScore(
  night: SleepNightStats,
  otherNights: readonly SleepNightStats[],
  goalSeconds: number
): SleepScore {
  const duration = Math.round(
    50 * Math.min(1, night.timeAsleepSeconds / Math.max(1, goalSeconds))
  );

  let bedtime = 30;
  if (otherNights.length >= BEDTIME_BASELINE_NIGHTS) {
    const usual = median(otherNights.map((n) => minutesFromNoon(n.bedtimeMs)));
    const off = Math.abs(minutesFromNoon(night.bedtimeMs) - usual);
    bedtime = Math.round(30 * Math.min(1, Math.max(0, (150 - off) / 120)));
  }

  const interruptions = Math.max(
    0,
    Math.min(
      20,
      20 - night.awakenings - Math.floor(night.awakeSeconds / 60 / 15)
    )
  );

  const asleep = Math.max(1, night.timeAsleepSeconds);
  const restorative = night.stageSeconds.rem + night.stageSeconds.deep;

  return {
    total: duration + bedtime + interruptions,
    duration: { points: duration, max: 50 },
    bedtime: { points: bedtime, max: 30 },
    interruptions: { points: interruptions, max: 20 },
    lowRestorative: night.hasStages && restorative / asleep < 0.3,
  };
}

/** The word under the score, on the Health app's own bands. */
export function sleepScoreRating(total: number, t: TFunction): string {
  if (total >= 96)
    return t('sleepScore.rating.veryHigh', { defaultValue: 'Very high' });
  if (total >= 81) return t('sleepScore.rating.high', { defaultValue: 'High' });
  if (total >= 71) return t('sleepScore.rating.ok', { defaultValue: 'OK' });
  if (total >= 41) return t('sleepScore.rating.low', { defaultValue: 'Low' });
  return t('sleepScore.rating.veryLow', { defaultValue: 'Very low' });
}
