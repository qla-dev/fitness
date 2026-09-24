import {
  computeSleepScore,
  sleepNightStats,
  type SleepNightStats,
} from '../../src/utils/sleepScore';
import type { SleepStageLane, SleepTimelineDay } from '../../src/types/sleep';

const HOUR = 3_600_000;
const MINUTE = 60_000;

// A night starting at `bed` (local hours, may exceed 24) built from
// [stage, minutes] pieces laid end to end.
const night = (
  day: string,
  bed: number,
  pieces: [SleepStageLane, number][]
): SleepTimelineDay => {
  let cursor = new Date(`${day}T00:00:00`).getTime() + bed * HOUR - 24 * HOUR;
  const segments = pieces.map(([stage, minutes]) => {
    const segment = {
      stage,
      startMs: cursor,
      endMs: cursor + minutes * MINUTE,
    };
    cursor = segment.endMs;
    return segment;
  });
  return {
    day,
    timeInBedSeconds: 0,
    timeAsleepSeconds: null,
    segments,
    zone: null,
  };
};

const stats = (day: SleepTimelineDay) => sleepNightStats(day)!;

describe('sleepNightStats', () => {
  it('returns null for a day with no segments', () => {
    expect(sleepNightStats(night('2026-09-20', 23, []))).toBeNull();
  });

  it('counts only awake stretches between falling asleep and waking', () => {
    const result = stats(
      night('2026-09-20', 23, [
        ['awake', 20],
        ['light', 120],
        ['awake', 10],
        ['deep', 60],
        ['awake', 6],
        ['rem', 90],
        ['awake', 15],
      ])
    );
    expect(result.awakenings).toBe(2);
    expect(result.awakeSeconds).toBe(16 * 60);
    expect(result.timeAsleepSeconds).toBe(270 * 60);
    expect(result.hasStages).toBe(true);
  });
});

describe('computeSleepScore', () => {
  const usual = (day: string): SleepNightStats =>
    stats(night(day, 23, [['light', 480]]));
  const history = [
    usual('2026-09-15'),
    usual('2026-09-16'),
    usual('2026-09-17'),
  ];

  it('scores a full, regular, unbroken night at 100', () => {
    const score = computeSleepScore(
      stats(
        night('2026-09-20', 23, [
          ['light', 300],
          ['deep', 90],
          ['rem', 90],
        ])
      ),
      history,
      8 * 3600
    );
    expect(score.total).toBe(100);
    expect(score.lowRestorative).toBe(false);
  });

  it('scores duration against the goal and flags little REM and deep', () => {
    const score = computeSleepScore(
      stats(night('2026-09-20', 23, [['light', 180]])),
      history,
      8 * 3600
    );
    expect(score.duration.points).toBe(19);
    expect(score.lowRestorative).toBe(true);
  });

  it('takes bedtime points for a night far from the usual hour', () => {
    const score = computeSleepScore(
      stats(night('2026-09-20', 30, [['light', 480]])),
      history,
      8 * 3600
    );
    expect(score.bedtime.points).toBe(0);
  });

  it('does not judge bedtime without enough other nights', () => {
    const score = computeSleepScore(
      stats(night('2026-09-20', 30, [['light', 480]])),
      history.slice(0, 2),
      8 * 3600
    );
    expect(score.bedtime.points).toBe(30);
  });
});
