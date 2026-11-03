import type { LocalRecord } from './database';

/** Preference fields that hold a provider id. */
const PROVIDER_REFS = [
  'default_food_data_provider_id',
  'default_barcode_provider_id',
] as const;

/**
 * Collapses providers that are the same source into one.
 *
 * Every installation seeds Open Food Facts and Free Exercise DB under fresh
 * ids, the way it seeds meal types (see `dedupeMealTypes`), so a device that
 * synced into an account already holding its own pair listed each provider
 * twice. A provider of the same type and name is the same source: the oldest
 * is kept and the default-provider preferences that named another are pointed
 * at it. The dropped rows then sync as deletions.
 *
 * Returns whether anything changed.
 */
export function dedupeProviders(
  tables: Record<string, LocalRecord[]>
): boolean {
  const providers = tables.providers;
  if (!providers || providers.length < 2) return false;

  const keyOf = (row: LocalRecord) =>
    `${String(row.provider_type ?? '')}\u0000${String(row.provider_name ?? '')
      .trim()
      .toLowerCase()}`;
  const order = (row: LocalRecord) => String(row.created_at ?? '');
  const keepers = new Map<string, LocalRecord>();
  for (const row of providers) {
    if (!row.provider_type) continue;
    const key = keyOf(row);
    const kept = keepers.get(key);
    if (
      !kept ||
      order(row) < order(kept) ||
      (order(row) === order(kept) && String(row.id) < String(kept.id))
    )
      keepers.set(key, row);
  }

  const replaced = new Map<string, string>();
  for (const row of providers) {
    const kept = row.provider_type ? keepers.get(keyOf(row)) : undefined;
    if (kept && kept !== row) replaced.set(String(row.id), String(kept.id));
  }
  if (replaced.size === 0) return false;

  tables.providers = providers.filter((row) => !replaced.has(String(row.id)));
  if (tables.preferences) {
    tables.preferences = tables.preferences.map((row) => {
      let next: LocalRecord | null = null;
      for (const field of PROVIDER_REFS) {
        const id = row[field];
        if (id != null && replaced.has(String(id))) {
          next ??= { ...row };
          next[field] = replaced.get(String(id));
        }
      }
      return next ?? row;
    });
  }
  return true;
}
