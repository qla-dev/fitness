import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { LogEntry, LogStatus } from './LogService';

/**
 * Where log entries live: one row each in their own small database.
 *
 * They used to be a single AsyncStorage value holding up to a thousand
 * entries, so every flush parsed and re-serialized all of them to add a few,
 * and on Android the whole blob counted against AsyncStorage's size cap. As
 * rows, adding an entry is an insert, trimming is a delete, and the log
 * screen reads one page instead of the whole history.
 *
 * A file of its own rather than a table in the recordings database: logging
 * runs from everywhere, including while a recording checkpoints, and must not
 * queue behind or lock that database.
 */
let opening: Promise<SQLiteDatabase> | undefined;

export function logDatabase(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync('app-logs.db');
      await db.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS logs_timestamp ON logs(timestamp);`);
      return db;
    })().catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

type Row = {
  timestamp: string;
  status: string;
  message: string;
  details: string;
};

const toEntry = (row: Row): LogEntry => {
  let details: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.details);
    if (Array.isArray(parsed)) details = parsed.map(String);
  } catch {
    /* A malformed row keeps its message; the details are only extra context. */
  }
  return {
    timestamp: row.timestamp,
    status: row.status as LogStatus,
    message: row.message,
    details,
  };
};

/**
 * Appends entries given newest first (the order the buffer holds them) and
 * trims the table to `keep` rows. Row ids grow with insertion, so reading by
 * id descending returns newest first, as the old array did.
 */
export async function insertLogs(entries: LogEntry[], keep: number) {
  if (entries.length === 0) return;
  const db = await logDatabase();
  await db.withTransactionAsync(async () => {
    for (const entry of [...entries].reverse()) {
      await db.runAsync(
        'INSERT INTO logs (timestamp, status, message, details) VALUES (?, ?, ?, ?)',
        entry.timestamp,
        entry.status,
        entry.message,
        JSON.stringify(entry.details)
      );
    }
    await db.runAsync(
      'DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT ?)',
      keep
    );
  });
}

const placeholders = (count: number) => Array(count).fill('?').join(', ');

/** One page, newest first, of entries whose status is in `statuses`. */
export async function readLogs(
  statuses: LogStatus[],
  offset: number,
  limit: number
): Promise<LogEntry[]> {
  if (statuses.length === 0 || limit <= 0) return [];
  const db = await logDatabase();
  const rows = await db.getAllAsync<Row>(
    `SELECT timestamp, status, message, details FROM logs
     WHERE status IN (${placeholders(statuses.length)})
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    ...statuses,
    limit,
    Math.max(0, offset)
  );
  return rows.map(toEntry);
}

/** Counts per status for entries stamped in [from, to), ISO strings. */
export async function countLogsBetween(
  statuses: LogStatus[],
  from: string,
  to: string
): Promise<Partial<Record<LogStatus, number>>> {
  if (statuses.length === 0) return {};
  const db = await logDatabase();
  const rows = await db.getAllAsync<{ status: LogStatus; count: number }>(
    `SELECT status, COUNT(*) AS count FROM logs
     WHERE status IN (${placeholders(statuses.length)})
       AND timestamp >= ? AND timestamp < ?
     GROUP BY status`,
    ...statuses,
    from,
    to
  );
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

/** Deletes entries stamped before `cutoff` (ISO); returns how many went. */
export async function deleteLogsBefore(cutoff: string): Promise<number> {
  const db = await logDatabase();
  const result = await db.runAsync(
    'DELETE FROM logs WHERE timestamp < ?',
    cutoff
  );
  return result.changes;
}

export async function deleteAllLogs() {
  const db = await logDatabase();
  await db.runAsync('DELETE FROM logs');
}

/** Test hook: the next call opens a fresh database. */
export function _resetLogDatabaseForTesting() {
  opening = undefined;
}
