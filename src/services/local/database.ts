import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

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
});
export type LocalDatabase = z.infer<typeof databaseSchema>;
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
 * The whole database is a single AsyncStorage value, so re-reading it per
 * request made every tap pay for everything the user had ever synced: read the
 * string, `JSON.parse` it, validate every row of every table through Zod, then
 * serialize all of it again just to find out whether anything had changed. The
 * queue below is the only writer, so the object it already holds *is* the
 * database — storage is read once per launch and written only when a request
 * actually changed something.
 *
 * Dropped back to `null` whenever an operation or a write fails, so the next
 * transaction re-reads storage rather than carrying half-applied state
 * forward. That preserves the original guarantee: a failed write neither
 * advances the in-memory state nor poisons the queue.
 */
let cache: LocalDatabase | null = null;

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
    if (cache === null) {
      const raw = await AsyncStorage.getItem(LOCAL_DATABASE_KEY);
      // Corrupt/unknown versions must fail visibly, never reset user data.
      cache =
        raw === null
          ? initialDatabase()
          : databaseSchema.parse(JSON.parse(raw));
    }
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
        await AsyncStorage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(db));
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
