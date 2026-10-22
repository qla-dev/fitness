import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * SQLite persistence for the local database.
 *
 * The database used to be one AsyncStorage value: every diary edit rewrote
 * every table, imported health history included, and on Android the whole
 * value counted against AsyncStorage's size cap. Here each table is its own
 * row, so a save writes only the tables that changed, in one transaction.
 *
 * The in-memory shape callers work with is unchanged; this module only
 * decides what reaches disk.
 */
export type StoredDatabase = {
  /** Everything except `tables`: ids, revision, changelog, sync state. */
  meta: Record<string, unknown>;
  tables: Record<string, unknown[]>;
};

/** The JSON each table was last written as, to skip unchanged tables. */
export type StoredSnapshot = Map<string, string>;

const META_KEY = 'database';

let opening: Promise<SQLiteDatabase> | undefined;

function database(): Promise<SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync('fitness-local.db');
      await db.execAsync(`PRAGMA busy_timeout = 10000;
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS local_tables (name TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS local_meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);`);
      return db;
    })().catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

/**
 * The stored database and the snapshot of what is on disk, or null when
 * nothing has been stored yet. The meta row is written in the same
 * transaction as the tables, so its presence means a complete write.
 */
export async function readStoredDatabase(): Promise<{
  stored: StoredDatabase;
  snapshot: StoredSnapshot;
} | null> {
  const db = await database();
  const meta = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM local_meta WHERE key = ?',
    META_KEY
  );
  if (!meta) return null;
  const rows = await db.getAllAsync<{ name: string; data: string }>(
    'SELECT name, data FROM local_tables'
  );
  const snapshot: StoredSnapshot = new Map();
  const tables: Record<string, unknown[]> = {};
  for (const row of rows) {
    snapshot.set(row.name, row.data);
    tables[row.name] = JSON.parse(row.data);
  }
  return { stored: { meta: JSON.parse(meta.data), tables }, snapshot };
}

/** SQLite's "database is locked" (SQLITE_BUSY, code 5). */
function isLocked(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Error code 5|database is locked/i.test(message);
}

/**
 * Retries a write the database refused as locked. Another connection holding
 * the write lock is what this waits out — most often one a previous JS
 * runtime left open (a reload keeps the native connection alive, see
 * a3c9421) — and the busy timeout alone gave a health import one 10 s chance.
 * The transaction rolled back, so running it again writes nothing twice.
 */
async function retryWhenLocked<T>(write: () => Promise<T>): Promise<T> {
  const pauses = [500, 1500, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (!isLocked(error) || attempt >= pauses.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, pauses[attempt]));
    }
  }
}

/**
 * Runs one prepared statement once per row of parameters.
 *
 * `runAsync` finalizes in a `finally`, and SQLite's finalize repeats the
 * failed step's error, so the statement's real failure (locked, full, too
 * big) surfaced only as "Calling the 'finalizeAsync' function has failed".
 * Here a finalize error never replaces the error that caused it.
 */
async function runEach(
  db: SQLiteDatabase,
  sql: string,
  rows: (string | number)[][]
): Promise<void> {
  if (!rows.length) return;
  const statement = await db.prepareAsync(sql);
  let failed = false;
  try {
    for (const params of rows) await statement.executeAsync(...params);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await statement.finalizeAsync();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}

/**
 * Writes the tables that differ from `snapshot`, removes tables that are
 * gone, and replaces the meta row, all in one transaction. Returns the new
 * snapshot; on failure nothing is written and the caller keeps the old one.
 */
export async function writeStoredDatabase(
  next: StoredDatabase,
  snapshot: StoredSnapshot
): Promise<StoredSnapshot> {
  const db = await database();
  const updated: StoredSnapshot = new Map();
  const changed: [string, string][] = [];
  for (const [name, rows] of Object.entries(next.tables)) {
    const json = JSON.stringify(rows);
    updated.set(name, json);
    if (snapshot.get(name) !== json) changed.push([name, json]);
  }
  const removed = [...snapshot.keys()].filter((name) => !updated.has(name));
  await retryWhenLocked(() =>
    db.withTransactionAsync(async () => {
      await runEach(
        db,
        'INSERT INTO local_tables (name, data) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET data = excluded.data',
        changed
      );
      await runEach(
        db,
        'DELETE FROM local_tables WHERE name = ?',
        removed.map((name) => [name])
      );
      await runEach(
        db,
        'INSERT INTO local_meta (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data',
        [[META_KEY, JSON.stringify(next.meta)]]
      );
    })
  );
  return updated;
}
