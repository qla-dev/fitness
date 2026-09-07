import { getTodayDate } from '../../utils/dateUtils';
import {
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';

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
  return versions.reduce(
    (goals, version) => ({ ...goals, ...version }),
    baseline
  );
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
