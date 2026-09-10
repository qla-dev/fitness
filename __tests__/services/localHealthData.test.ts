import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { syncHealthData } from '../../src/services/api/healthDataApi';
import { getActiveServerConfig } from '../../src/services/storage';
import {
  type LocalRecord,
  LOCAL_DATABASE_KEY,
} from '../../src/services/local/database';
import type { DailySummaryApiResponse } from '../../src/services/api/dailySummaryApi';
import { calculateExerciseStats } from '../../src/utils/workoutSession';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));

const date = '2026-09-10';
const request = <T = LocalRecord>(endpoint: string, body?: unknown) =>
  localApiFetch<T>({
    endpoint,
    method: body === undefined ? 'GET' : 'POST',
    body,
  });
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('imports into local storage without a server, preserves manual data and updates repeated imports', async () => {
  await request('/api/measurements/check-in', {
    entry_date: date,
    steps: 100,
    weight: 80,
  });
  await request('/api/measurements/water-intake', {
    entry_date: date,
    container_id: 1,
    change_drinks: 1,
  });
  const exercise = await request('/api/exercises', {
    name: 'Manual ride',
    modality: 'duration',
  });
  await request('/api/exercise-entries', {
    exercise_id: exercise.id,
    entry_date: date,
    duration_minutes: 10,
    calories_burned: 50,
  });
  const payload = [
    { type: 'step', date, source: 'HealthKit', value: 5000 },
    { type: 'Active Calories', date, source: 'HealthKit', value: 400 },
    {
      type: 'ExerciseSession',
      date,
      source: 'HealthKit',
      source_id: 'workout-1',
      title: 'Running',
      duration: 1800,
      caloriesBurned: 200,
      distance: 5,
      sets: [{ set_number: 1, duration_seconds: 1800 }],
    },
    {
      type: 'water',
      date,
      source: 'HealthKit',
      source_id: 'drink-1',
      value: 300,
    },
    { type: 'weight', date, source: 'HealthKit', value: 79 },
    {
      type: 'Nutrition',
      date,
      source: 'HealthKit',
      source_id: 'food-1',
      food_name: 'Apple',
      calories: 80,
      protein: 1,
    },
    { type: 'heart_rate', date, source: 'HealthKit', value: 70 },
  ];
  expect(await syncHealthData(payload)).toEqual({
    recordsSent: 7,
    recordErrors: [],
  });
  await syncHealthData(payload);
  expect(getActiveServerConfig).not.toHaveBeenCalled();
  const summary = await request<DailySummaryApiResponse>(
    `/api/daily-summary?date=${date}`
  );
  expect(summary.exerciseSessions).toHaveLength(3);
  expect(calculateExerciseStats(summary.exerciseSessions).durationMinutes).toBe(
    40
  );
  expect(calculateExerciseStats(summary.exerciseSessions).caloriesBurned).toBe(
    450
  );
  expect(summary.waterIntake).toBe(550);
  expect(summary.foodEntries).toHaveLength(1);
  expect(summary.foodEntries[0]).toMatchObject({
    calories: 80,
    food_name: 'Apple',
  });
  expect(
    await request(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    )
  ).toEqual([expect.objectContaining({ steps: 5100, weight: 80 })]);
  await syncHealthData([{ ...payload[0], value: 6000 }]);
  expect(
    await request(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    )
  ).toEqual([expect.objectContaining({ steps: 6100 })]);
  expect(
    await request<LocalRecord[]>('/api/measurements/custom-entries/' + date)
  ).toHaveLength(1);
});

test('uses the record timezone and rolls back a malformed import without touching current data', async () => {
  await syncHealthData([
    {
      type: 'step',
      timestamp: '2026-09-09T23:30:00Z',
      record_timezone: 'Europe/Sarajevo',
      source: 'HealthKit',
      value: 20,
    },
  ]);
  expect(
    await request(
      `/api/measurements/check-in-measurements-range/${date}/${date}`
    )
  ).toEqual([expect.objectContaining({ steps: 20 })]);
  const before = await AsyncStorage.getItem(LOCAL_DATABASE_KEY);
  await expect(
    syncHealthData([
      { type: 'step', date, value: 90 },
      { type: 'step', timestamp: 'bad', value: 1 },
    ])
  ).rejects.toThrow('Invalid health record date');
  expect(await AsyncStorage.getItem(LOCAL_DATABASE_KEY)).toBe(before);
});

test('files sleep under the wake-up day and filters the requested range', async () => {
  const sleep = {
    type: 'SleepSession',
    source: 'HealthKit',
    timestamp: '2026-09-09T20:00:00Z',
    bedtime: '2026-09-09T20:00:00Z',
    wake_time: '2026-09-10T05:00:00Z',
    duration_in_seconds: 32400,
    record_timezone: 'Europe/Sarajevo',
  };
  await syncHealthData([sleep]);
  await syncHealthData([sleep]);
  expect(
    await request<LocalRecord[]>(`/api/sleep?startDate=${date}&endDate=${date}`)
  ).toEqual([
    expect.objectContaining({
      entry_date: date,
      duration_in_seconds: 32400,
      stage_events: [],
    }),
  ]);
  expect(
    await request('/api/sleep?startDate=2026-09-09&endDate=2026-09-09')
  ).toEqual([]);
});
