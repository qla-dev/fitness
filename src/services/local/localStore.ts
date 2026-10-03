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
      await db.execAsync(`PRAGMA busy_timeout = 3000;
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
  await db.withTransactionAsync(async () => {
    for (const [name, json] of changed) {
      await db.runAsync(
        'INSERT INTO local_tables (name, data) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET data = excluded.data',
        name,
        json
      );
    }
    for (const name of removed) {
      await db.runAsync('DELETE FROM local_tables WHERE name = ?', name);
    }
    await db.runAsync(
      'INSERT INTO local_meta (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data',
      META_KEY,
      JSON.stringify(next.meta)
    );
  });
  return updated;
}
