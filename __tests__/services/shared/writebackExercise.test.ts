import type { ExerciseSessionResponse } from '@workspace/shared';
import { sessionsToWorkouts } from '../../../src/services/shared/writebackExercise';

const DAY = '2026-06-01';
// Well after any window the fixtures below produce, so nothing is clamped unless
// a test asks for it by passing its own `now`.
const LATER = new Date(2026, 5, 2, 9, 0, 0, 0);

const individual = (
  overrides: Partial<Record<string, unknown>> = {}
): ExerciseSessionResponse =>
  ({
    type: 'individual',
    id: 'e1',
    name: 'Morning Run',
    exercise_id: 'x1',
    duration_minutes: 30,
    calories_burned: 300,
    entry_date: DAY,
    entry_time: '07:00',
    notes: null,
    distance: 5,
    avg_heart_rate: null,
    source: 'manual',
    sets: [],
    exercise_snapshot: null,
    activity_details: [],
    superset_group: null,
    ...overrides,
  }) as unknown as ExerciseSessionResponse;

const preset = (
  overrides: Partial<Record<string, unknown>> = {}
): ExerciseSessionResponse =>
  ({
    type: 'preset',
    id: 'p1',
    entry_date: DAY,
    workout_preset_id: 4,
    name: 'Push Day',
    description: null,
    notes: null,
    source: 'manual',
    total_duration_minutes: 45,
    exercises: [
      { calories_burned: 120, distance: null, entry_time: '18:30' },
      { calories_burned: 80, distance: null, entry_time: '18:00' },
    ],
    activity_details: [],
    ...overrides,
  }) as unknown as ExerciseSessionResponse;

describe('sessionsToWorkouts', () => {
  it('turns a manually logged activity into a workout window', () => {
    const [workout] = sessionsToWorkouts(DAY, [individual()], LATER);
    expect(workout).toMatchObject({
      id: 'e1',
      title: 'Morning Run',
      kind: 'running',
      energyKcal: 300,
      distanceMeters: 5000, // km in the diary, metres in the health store
    });
    expect(workout.start).toEqual(new Date(2026, 5, 1, 7, 0, 0, 0));
    expect(workout.end).toEqual(new Date(2026, 5, 1, 7, 30, 0, 0));
  });

  it('turns a grouped strength workout into one workout, not one per exercise', () => {
    const workouts = sessionsToWorkouts(DAY, [preset()], LATER);
    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({
      id: 'p1',
      title: 'Push Day',
      kind: 'strengthTraining', // a preset is a lifting session unless named otherwise
      energyKcal: 200, // summed across its exercises
    });
    // Starts at the EARLIEST exercise time, not the first one listed.
    expect(workouts[0].start).toEqual(new Date(2026, 5, 1, 18, 0, 0, 0));
    expect(workouts[0].end).toEqual(new Date(2026, 5, 1, 18, 45, 0, 0));
  });

  it('skips sessions imported from a health provider (the echo guard)', () => {
    expect(
      sessionsToWorkouts(
        DAY,
        [
          individual({ source: 'HealthKit' }),
          individual({ id: 'e2', source: 'HealthConnect' }),
          individual({ id: 'e3', source: 'Garmin' }),
        ],
        LATER
      )
    ).toEqual([]);
  });

  it('keeps sessions from every source qla.fit stamps itself', () => {
    const own = sessionsToWorkouts(
      DAY,
      [
        individual({ id: 'a', source: 'manual' }),
        individual({ id: 'b', source: 'sparky' }),
        individual({ id: 'c', source: 'Workout Plan' }), // case-insensitive
      ],
      LATER
    );
    expect(own.map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips a session of unknown provenance rather than guessing it is ours', () => {
    // Stricter than canEditGroupedWorkout on purpose: a null source is editable
    // but NOT proof the row came from the diary, and a wrong yes leaves a
    // permanent duplicate in the user's health store.
    expect(
      sessionsToWorkouts(
        DAY,
        [
          individual({ id: 'a', source: null }),
          individual({ id: 'b', source: '' }),
          individual({ id: 'c', source: 'Garmin Connect' }),
        ],
        LATER
      )
    ).toEqual([]);
  });

  it('skips the synthetic day-total rows the importer builds', () => {
    // 'Active Calories' / 'Apple Exercise Time' are provider day totals the
    // importer files as activities; writing them back would invent workouts.
    expect(
      sessionsToWorkouts(
        DAY,
        [
          individual({ id: 'ac', name: 'Active Calories', source: 'HealthKit' }),
          individual({
            id: 'aet',
            name: 'Apple Exercise Time',
            source: 'HealthKit',
          }),
        ],
        LATER
      )
    ).toEqual([]);
  });

  it('drops a session with no duration rather than writing a zero-length workout', () => {
    expect(
      sessionsToWorkouts(DAY, [individual({ duration_minutes: 0 })], LATER)
    ).toEqual([]);
    expect(
      sessionsToWorkouts(DAY, [preset({ total_duration_minutes: 0 })], LATER)
    ).toEqual([]);
  });

  it('anchors a session with no clock time at midday', () => {
    const [workout] = sessionsToWorkouts(
      DAY,
      [individual({ entry_time: null, created_at: null })],
      LATER
    );
    expect(workout.start).toEqual(new Date(2026, 5, 1, 12, 0, 0, 0));
  });

  it('falls back to created_at only when it lands on the same day', () => {
    const sameDay = sessionsToWorkouts(
      DAY,
      [
        individual({
          entry_time: null,
          created_at: new Date(2026, 5, 1, 6, 15, 0, 0).toISOString(),
        }),
      ],
      LATER
    );
    // created_at is the END of the window, so a 30-min session starts 30 before.
    expect(sameDay[0].end).toEqual(new Date(2026, 5, 1, 6, 15, 0, 0));
    expect(sameDay[0].start).toEqual(new Date(2026, 5, 1, 5, 45, 0, 0));

    // An edit made the next day must not drag the workout off its date.
    const otherDay = sessionsToWorkouts(
      DAY,
      [
        individual({
          entry_time: null,
          created_at: new Date(2026, 5, 3, 6, 15, 0, 0).toISOString(),
        }),
      ],
      LATER
    );
    expect(otherDay[0].start).toEqual(new Date(2026, 5, 1, 12, 0, 0, 0));
  });

  it('defers a session whose window would end in the future', () => {
    // Logged at 07:00 for 30 min, but it is only 07:10: written on a later run
    // rather than squeezed into the elapsed time.
    const now = new Date(2026, 5, 1, 7, 10, 0, 0);
    expect(sessionsToWorkouts(DAY, [individual()], now)).toEqual([]);
  });

  it('keeps the same window across runs, so an unchanged day never rewrites', () => {
    // The runaway this guards: a window derived from  moved every sync, so
    // the content signature changed every sync and writeback deleted and
    // re-saved the workout under a fresh UUID each time.
    const session = individual({ entry_time: null, created_at: new Date(2026, 5, 1, 9, 0, 0, 0).toISOString() });
    const first = sessionsToWorkouts(DAY, [session], new Date(2026, 5, 1, 10, 0, 0, 0));
    const later = sessionsToWorkouts(DAY, [session], new Date(2026, 5, 1, 23, 0, 0, 0));
    expect(first[0].start).toEqual(later[0].start);
    expect(first[0].end).toEqual(later[0].end);
  });

  it('hangs a timeless session so it ENDS at created_at, keeping its full duration', () => {
    // Anchored at the end because created_at is when the row was written, which
    // puts the whole window in the past — a just-logged workout is writable now.
    const [workout] = sessionsToWorkouts(
      DAY,
      [individual({ entry_time: null, created_at: new Date(2026, 5, 1, 9, 0, 0, 0).toISOString() })],
      LATER
    );
    expect(workout.end).toEqual(new Date(2026, 5, 1, 9, 0, 0, 0));
    expect(workout.start).toEqual(new Date(2026, 5, 1, 8, 30, 0, 0)); // 30 min kept
  });

  it('never truncates a long session to the elapsed part of the day', () => {
    // A 2h session logged at 00:43 crosses midnight rather than becoming 43 min.
    const created = new Date(2026, 5, 1, 0, 43, 0, 0);
    const [workout] = sessionsToWorkouts(
      DAY,
      [
        individual({
          entry_time: null,
          duration_minutes: 120,
          created_at: created.toISOString(),
        }),
      ],
      new Date(2026, 5, 1, 0, 44, 0, 0)
    );
    expect(workout.end).toEqual(created);
    expect(workout.start).toEqual(new Date(2026, 4, 31, 22, 43, 0, 0));
    expect(workout.end.getTime() - workout.start.getTime()).toBe(120 * 60000);
  });

  it('omits totals the session never recorded', () => {
    const [workout] = sessionsToWorkouts(
      DAY,
      [individual({ calories_burned: 0, distance: null })],
      LATER
    );
    expect(workout.energyKcal).toBeUndefined();
    expect(workout.distanceMeters).toBeUndefined();
  });

  it('names an unnamed individual entry after its exercise', () => {
    const [workout] = sessionsToWorkouts(
      DAY,
      [
        individual({
          name: null,
          exercise_snapshot: { name: 'Cycling', category: 'cardio' },
        }),
      ],
      LATER
    );
    expect(workout.title).toBe('Cycling');
    expect(workout.kind).toBe('cycling');
  });

  it('types a cardio preset from its name rather than defaulting to strength', () => {
    const [workout] = sessionsToWorkouts(
      DAY,
      [preset({ name: 'Interval Training' })],
      LATER
    );
    expect(workout.kind).toBe('hiit');
  });
});
