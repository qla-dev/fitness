import type { SQLiteDatabase } from 'expo-sqlite';
import type { RecordedPoint, RecordingSession, SensorReading } from './types';

let opening: Promise<SQLiteDatabase> | undefined;
async function database() {
  if (!opening) {
    opening = (async () => {
      const { openDatabaseAsync } = await import('expo-sqlite');
      const db = await openDatabaseAsync('fitness-recordings.db');
      await db.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS recording_state (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS recording_samples (id INTEGER PRIMARY KEY, recording_id TEXT NOT NULL, kind TEXT NOT NULL, timestamp REAL NOT NULL, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS recording_samples_session ON recording_samples(recording_id, kind, timestamp);
        PRAGMA user_version = 1;`);
      return db;
    })().catch((error) => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

export async function loadRecording(): Promise<RecordingSession | null> {
  const row = await (
    await database()
  ).getFirstAsync<{ data: string }>(
    'SELECT data FROM recording_state WHERE id = 1'
  );
  return row ? (JSON.parse(row.data) as RecordingSession) : null;
}

// Called only through the recorder's serial queue: samples and their aggregate
// checkpoint commit together, and failures do not advance the in-memory state.
export async function checkpointRecording(
  session: RecordingSession,
  points: RecordedPoint[] = [],
  sensors: SensorReading[] = []
) {
  const db = await database();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const point of points)
      await tx.runAsync(
        'INSERT INTO recording_samples(recording_id, kind, timestamp, data) VALUES (?, ?, ?, ?)',
        session.id,
        'gps',
        point.timestamp,
        JSON.stringify(point)
      );
    for (const sample of sensors)
      await tx.runAsync(
        'INSERT INTO recording_samples(recording_id, kind, timestamp, data) VALUES (?, ?, ?, ?)',
        session.id,
        'sensor',
        sample.timestamp,
        JSON.stringify(sample)
      );
    await tx.runAsync(
      'INSERT OR REPLACE INTO recording_state(id, data) VALUES (1, ?)',
      JSON.stringify(session)
    );
  });
}

export async function recordingSamples<T extends RecordedPoint | SensorReading>(
  id: string,
  kind: 'gps' | 'sensor'
): Promise<T[]> {
  const rows = await (
    await database()
  ).getAllAsync<{ data: string }>(
    'SELECT data FROM recording_samples WHERE recording_id = ? AND kind = ? ORDER BY timestamp, id',
    id,
    kind
  );
  return rows.map((row) => JSON.parse(row.data) as T);
}

export async function clearRecording(id: string) {
  const db = await database();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'DELETE FROM recording_samples WHERE recording_id = ?',
      id
    );
    await tx.runAsync('DELETE FROM recording_state WHERE id = 1');
  });
}
