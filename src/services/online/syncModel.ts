import type { LocalRecord } from '../local/database';

export const SYNC_COLLECTIONS = [
  'profile',
  'preferences',
  'goals',
  'goalVersions',
  'mealTypes',
  'waterContainers',
  'providers',
  'foods',
  'variants',
  'entries',
  'loggedMeals',
  'favorites',
  'meals',
  'exercises',
  'activities',
  'workouts',
  'presets',
  'water',
  'measurements',
  'measurementCategories',
  'customMeasurements',
  'healthRecords',
  'sleep',
  'nutrientDisplay',
  'progressPhotos',
  'workoutPhotos',
  'watchMeasurementReceipts',
  'markaiReceipts',
];
export type SyncRecord = {
  id: string;
  version: number;
  data: LocalRecord | null;
  deleted: boolean;
};
export type SyncTables = Record<string, SyncRecord[]>;
export type SyncChange = {
  collection: string;
  id: string;
  base_version: number;
  data: LocalRecord | null;
};
export type SyncState = {
  accountId: string;
  baseline: SyncTables;
  pending?: {
    request_id: string;
    changes: SyncChange[];
    sent: Record<string, LocalRecord[]>;
  };
};

export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
        )
      : item
  );
}

export function changesSince(
  tables: Record<string, LocalRecord[]>,
  baseline: SyncTables
): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const collection of SYNC_COLLECTIONS) {
    const old = new Map(
      (baseline[collection] ?? []).map((row) => [row.id, row])
    );
    const current = new Map(
      (tables[collection] ?? []).map((row) => [String(row.id), row])
    );
    for (const [id, data] of current) {
      if (!id || id === 'undefined')
        throw new Error(`Cannot sync ${collection}: a record has no ID.`);
      const before = old.get(id);
      if (fingerprint(data) !== fingerprint(before?.data ?? null))
        changes.push({
          collection,
          id,
          base_version: before?.version ?? 0,
          data,
        });
    }
    for (const [id, before] of old)
      if (!before.deleted && !current.has(id))
        changes.push({
          collection,
          id,
          base_version: before.version,
          data: null,
        });
  }
  return changes;
}

/** Apply remote rows only where the device has not changed since the request began. */
export function mergeResponse(
  current: Record<string, LocalRecord[]>,
  sent: Record<string, LocalRecord[]>,
  remote: SyncTables
): Record<string, LocalRecord[]> {
  const result = { ...current };
  for (const collection of SYNC_COLLECTIONS) {
    const rows = new Map(
      (current[collection] ?? []).map((row) => [String(row.id), row])
    );
    const before = new Map(
      (sent[collection] ?? []).map((row) => [String(row.id), row])
    );
    for (const record of remote[collection] ?? []) {
      if (
        fingerprint(rows.get(record.id) ?? null) !==
        fingerprint(before.get(record.id) ?? null)
      )
        continue;
      if (record.deleted || !record.data) rows.delete(record.id);
      else rows.set(record.id, record.data);
    }
    result[collection] = [...rows.values()];
  }
  return result;
}
