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
 *
 * A busy timeout, because this is not always the only connection: a reload
 * opens a new one while the old one may still be mid-write, and without it
 * the new one's write failed on the spot with "database is locked".
 */
let opening: Promise<SQLiteDatabase> | undefined;

export function logDatabase(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync('app-logs.db');
      await db.execAsync(`PRAGMA busy_timeout = 3000;
        PRAGMA journal_mode = WAL;
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

/** Rows per INSERT; a flush is at most 20, so only an old-log import splits. */
const INSERT_CHUNK = 200;

/**
 * Appends entries given newest first (the order the buffer holds them) and
 * trims the table to `keep` rows. Row ids grow with insertion, so reading by
 * id descending returns newest first, as the old array did.
 *
 * One INSERT for the lot, not a BEGIN/INSERT…/COMMIT transaction: a reload
 * between those steps left the old connection holding the write lock with
 * no COMMIT ever coming, and every write after it failed with "database is
 * locked" until the app was killed. A single statement is atomic by itself
 * — a flush still lands whole or not at all — and finishes natively, so
 * nothing is left open whatever the JS does next. The trim is its own
 * statement for the same reason; running late, it only keeps a few extra
 * rows for a moment.
 */
export async function insertLogs(entries: LogEntry[], keep: number) {
  if (entries.length === 0) return;
  const db = await logDatabase();
  const oldestFirst = [...entries].reverse();
  for (let at = 0; at < oldestFirst.length; at += INSERT_CHUNK) {
    const chunk = oldestFirst.slice(at, at + INSERT_CHUNK);
    await db.runAsync(
      `INSERT INTO logs (timestamp, status, message, details) VALUES ${chunk
        .map(() => '(?, ?, ?, ?)')
        .join(', ')}`,
      ...chunk.flatMap((entry) => [
        entry.timestamp,
        entry.status,
        entry.message,
        JSON.stringify(entry.details),
      ])
    );
  }
  await db.runAsync(
    'DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT ?)',
    keep
  );
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
