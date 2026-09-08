import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import type { LocalRecord } from '../../src/services/local/database';
import { buildHourlyExerciseMinutes } from '../../src/utils/hourlyActivity';
import type { ExerciseSessionResponse } from '@workspace/shared';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = LocalRecord>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

const date = '2026-09-09';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

const createExercise = () =>
  request('/api/exercises', 'POST', {
    name: 'Rowing',
    modality: 'duration',
    calories_per_hour: 600,
  });

const dailySummary = () =>
  request<{ exerciseSessions: ExerciseSessionResponse[] }>(
    `/api/daily-summary?date=${date}`
  );

/**
 * The end-to-end question behind the Exercise chart: a locally logged workout
 * has to come back carrying *some* timestamp, or the chart has nothing to draw
 * and falls back to "Hourly data unavailable".
 */
describe('locally logged exercise feeds the hourly chart', () => {
  test('a standalone activity round-trips with a timestamp the chart can place', async () => {
    const exercise = await createExercise();
    await request('/api/exercise-entries', 'POST', {
      exercise_id: exercise.id,
      entry_date: date,
      duration_minutes: 2,
      calories_burned: 20,
      sets: [],
    });

    const { exerciseSessions } = await dailySummary();
    expect(exerciseSessions).toHaveLength(1);

    const hours = buildHourlyExerciseMinutes(exerciseSessions);
    expect(hours).toBeDefined();
    // Two minutes, in whichever hour the row was written.
    expect(hours?.reduce((sum, minutes) => sum + minutes, 0)).toBe(2);
  });

  test('a workout session round-trips with a timestamp too', async () => {
    const exercise = await createExercise();
    await request('/api/exercise-preset-entries', 'POST', {
      entry_date: date,
      name: 'Morning session',
      exercises: [
        {
          exercise_id: exercise.id,
          duration_minutes: 15,
          calories_burned: 150,
          sets: [],
        },
      ],
    });

    const { exerciseSessions } = await dailySummary();
    expect(exerciseSessions).toHaveLength(1);

    const hours = buildHourlyExerciseMinutes(exerciseSessions);
    expect(hours).toBeDefined();
    expect(hours?.reduce((sum, minutes) => sum + minutes, 0)).toBe(15);
  });
});
