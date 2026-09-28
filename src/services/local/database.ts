import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import {
  readStoredDatabase,
  writeStoredDatabase,
  type StoredDatabase,
  type StoredSnapshot,
} from './localStore';
import { addLog } from '../LogService';

export type LocalRecord = Record<string, unknown>;
const record = z.record(z.string(), z.unknown());
const databaseSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string(),
  userId: z.string(),
  revision: z.number().int().nonnegative(),
  nextId: z.number().int().positive(),
  tables: z.record(z.string(), z.array(record)),
  changes: z.array(
    z.object({
      id: z.string(),
      revision: z.number(),
      timestamp: z.string(),
      method: z.string(),
      endpoint: z.string(),
      body: z.unknown(),
      result: z.unknown(),
    })
  ),
  onlineSync: z.unknown().optional(),
});
export type LocalDatabase = z.infer<typeof databaseSchema>;
/**
 * Where the database lived before SQLite. Read once to transfer it, then
 * deleted; still written only while SQLite cannot be opened.
 */
export const LOCAL_DATABASE_KEY = '@Fitness/local-database/v1';

const initialDatabase = (): LocalDatabase => ({
  schemaVersion: 1,
  deviceId: randomUUID(),
  userId: randomUUID(),
  revision: 0,
  nextId: 1,
  tables: {},
  changes: [],
});

/**
 * How many mutations the changelog keeps.
 *
 * Nothing in the app reads `changes` — it is a debugging trail — but every
 * entry held its full request body and result forever, so a health import
 * stored a second copy of everything it imported and the database grew without
 * any user-visible data growing with it. Every later request then paid to
 * parse and re-serialize that dead weight.
 */
const CHANGE_LOG_LIMIT = 50;

/** Above this many items, a body/result is summarized instead of copied. */
const CHANGE_LOG_MAX_ITEMS = 25;

/**
 * A changelog entry keeps the shape of what was sent, not a second copy of it.
 * Health uploads arrive as arrays of thousands of records; the trail only ever
 * needs to say which endpoint ran and how much went through it.
 */
const summarizeForChangeLog = (value: unknown): unknown => {
  if (Array.isArray(value))
    return value.length > CHANGE_LOG_MAX_ITEMS
      ? { omitted: true, items: value.length }
      : value;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.some(([, item]) => Array.isArray(item)))
      return Object.fromEntries(
        entries.map(([key, item]) => [key, summarizeForChangeLog(item)])
      );
  }
  return value ?? null;
};

/**
 * The parsed database, held between transactions.
 *
 * Re-reading storage per request made every tap pay for everything the user
 * had ever synced: parse it, validate every row of every table through Zod,
 * then serialize all of it again just to find out whether anything had
 * changed. The queue below is the only writer, so the object it already holds
 * *is* the database — storage is read once per launch and written only when a
 * request actually changed something, and then only the changed tables.
 *
 * Dropped back to `null` whenever an operation or a write fails, so the next
 * transaction re-reads storage rather than carrying half-applied state
 * forward. That preserves the original guarantee: a failed write neither
 * advances the in-memory state nor poisons the queue.
 */
let cache: LocalDatabase | null = null;

/**
 * Where this launch persists: SQLite, or AsyncStorage for a session in which
 * SQLite could not be opened (the next launch compares the two and keeps the
 * newer, so nothing written meanwhile is lost).
 */
let backend: 'sqlite' | 'asyncStorage' = 'sqlite';
/** What SQLite holds per table, so a save writes only what changed. */
let snapshot: StoredSnapshot = new Map();

const split = (db: LocalDatabase): StoredDatabase => {
  const { tables, ...meta } = db;
  return { meta, tables };
};

/**
 * Copies the AsyncStorage database into SQLite, reads it back, and deletes
 * the AsyncStorage copy only once every table matches. Any failure leaves
 * AsyncStorage as it was and keeps this session on it, so the transfer is
 * retried at the next launch.
 */
async function transferToSqlite(
  legacy: LocalDatabase,
  base: StoredSnapshot
): Promise<void> {
  try {
    const written = await writeStoredDatabase(split(legacy), base);
    const check = await readStoredDatabase();
    const matches =
      check !== null &&
      check.stored.meta.revision === legacy.revision &&
      check.snapshot.size === Object.keys(legacy.tables).length &&
      Object.entries(legacy.tables).every(
        ([name, rows]) => check.snapshot.get(name) === JSON.stringify(rows)
      );
    if (!matches) throw new Error('Transferred database did not read back');
    snapshot = written;
    backend = 'sqlite';
    await AsyncStorage.removeItem(LOCAL_DATABASE_KEY);
    addLog('[LocalDatabase] Moved from AsyncStorage to SQLite', 'INFO', [
      `${Object.keys(legacy.tables).length} tables, revision ${legacy.revision}`,
    ]);
  } catch (error) {
    backend = 'asyncStorage';
    addLog(
      '[LocalDatabase] SQLite transfer failed; kept AsyncStorage',
      'WARNING',
      [String(error)]
    );
  }
}

async function loadDatabase(): Promise<LocalDatabase> {
  const raw = await AsyncStorage.getItem(LOCAL_DATABASE_KEY);
  const parseLegacy = () =>
    raw === null ? null : databaseSchema.parse(JSON.parse(raw));
  let stored: Awaited<ReturnType<typeof readStoredDatabase>>;
  try {
    stored = await readStoredDatabase();
  } catch (error) {
    backend = 'asyncStorage';
    addLog(
      '[LocalDatabase] SQLite unavailable; using AsyncStorage',
      'WARNING',
      [String(error)]
    );
    // Corrupt/unknown versions must fail visibly, never reset user data.
    return parseLegacy() ?? initialDatabase();
  }
  backend = 'sqlite';
  let legacy: LocalDatabase | null;
  try {
    legacy = parseLegacy();
  } catch (error) {
    // The only copy is damaged: fail visibly, never reset user data.
    if (!stored) throw error;
    // A damaged leftover beside a good SQLite copy must not lock the app
    // out; it is left untouched in case it is needed.
    addLog(
      '[LocalDatabase] Ignored an unreadable AsyncStorage copy',
      'WARNING',
      [String(error)]
    );
    legacy = null;
  }
  // A newer AsyncStorage copy is one written during a fallback session (or a
  // transfer that never finished): it wins, and is transferred again.
  if (
    stored &&
    (legacy === null || Number(stored.stored.meta.revision) >= legacy.revision)
  ) {
    const db = databaseSchema.parse({
      ...stored.stored.meta,
      tables: stored.stored.tables,
    });
    snapshot = stored.snapshot;
    // Left over from a transfer interrupted after SQLite committed.
    if (legacy) await AsyncStorage.removeItem(LOCAL_DATABASE_KEY);
    return db;
  }
  snapshot = stored?.snapshot ?? new Map();
  if (legacy === null) return initialDatabase();
  await transferToSqlite(legacy, snapshot);
  return legacy;
}

async function persistDatabase(db: LocalDatabase): Promise<void> {
  if (backend === 'sqlite') {
    snapshot = await writeStoredDatabase(split(db), snapshot);
  } else {
    await AsyncStorage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(db));
  }
}

/**
 * Loads the database once at launch, off the first screen's critical path,
 * which is also when an AsyncStorage database moves into SQLite. Requests
 * that arrive meanwhile wait in the same queue.
 */
export const warmLocalDatabase = (): Promise<void> =>
  localTransaction(() => undefined).catch((error: unknown) => {
    addLog('[LocalDatabase] Load at launch failed', 'ERROR', [String(error)]);
  });

/**
 * Set by the mutating primitives below, and by the seeding in `localApi.ts`,
 * which assigns tables directly. Read requests leave it alone, which is what
 * lets them skip serialization entirely. Every path that edits a record runs
 * under a non-GET request, and those persist regardless of this flag.
 */
let dirty = false;

export const markLocalDatabaseDirty = (): void => {
  dirty = true;
};

/** Discards the in-memory copy. The next transaction re-reads storage. */
export const resetLocalDatabaseCache = (): void => {
  cache = null;
  dirty = false;
};

// All reads and writes join the same queue. A failed write neither advances the
// in-memory state nor poisons the queue.
let tail: Promise<unknown> = Promise.resolve();
export function localTransaction<T>(
  operation: (database: LocalDatabase) => T,
  mutation?: { method: string; endpoint: string; body?: unknown }
): Promise<T> {
  const task = tail.then(async () => {
    if (cache === null) cache = await loadDatabase();
    const db = cache;
    dirty = false;

    let result: T;
    try {
      result = operation(db);
    } catch (error) {
      resetLocalDatabaseCache();
      throw error;
    }

    if (mutation) {
      db.revision += 1;
      db.changes.push({
        id: randomUUID(),
        revision: db.revision,
        timestamp: new Date().toISOString(),
        method: mutation.method,
        endpoint: mutation.endpoint,
        body: summarizeForChangeLog(mutation.body),
        result: summarizeForChangeLog(result),
      });
      if (db.changes.length > CHANGE_LOG_LIMIT)
        db.changes.splice(0, db.changes.length - CHANGE_LOG_LIMIT);
      dirty = true;
    }

    if (dirty) {
      dirty = false;
      try {
        await persistDatabase(db);
      } catch (error) {
        resetLocalDatabaseCache();
        throw error;
      }
    }
    return result;
  });
  tail = task.catch(() => undefined);
  return task;
}

export const table = (db: LocalDatabase, name: string): LocalRecord[] => {
  const rows = db.tables[name];
  if (rows) return rows;
  markLocalDatabaseDirty();
  return (db.tables[name] = []);
};
export const newId = (): string => randomUUID();
export const asRecord = (value: unknown): LocalRecord => record.parse(value);
export const asRecords = (value: unknown): LocalRecord[] =>
  z.array(record).parse(value ?? []);
export const findRecord = (
  db: LocalDatabase,
  name: string,
  id: unknown
): LocalRecord => {
  const row = table(db, name).find((item) => String(item.id) === String(id));
  if (!row) throw new Error(`Local ${name} record not found: ${String(id)}`);
  return row;
};
export function saveRecord(
  db: LocalDatabase,
  name: string,
  body: LocalRecord,
  id?: unknown
): LocalRecord {
  const rows = table(db, name);
  const previous = id === undefined ? undefined : findRecord(db, name, id);
  const now = new Date().toISOString();
  const row = {
    id: newId(),
    user_id: db.userId,
    created_at: now,
    ...previous,
    ...body,
    updated_at: now,
  };
  markLocalDatabaseDirty();
  if (previous) rows[rows.indexOf(previous)] = row;
  else rows.push(row);
  return row;
}
export function deleteRecord(
  db: LocalDatabase,
  name: string,
  id: unknown
): void {
  const row = findRecord(db, name, id);
  const rows = table(db, name);
  markLocalDatabaseDirty();
  rows.splice(rows.indexOf(row), 1);
}
