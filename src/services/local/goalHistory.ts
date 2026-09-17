import { getTodayDate } from '../../utils/dateUtils';
import {
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';

/**
 * Goals the Activity rings divide by. `activityRingProgress` returns 0 for any
 * ring whose goal is 0, so a goals row missing these fields — or holding a 0
 * for them — rendered three flat rings on every day no matter how much health
 * data was imported, in the Dashboard card and the ring calendar alike.
 *
 * A non-positive value counts as unset here, not as a choice: a ring with a
 * goal of 0 can never fill, so there is nothing a 0 could usefully express.
 * Lowering a goal to a real target still works; only 0 is substituted.
 */
const ACTIVITY_GOAL_DEFAULTS: LocalRecord = {
  steps: 10000,
  target_exercise_calories_burned: 500,
  target_exercise_duration_minutes: 30,
};

export function goalsForDate(db: LocalDatabase, date: string): LocalRecord {
  const baseline = table(db, 'goals')[0] ?? {};
  const versions = table(db, 'goalVersions')
    .filter(
      (row) =>
        typeof row.effective_date === 'string' && row.effective_date <= date
    )
    .sort((a, b) =>
      String(a.effective_date).localeCompare(String(b.effective_date))
    );
  // Spread rather than reduce onto `baseline` directly: with no versions the
  // reduce would hand back the stored row itself, and backfilling would then
  // mutate the database record in place.
  const resolved = versions.reduce<LocalRecord>(
    (goals, version) => ({ ...goals, ...version }),
    { ...baseline }
  );
  for (const [key, value] of Object.entries(ACTIVITY_GOAL_DEFAULTS)) {
    const stored = Number(resolved[key]);
    if (!Number.isFinite(stored) || stored <= 0) {
      resolved[key] = value;
    }
  }
  return resolved;
}

/** Preserve the legacy row as the historical baseline; updates begin today. */
export function saveGoalsFromToday(
  db: LocalDatabase,
  body: LocalRecord
): LocalRecord {
  const today = getTodayDate();
  const current = goalsForDate(db, today);
  const existing = table(db, 'goalVersions').find(
    (row) => row.effective_date === today
  );
  const values: LocalRecord = { ...current, ...body, effective_date: today };
  delete values.id;
  return saveRecord(db, 'goalVersions', values, existing?.id);
}
