import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

type Day = {
  entry_date: string;
  active_calories: number;
  exercise_minutes: number;
  stand_hours: number;
  distance_m: number;
};

const range = (start: string, end: string) =>
  request<Day[]>(`/api/measurements/activity-range/${start}/${end}`);

/**
 * The history behind the four Activities metrics.
 *
 * Move and Exercise are the day's sessions folded through the same stats the
 * ring uses, rather than counted a second way here — a history that told a
 * different story from the number it sits under would be worse than no
 * history at all.
 */
describe('activity history', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('gives each day its move, exercise, stand and distance', async () => {
    await request('/api/health-data', 'POST', [
      {
        type: 'active_calories',
        value: 358,
        date: '2026-09-17',
        source: 'Apple Health',
      },
      {
        type: 'apple_exercise_time',
        value: 21 * 60,
        unit: 'seconds',
        date: '2026-09-17',
        source: 'Apple Health',
      },
      {
        type: 'apple_stand_hours',
        value: 8,
        date: '2026-09-17',
        source: 'Apple Health',
      },
      {
        type: 'distance',
        value: 5090,
        date: '2026-09-17',
        source: 'Apple Health',
      },
    ]);

    const days = await range('2026-09-17', '2026-09-17');

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      entry_date: '2026-09-17',
      active_calories: 358,
      exercise_minutes: 21,
      stand_hours: 8,
      distance_m: 5090,
    });
  });

  test('keeps the days apart and in order', async () => {
    await request('/api/health-data', 'POST', [
      {
        type: 'active_calories',
        value: 200,
        date: '2026-09-16',
        source: 'Apple Health',
      },
      {
        type: 'active_calories',
        value: 400,
        date: '2026-09-17',
        source: 'Apple Health',
      },
    ]);

    const days = await range('2026-09-16', '2026-09-17');

    expect(days.map((day) => day.entry_date)).toEqual([
      '2026-09-16',
      '2026-09-17',
    ]);
    expect(days.map((day) => day.active_calories)).toEqual([200, 400]);
  });

  test('leaves out days outside the window', async () => {
    await request('/api/health-data', 'POST', [
      {
        type: 'active_calories',
        value: 999,
        date: '2026-09-01',
        source: 'Apple Health',
      },
      {
        type: 'active_calories',
        value: 400,
        date: '2026-09-17',
        source: 'Apple Health',
      },
    ]);

    const days = await range('2026-09-16', '2026-09-17');

    expect(days.map((day) => day.entry_date)).toEqual(['2026-09-17']);
  });
});
