import type { ExerciseSessionResponse } from '@workspace/shared';
import { buildHourlyExerciseMinutes } from '../../src/utils/hourlyActivity';

type EntryFields = Partial<{
  entry_time: string | null;
  created_at: string | null;
  duration_minutes: number;
  sets: { completed_at: string | null }[];
}>;

/** A local ISO instant, so `created_at` / `completed_at` land in a known hour. */
const at = (hours: number, minutes = 0) =>
  new Date(2024, 5, 15, hours, minutes).toISOString();

const individual = (overrides: EntryFields) =>
  ({
    type: 'individual',
    id: 'entry-1',
    duration_minutes: 30,
    entry_time: null,
    created_at: null,
    sets: [],
    ...overrides,
  }) as unknown as ExerciseSessionResponse;

const preset = (
  exercises: EntryFields[],
  session: Partial<{
    created_at: string | null;
    total_duration_minutes: number;
  }> = {}
) =>
  ({
    type: 'preset',
    id: 'session-1',
    created_at: null,
    total_duration_minutes: 0,
    ...session,
    exercises: exercises.map((exercise, index) => ({
      id: `ex-${index}`,
      duration_minutes: 30,
      entry_time: null,
      created_at: null,
      sets: [],
      ...exercise,
    })),
  }) as unknown as ExerciseSessionResponse;

/** The hours that actually carry minutes, so assertions stay readable. */
const nonZero = (hours: number[] | undefined) =>
  hours === undefined
    ? undefined
    : hours
        .map((minutes, hour) => ({ hour, minutes }))
        .filter(({ minutes }) => minutes > 0);

describe('buildHourlyExerciseMinutes', () => {
  test('places an entry in the hour its clock time falls in', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '07:00', duration_minutes: 45 }),
    ]);

    expect(hours).toHaveLength(24);
    expect(nonZero(hours)).toEqual([{ hour: 7, minutes: 45 }]);
  });

  test('spreads an effort across every hour it actually covers', () => {
    // 07:30 + 60min straddles the boundary; two half bars, not one whole one in
    // the starting hour.
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '07:30', duration_minutes: 60 }),
    ]);

    expect(nonZero(hours)).toEqual([
      { hour: 7, minutes: 30 },
      { hour: 8, minutes: 30 },
    ]);
  });

  test('sums overlapping entries into the same hour', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '18:00', duration_minutes: 20 }),
      individual({ entry_time: '18:30', duration_minutes: 15 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 18, minutes: 35 }]);
  });

  test('uses the first completed set when no clock time was stated', () => {
    // The timestamp the app itself always writes: the active workout stamps
    // completed_at as each set is ticked off.
    const hours = buildHourlyExerciseMinutes([
      individual({
        duration_minutes: 20,
        sets: [{ completed_at: at(16, 10) }, { completed_at: at(16, 25) }],
      }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 16, minutes: 20 }]);
  });

  test('falls back to the span of completed sets when no duration was logged', () => {
    // A strength workout routinely logs zero minutes; the sets are what happened.
    const hours = buildHourlyExerciseMinutes([
      individual({
        duration_minutes: 0,
        sets: [{ completed_at: at(18, 0) }, { completed_at: at(18, 45) }],
      }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 18, minutes: 45 }]);
  });

  test('prefers a stated clock time over the completed sets', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({
        entry_time: '05:00',
        duration_minutes: 10,
        sets: [{ completed_at: at(20, 0) }],
      }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 5, minutes: 10 }]);
  });

  test('reads a preset session through its nested exercises', () => {
    const hours = buildHourlyExerciseMinutes([
      preset([
        { entry_time: '06:00', duration_minutes: 10 },
        { entry_time: '09:00', duration_minutes: 20 },
      ]),
    ]);

    expect(nonZero(hours)).toEqual([
      { hour: 6, minutes: 10 },
      { hour: 9, minutes: 20 },
    ]);
  });

  test('anchors a preset session on its own write time when nothing inside has one', () => {
    const hours = buildHourlyExerciseMinutes([
      preset([{ duration_minutes: 10 }], {
        created_at: at(11, 0),
        total_duration_minutes: 25,
      }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 11, minutes: 25 }]);
  });

  test('falls back to created_at when no clock time or set was recorded', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ created_at: at(14, 15), duration_minutes: 30 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 14, minutes: 30 }]);
  });

  test('gives a short entry its real length rather than rounding it away', () => {
    // The two-minute case: a bar has to appear, however small.
    const hours = buildHourlyExerciseMinutes([
      individual({ created_at: at(9, 30), duration_minutes: 2 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 9, minutes: 2 }]);
  });

  test('gives a zero-duration entry a single minute so it still draws', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '12:00', duration_minutes: 0 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 12, minutes: 1 }]);
  });

  test('clamps an effort that would run past midnight into the day', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '23:30', duration_minutes: 120 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 23, minutes: 30 }]);
  });

  test('reports unavailable rather than an empty day when nothing is timestamped', () => {
    expect(buildHourlyExerciseMinutes([individual({})])).toBeUndefined();
    expect(buildHourlyExerciseMinutes([preset([{}, {}])])).toBeUndefined();
    expect(buildHourlyExerciseMinutes([])).toBeUndefined();
    expect(buildHourlyExerciseMinutes(undefined)).toBeUndefined();
  });

  test('keeps the timestamped entries when only some of them carry a clock', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ duration_minutes: 45 }),
      individual({ entry_time: '10:00', duration_minutes: 30 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 10, minutes: 30 }]);
  });

  test('ignores a malformed clock string', () => {
    expect(
      buildHourlyExerciseMinutes([individual({ entry_time: '99:99' })])
    ).toBeUndefined();
    expect(
      buildHourlyExerciseMinutes([individual({ entry_time: 'not a time' })])
    ).toBeUndefined();
  });

  test('accepts a seconds-bearing clock string', () => {
    const hours = buildHourlyExerciseMinutes([
      individual({ entry_time: '16:45:30', duration_minutes: 10 }),
    ]);

    expect(nonZero(hours)).toEqual([{ hour: 16, minutes: 10 }]);
  });
});
