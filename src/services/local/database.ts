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

// All reads and writes join the same queue. A failed write neither advances the
// in-memory state nor poisons the queue. Re-read storage so restarts are identical.
let tail: Promise<unknown> = Promise.resolve();
export function localTransaction<T>(
  operation: (database: LocalDatabase) => T,
  mutation?: { method: string; endpoint: string; body?: unknown }
): Promise<T> {
  const task = tail.then(async () => {
    const raw = await AsyncStorage.getItem(LOCAL_DATABASE_KEY);
    // Corrupt/unknown versions must fail visibly, never reset user data.
    const db =
      raw === null ? initialDatabase() : databaseSchema.parse(JSON.parse(raw));
    const result = operation(db);
    if (mutation) {
      db.revision += 1;
      db.changes.push({
        id: randomUUID(),
        revision: db.revision,
        timestamp: new Date().toISOString(),
        ...mutation,
        body: mutation.body ?? null,
        result: result ?? null,
      });
    }
    const serialized = JSON.stringify(db);
    if (serialized !== raw) {
      await AsyncStorage.setItem(LOCAL_DATABASE_KEY, serialized);
    }
    return result;
  });
  tail = task.catch(() => undefined);
  return task;
}

export const table = (db: LocalDatabase, name: string): LocalRecord[] =>
  db.tables[name] ?? (db.tables[name] = []);
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
  rows.splice(rows.indexOf(row), 1);
}
