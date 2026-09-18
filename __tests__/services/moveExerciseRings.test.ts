import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { buildDailySummary } from '../../src/services/dailySummaryService';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

const date = '2026-09-18';

const APPLE_ACTIVE_KCAL = 540;
const APPLE_EXERCISE_SECONDS = 1800;
/** The run is inside both Apple totals above, not on top of them. */
const RUN_KCAL = 220;
const RUN_SECONDS = 1500;

const appleDay = () => [
  {
    type: 'Active Calories',
    value: APPLE_ACTIVE_KCAL,
    date,
    source: 'Apple Health',
  },
  {
    type: 'apple_exercise_time',
    value: APPLE_EXERCISE_SECONDS,
    unit: 'seconds',
    date,
    source: 'Apple Health',
  },
  {
    type: 'ExerciseSession',
    title: 'Run',
    duration: RUN_SECONDS,
    caloriesBurned: RUN_KCAL,
    date,
    timestamp: `${date}T07:00:00.000Z`,
    source_id: 'w-1',
    source: 'Apple Health',
  },
];

const syncAndSummarize = async (records: unknown[]) => {
  await request('/api/health-data', 'POST', records);
  const raw = await request<Record<string, unknown>>(
    `/api/daily-summary?date=${date}`
  );
  return buildDailySummary(date, {
    goals: (raw.goals ?? {}) as never,
    foodEntries: [],
    exerciseEntries: (raw.exerciseSessions ?? []) as never,
    waterIntake: { water_ml: 0 },
    stepCalories: 0,
  });
};

/**
 * The two rings read Apple's own daily figures and nothing derived.
 *
 * Both of Apple's totals already contain the workouts it recorded, so the
 * import carves those out of the synthetic day entry. The ring then adds the
 * workouts back, landing on Apple's number — while a workout logged in the app
 * that Apple never saw still counts on top. Getting either half wrong is
 * invisible in the data and shows up only as a ring that reads double, or (as
 * exercise time did before it was imported at all) zero.
 */
describe('Move and Exercise after an Apple Health sync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('Move is Apple active energy, counting its workouts once', async () => {
    const summary = await syncAndSummarize(appleDay());

    expect(summary.activeCalories + summary.otherExerciseCalories).toBe(
      APPLE_ACTIVE_KCAL
    );
  });

  test('Exercise is Apple exercise minutes, counting its workouts once', async () => {
    const summary = await syncAndSummarize(appleDay());

    expect(summary.exerciseMinutes).toBe(APPLE_EXERCISE_SECONDS / 60);
  });

  test('Apple exercise minutes survive a day with no workout to carve out', async () => {
    const summary = await syncAndSummarize(
      appleDay().filter((record) => record.type !== 'ExerciseSession')
    );

    expect(summary.exerciseMinutes).toBe(APPLE_EXERCISE_SECONDS / 60);
    expect(summary.activeCalories).toBe(APPLE_ACTIVE_KCAL);
  });

  test('re-syncing the same day replaces it rather than stacking', async () => {
    await syncAndSummarize(appleDay());
    const summary = await syncAndSummarize(appleDay());

    expect(summary.activeCalories + summary.otherExerciseCalories).toBe(
      APPLE_ACTIVE_KCAL
    );
    expect(summary.exerciseMinutes).toBe(APPLE_EXERCISE_SECONDS / 60);
  });

  // iOS and Android name this record differently, and only one name used to be
  // recognised — which is why the Move ring read 0 on iPhone alone.
  test.each(['Active Calories', 'active_calories'])(
    'Move reads active energy sent as %s',
    async (type) => {
      const summary = await syncAndSummarize([
        { type, value: APPLE_ACTIVE_KCAL, date, source: 'Apple Health' },
      ]);

      expect(summary.activeCalories).toBe(APPLE_ACTIVE_KCAL);
    }
  );

  // HealthKit answers AppleExerciseTime with a stream of short samples, not a
  // daily total. Stored under a per-day key they used to overwrite each other,
  // leaving the ring on whichever sample landed last.
  test('many exercise-time samples sum into the day', async () => {
    const samples = Array.from({ length: 21 }, (_, minute) => ({
      type: 'apple_exercise_time',
      value: 60,
      unit: 'seconds',
      date,
      timestamp: `${date}T${String(9 + Math.floor(minute / 10)).padStart(2, '0')}:${String(minute % 10).padStart(2, '0')}:00.000Z`,
      source: 'Apple Health',
    }));

    const summary = await syncAndSummarize(samples);

    expect(summary.exerciseMinutes).toBe(21);
  });

  test('re-syncing summed samples replaces the day, never adds to it', async () => {
    const samples = Array.from({ length: 21 }, () => ({
      type: 'apple_exercise_time',
      value: 60,
      unit: 'seconds',
      date,
      source: 'Apple Health',
    }));

    await syncAndSummarize(samples);
    const summary = await syncAndSummarize(samples);

    expect(summary.exerciseMinutes).toBe(21);
  });

  // Distance was registered as an activity metric long before anything fed
  // it, so the card and the goal screen both read a hardcoded 0 km.
  test('walking distance lands on the day in metres', async () => {
    await request('/api/health-data', 'POST', [
      {
        type: 'distance',
        value: 5090,
        unit: 'm',
        date,
        source: 'Apple Health',
      },
    ]);

    const days = await request<{ distance_m?: number }[]>(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    );

    expect(days[0]?.distance_m).toBe(5090);
  });

  test('standing hours come from the hours that contained standing', async () => {
    const stood = [
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
    ];
    await request('/api/health-data', 'POST', [
      {
        type: 'apple_stand_hours',
        value: 8,
        date,
        hourly: stood,
        source: 'Apple Health',
      },
    ]);

    const days = await request<{ stand_hours?: number }[]>(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    );
    const raw = await request<{ hourlyActivity?: Record<string, number[]> }>(
      `/api/daily-summary?date=${date}`
    );

    expect(days[0]?.stand_hours).toBe(8);
    expect(raw.hourlyActivity?.apple_stand_hours).toEqual(stood);
  });

  test('the Move chart gets the hours behind the day total', async () => {
    const hourly = new Array(24).fill(0);
    hourly[9] = 120;
    hourly[18] = 240;
    await request('/api/health-data', 'POST', [
      {
        type: 'active_calories',
        value: 360,
        date,
        hourly,
        source: 'Apple Health',
      },
    ]);

    const raw = await request<Record<string, unknown>>(
      `/api/daily-summary?date=${date}`
    );
    const summary = buildDailySummary(date, {
      goals: (raw.goals ?? {}) as never,
      foodEntries: [],
      exerciseEntries: (raw.exerciseSessions ?? []) as never,
      waterIntake: { water_ml: 0 },
      stepCalories: 0,
      hourlyActivity: raw.hourlyActivity as Record<string, number[]>,
    });

    expect(summary.hourlyMove).toEqual(hourly);
  });

  // The provider deduplicates across the devices feeding it, so its figure is
  // the answer — it used to be added to whatever the check-in row already held.
  test('steps read the provider total, not it plus the stored one', async () => {
    await request('/api/measurements/check-in', 'POST', {
      entry_date: date,
      steps: 876,
    });
    await request('/api/health-data', 'POST', [
      { type: 'step', value: 6577, date, source: 'Apple Health' },
    ]);
    await request('/api/health-data', 'POST', [
      { type: 'step', value: 6577, date, source: 'Apple Health' },
    ]);

    const days = await request<{ steps?: number }[]>(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    );

    expect(days[0]?.steps).toBe(6577);
  });

  test('a workout Apple never saw adds on top of its totals', async () => {
    const summary = await syncAndSummarize([
      ...appleDay(),
      {
        type: 'ExerciseSession',
        title: 'Evening swim',
        duration: 600,
        caloriesBurned: 150,
        date,
        timestamp: `${date}T19:00:00.000Z`,
        source_id: 'w-2',
        source: 'qla.fit',
      },
    ]);

    expect(summary.activeCalories + summary.otherExerciseCalories).toBe(
      APPLE_ACTIVE_KCAL + 150
    );
    expect(summary.exerciseMinutes).toBe(APPLE_EXERCISE_SECONDS / 60 + 10);
  });
});
