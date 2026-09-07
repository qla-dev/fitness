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
