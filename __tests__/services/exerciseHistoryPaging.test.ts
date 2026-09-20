import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { resetLocalDatabaseCache } from '../../src/services/local/database';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

interface HistoryPage {
  sessions: { id: string; entry_date: string; name?: string | null }[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const history = (page: number, size = 20) =>
  request<HistoryPage>(
    `/api/v2/exercise-entries/history?page=${page}&pageSize=${size}`
  );

/** A standalone activity on `day`, through the same route the app uses. */
const logActivity = async (day: string, name: string) => {
  const exercise = await request<{ id: string }>(
    '/api/exercises',
    'POST',
    { name, modality: 'duration', category: 'cardio' }
  );
  await request('/api/exercise-entries', 'POST', {
    exercise_id: exercise.id,
    entry_date: day,
    duration_minutes: 30,
    calories_burned: 100,
    sets: [],
  });
};

/**
 * The history endpoint's paging contract.
 *
 * It exists as its own suite because the endpoint used to build EVERY session —
 * a Zod parse per row of both session tables — before slicing twenty out, and
 * paid that again for every page. The assertions below are about the answer
 * being right; the reason they matter is that the answer is now produced by
 * filtering and sorting raw rows and parsing only the page.
 */
describe('exercise history paging', () => {
  // The global hook resets the in-memory cache only; the persisted database
  // outlives it, so each test clears storage too and resets the cache after,
  // exactly as AGENTS.md requires of anything clearing AsyncStorage by hand.
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetLocalDatabaseCache();
  });

  it('returns newest first, one page at a time, and counts the whole history', async () => {
    const days = [
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
    ];
    for (const day of days) await logActivity(day, `Run ${day}`);

    const first = await history(1, 2);
    expect(first.sessions.map((s) => s.entry_date)).toEqual([
      '2026-03-05',
      '2026-03-04',
    ]);
    expect(first.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      totalCount: 5,
      totalPages: 3,
      hasMore: true,
    });

    const second = await history(2, 2);
    expect(second.sessions.map((s) => s.entry_date)).toEqual([
      '2026-03-03',
      '2026-03-02',
    ]);
    expect(second.pagination.hasMore).toBe(true);

    const last = await history(3, 2);
    expect(last.sessions.map((s) => s.entry_date)).toEqual(['2026-03-01']);
    expect(last.pagination.hasMore).toBe(false);
  });

  it('never repeats or drops a session across pages', async () => {
    for (let i = 1; i <= 7; i += 1) {
      await logActivity(`2026-04-0${i}`, `Session ${i}`);
    }

    const ids: string[] = [];
    for (let page = 1; page <= 4; page += 1) {
      const { sessions } = await history(page, 2);
      ids.push(...sessions.map((s) => s.id));
    }

    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it('answers an empty history without a page of nothing', async () => {
    const page = await history(1);
    expect(page.sessions).toEqual([]);
    expect(page.pagination).toMatchObject({
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
    });
  });
});
