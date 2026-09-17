import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { buildDailySummary } from '../../src/services/dailySummaryService';
import {
  activityRingProgress,
  ringProgressFromParts,
  type ActivityRingParts,
} from '../../src/constants/activityRings';
import type { DailySummaryApiResponse } from '../../src/services/api/dailySummaryApi';
import type { LocalRecord } from '../../src/services/local/database';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));

const date = '2026-09-17';
const request = <T = LocalRecord>(endpoint: string, body?: unknown) =>
  localApiFetch<T>({
    endpoint,
    method: body === undefined ? 'GET' : 'POST',
    body,
  });

beforeEach(async () => {
  await AsyncStorage.clear();
});

const importDay = () =>
  request('/api/health-data', [
    { type: 'step', value: 8200, date, source: 'Apple Health' },
    { type: 'Active Calories', value: 640, date, source: 'Apple Health' },
    {
      type: 'Workout',
      title: 'Outdoor Run',
      date,
      source: 'Apple Health',
      duration: 35 * 60,
      caloriesBurned: 410,
      source_id: 'w1',
    },
  ]);

/** The Dashboard card and the ring calendar both reduce to exactly this. */
const ringsForDay = async () => {
  const raw = await request<DailySummaryApiResponse>(
    `/api/daily-summary?date=${date}`
  );
  const measurements = await request<LocalRecord[]>(
    `/api/measurements/check-in-measurements-range/${date}/${date}`
  );
  const summary = buildDailySummary(date, {
    goals: raw.goals,
    foodEntries: raw.foodEntries,
    exerciseEntries: raw.exerciseSessions,
    waterIntake: { water_ml: raw.waterIntake },
    stepCalories: raw.stepCalories ?? 0,
  });
  return activityRingProgress(summary, Number(measurements?.[0]?.steps ?? 0));
};

test('a day of imported Apple Health data fills all three rings', async () => {
  await importDay();

  const rings = await ringsForDay();

  expect(rings.move).toBeGreaterThan(0);
  expect(rings.exercise).toBeGreaterThan(0);
  expect(rings.steps).toBeGreaterThan(0);
});

// A database created before the ring goals existed has no value to divide by,
// which rendered three flat rings on every day regardless of imported data.
test('a goals row predating the ring goals still fills the rings', async () => {
  await request('/api/goals', { calories: 2000, protein: 100 });
  await importDay();

  const rings = await ringsForDay();

  expect(rings.move).toBeGreaterThan(0);
  expect(rings.exercise).toBeGreaterThan(0);
  expect(rings.steps).toBeGreaterThan(0);
});

// The same symptom, but from a goals row that stored 0 for those fields: a
// ring whose goal is 0 can never fill, so 0 counts as unset rather than as a
// deliberate target.
test('ring goals stored as zero still fill the rings', async () => {
  await request('/api/goals', {
    calories: 2000,
    steps: 0,
    target_exercise_calories_burned: 0,
    target_exercise_duration_minutes: 0,
  });
  await importDay();

  const rings = await ringsForDay();

  expect(rings.move).toBeGreaterThan(0);
  expect(rings.exercise).toBeGreaterThan(0);
  expect(rings.steps).toBeGreaterThan(0);
});

// What the ring calendar actually renders: one request per visible month.
test('the month range returns a ring only for days that hold data', async () => {
  await request('/api/health-data', [
    { type: 'step', value: 8200, date: '2026-09-03', source: 'Apple Health' },
    {
      type: 'Active Calories',
      value: 640,
      date: '2026-09-03',
      source: 'Apple Health',
    },
    { type: 'step', value: 4100, date: '2026-09-11', source: 'Apple Health' },
  ]);

  const month = await request<Record<string, number | string>[]>(
    '/api/activity-rings-range/2026-09-01/2026-09-30'
  );

  expect(month.map((day) => day.entry_date)).toEqual([
    '2026-09-03',
    '2026-09-11',
  ]);

  const rings = month.map((day) =>
    ringProgressFromParts(day as unknown as ActivityRingParts)
  );
  // The busy day fills Move; the steps-only day does not.
  expect(rings[0].move).toBeGreaterThan(0);
  expect(rings[0].steps).toBeCloseTo(0.82);
  expect(rings[1].move).toBe(0);
  expect(rings[1].steps).toBeCloseTo(0.41);
});
