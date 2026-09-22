import AsyncStorage from '@react-native-async-storage/async-storage';

import { addLog } from './LogService';

const STORAGE_KEY = '@SparkyFitness/recent-searches';

/**
 * How many past queries are kept.
 *
 * A recents list is read from the top and never paged back: past the first
 * handful it is a second, worse search rather than a shortcut. Small enough
 * that the whole list fits above the keyboard.
 */
export const RECENT_SEARCH_LIMIT = 8;

/** Longer than this is a sentence, not a query worth offering again. */
const MAX_QUERY_LENGTH = 64;

/**
 * The snapshot returned before the first load resolves.
 *
 * One shared array, not a fresh literal: `useSyncExternalStore` compares
 * snapshots by identity, so returning a new empty array each call reads as a
 * change on every render and loops until React gives up.
 */
const EMPTY: readonly string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Subscribe to changes, for `useSyncExternalStore`.
 *
 * The list is held in memory between reads so a screen that opens on it does
 * not render empty for a frame and then fill in — the same reason the store it
 * was modelled on is synchronous.
 */
export function subscribeRecentSearches(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The list as it stands, or an empty one until the first load resolves. */
export function getRecentSearches(): readonly string[] {
  return cache ?? EMPTY;
}

/** Reads storage once per launch; later calls serve the cache. */
export async function loadRecentSearches(): Promise<string[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch (error) {
    // A recents list is a convenience; a corrupt one is not worth a failure the
    // user has to see, so it starts empty and refills as they search.
    void addLog(
      `[recentSearches] Could not read stored searches: ${String(error)}`,
      'WARNING'
    );
    cache = [];
  }
  notify();
  return cache;
}

async function persist(next: string[]) {
  cache = next;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    void addLog(
      `[recentSearches] Could not save searches: ${String(error)}`,
      'WARNING'
    );
  }
}

/**
 * Records a query, newest first.
 *
 * A repeat moves to the top rather than appearing twice: searching the same
 * thing again is what makes it recent, not a second entry.
 */
export async function recordRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return;
  const current = await loadRecentSearches();
  const deduped = current.filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase()
  );
  await persist([trimmed, ...deduped].slice(0, RECENT_SEARCH_LIMIT));
}

/** Drops one query — the per-row remove. */
export async function removeRecentSearch(query: string): Promise<void> {
  const current = await loadRecentSearches();
  await persist(current.filter((item) => item !== query));
}

/** Empties the list. */
export async function clearRecentSearches(): Promise<void> {
  await persist([]);
}

/** Tests get a clean list; the module otherwise holds one per launch. */
export function resetRecentSearchesForTests(): void {
  cache = null;
  notify();
}
