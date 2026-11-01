import type { LocalRecord } from './database';

/**
 * Collapses meal types that share a name into one.
 *
 * Every installation seeds Breakfast, Lunch, Dinner and Snacks under fresh
 * ids, so a device that already held data when it first synced merged in the
 * account's own four alongside its own and showed every meal twice. Names are
 * what the user sees and picks, so two types with the same name are the same
 * meal: the oldest is kept, and everything that pointed at the others — diary
 * entries, logged meals, meal-plan assignments — is pointed at it. The
 * dropped rows then sync as deletions like any other removed record.
 *
 * Returns whether anything changed. Cheap when there is nothing to do: the
 * tables are only walked once a duplicate has been found.
 */
export function dedupeMealTypes(
  tables: Record<string, LocalRecord[]>
): boolean {
  const types = tables.mealTypes;
  if (!types || types.length < 2) return false;

  const keyOf = (row: LocalRecord) =>
    String(row.name ?? '')
      .trim()
      .toLowerCase();
  const order = (row: LocalRecord) => String(row.created_at ?? '');
  const keepers = new Map<string, LocalRecord>();
  for (const row of types) {
    const key = keyOf(row);
    if (!key) continue;
    const kept = keepers.get(key);
    if (
      !kept ||
      order(row) < order(kept) ||
      (order(row) === order(kept) && String(row.id) < String(kept.id))
    )
      keepers.set(key, row);
  }

  const replaced = new Map<string, string>();
  for (const row of types) {
    const kept = keepers.get(keyOf(row));
    if (kept && kept !== row) replaced.set(String(row.id), String(kept.id));
  }
  if (replaced.size === 0) return false;

  tables.mealTypes = types.filter((row) => !replaced.has(String(row.id)));
  for (const [name, rows] of Object.entries(tables)) {
    if (name === 'mealTypes' || !Array.isArray(rows)) continue;
    tables[name] = rows.map((row) => repoint(row, replaced) as LocalRecord);
  }
  return true;
}

/** Rewrites every `meal_type_id` found in a record, nested ones included. */
function repoint(value: unknown, replaced: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const out = repoint(item, replaced);
      if (out !== item) changed = true;
      return out;
    });
    return changed ? next : value;
  }
  if (!value || typeof value !== 'object') return value;
  let next: Record<string, unknown> | null = null;
  for (const [key, item] of Object.entries(value)) {
    const out =
      key === 'meal_type_id' && item != null && replaced.has(String(item))
        ? replaced.get(String(item))
        : repoint(item, replaced);
    if (out !== item) {
      next ??= { ...(value as Record<string, unknown>) };
      next[key] = out;
    }
  }
  return next ?? value;
}
