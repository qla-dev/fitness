/**
 * How far the sync currently on screen has got, published for the UI to read.
 *
 * A foreground sync is a single window, so it has no window count to report the
 * way the history import does. The honest unit is how many of the enabled
 * metrics have come back: the run reads them in batches of three, and each one
 * settling is real, visible movement.
 *
 * Module-level rather than threaded through the mutation because the run
 * crosses four layers — mutation, platform orchestrator, engine, provider — and
 * none of the ones in between has any use for a progress callback.
 */
export interface SyncProgress {
  completed: number;
  total: number;
}

let current: SyncProgress | null = null;
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

/** Starts a run at 0/total. A total of 0 publishes nothing to show. */
export const beginSyncProgress = (total: number): void => {
  current = total > 0 ? { completed: 0, total } : null;
  emit();
};

export const advanceSyncProgress = (): void => {
  if (!current) return;
  current = {
    ...current,
    completed: Math.min(current.completed + 1, current.total),
  };
  emit();
};

/** Called by the run's owner when it settles, however it settles. */
export const endSyncProgress = (): void => {
  if (current === null) return;
  current = null;
  emit();
};

// Identity is stable between emits, which is what useSyncExternalStore needs.
export const getSyncProgress = (): SyncProgress | null => current;

export const subscribeSyncProgress = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
