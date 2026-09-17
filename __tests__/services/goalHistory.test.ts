import {
  goalsForDate,
  saveGoalsFromToday,
} from '../../src/services/local/goalHistory';
import type { LocalDatabase } from '../../src/services/local/database';
import { getTodayDate } from '../../src/utils/dateUtils';

jest.mock('../../src/utils/dateUtils', () => ({ getTodayDate: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const database = (): LocalDatabase => ({
  schemaVersion: 1,
  deviceId: 'device',
  userId: 'user',
  revision: 0,
  nextId: 1,
  changes: [],
  tables: { goals: [{ id: 'goals', calories: 2000, protein: 100 }] },
});
beforeEach(() => jest.mocked(getTodayDate).mockReturnValue('2026-09-07'));

it('keeps the baseline for history and applies new goals today and in the future', () => {
  const db = database();
  saveGoalsFromToday(db, { calories: 2200, steps: 8000 });
  expect(goalsForDate(db, '2026-09-06').calories).toBe(2000);
  expect(goalsForDate(db, '2026-09-07').calories).toBe(2200);
  expect(goalsForDate(db, '2026-12-01').steps).toBe(8000);
  expect(db.tables.goals[0].calories).toBe(2000);
});

it('updates the same day without duplicating versions, and preserves earlier versions on subsequent days', () => {
  const db = database();
  const initial = saveGoalsFromToday(db, { calories: 2200 });
  saveGoalsFromToday(db, {
    ...initial,
    calories: 2300,
    effective_date: '2020-01-01',
  });
  expect(db.tables.goalVersions).toHaveLength(1);
  expect(goalsForDate(db, '2026-09-06').calories).toBe(2000);
  jest.mocked(getTodayDate).mockReturnValue('2026-09-08');
  saveGoalsFromToday(db, { calories: 2400, custom_nutrients: { test: 10 } });
  expect(goalsForDate(db, '2026-09-07').calories).toBe(2300);
  expect(goalsForDate(db, '2026-09-08').calories).toBe(2400);
  expect(goalsForDate(db, '2026-09-07').custom_nutrients).toBeUndefined();
  expect(db.tables.goalVersions).toHaveLength(2);
});

// Every Activity ring divides by one of these goals, and a goal of 0 renders
// an empty ring. A goals row saved before these fields existed must still
// produce fillable rings rather than three flat circles on every day.
it('backfills the Activity ring goals a stored row is missing', () => {
  const db = database();

  const goals = goalsForDate(db, '2026-09-07');

  expect(goals.steps).toBe(10000);
  expect(goals.target_exercise_calories_burned).toBe(500);
  expect(goals.target_exercise_duration_minutes).toBe(30);
});

it('keeps a real ring goal the user has chosen', () => {
  const db = database();
  saveGoalsFromToday(db, { steps: 6000 });

  const goals = goalsForDate(db, '2026-09-07');

  expect(goals.steps).toBe(6000);
  expect(goals.target_exercise_duration_minutes).toBe(30);
});

// A ring with a goal of 0 can never fill, so a stored 0 is treated as unset
// rather than as a choice — otherwise every ring reads empty forever no matter
// how much health data is imported.
it('replaces a ring goal stored as zero', () => {
  const db = database();
  saveGoalsFromToday(db, {
    steps: 0,
    target_exercise_calories_burned: 0,
    target_exercise_duration_minutes: 0,
  });

  const goals = goalsForDate(db, '2026-09-07');

  expect(goals.steps).toBe(10000);
  expect(goals.target_exercise_calories_burned).toBe(500);
  expect(goals.target_exercise_duration_minutes).toBe(30);
});

it('backfilling never mutates the stored goals row', () => {
  const db = database();

  goalsForDate(db, '2026-09-07');

  expect(db.tables.goals[0].steps).toBeUndefined();
});
