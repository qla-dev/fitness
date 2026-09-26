import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { localTransaction, markLocalDatabaseDirty } from '../local/database';
import {
  onlineRequest,
  useOnlineAccount,
  loadOnlineAccount,
  OnlineError,
} from './account';
import {
  changesSince,
  mergeResponse,
  SYNC_COLLECTIONS,
  type SyncState,
  type SyncTables,
} from './syncModel';

const SETTINGS_KEY = '@qla/online-sync';
type SyncSettings = {
  enabled: boolean;
  intervalMinutes: number;
  lastSynced: string | null;
};
export const useOnlineSync = create<
  SyncSettings & { busy: boolean; error: string | null; conflict: boolean }
>(() => ({
  enabled: true,
  intervalMinutes: 15,
  lastSynced: null,
  busy: false,
  error: null,
  conflict: false,
}));
let settingsLoaded = false;
let running: Promise<void> | null = null;
export async function loadSyncSettings() {
  if (settingsLoaded) return;
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (raw) useOnlineSync.setState(JSON.parse(raw) as SyncSettings);
  settingsLoaded = true;
}
export async function saveSyncSettings(settings: Partial<SyncSettings>) {
  await loadSyncSettings();
  const next = { ...useOnlineSync.getState(), ...settings };
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      enabled: next.enabled,
      intervalMinutes: next.intervalMinutes,
      lastSynced: next.lastSynced,
    })
  );
  useOnlineSync.setState(settings);
}

async function performSync() {
  await Promise.all([loadOnlineAccount(), loadSyncSettings()]);
  const account = useOnlineAccount.getState().session?.user;
  if (!account) throw new OnlineError(401, 'Sign in to sync your data.');
  const initial = await localTransaction((db) => ({
    state: db.onlineSync as SyncState | undefined,
    revision: db.revision,
  }));
  if (initial.state && initial.state.accountId !== account.id)
    throw new Error(
      'This device contains another account’s data. Sign in with that account to sync.'
    );
  if (!initial.state) {
    const remote = await onlineRequest<{ tables: SyncTables }>('/sync');
    await localTransaction((db) => {
      // A fresh installation contains only generated defaults. Restore the account before uploading them.
      const hasRemote = Object.values(remote.tables).some((rows) =>
        rows.some((r) => !r.deleted)
      );
      if (hasRemote && db.revision === 0) {
        for (const name of SYNC_COLLECTIONS)
          db.tables[name] = (remote.tables[name] ?? []).flatMap((r) =>
            r.data && !r.deleted ? [r.data] : []
          );
      } else if (hasRemote) {
        // Preserve local records; merge only remote IDs absent from the device.
        for (const name of SYNC_COLLECTIONS) {
          const rows = db.tables[name] ?? [];
          const ids = new Set(rows.map((r) => String(r.id)));
          db.tables[name] = [
            ...rows,
            ...(remote.tables[name] ?? []).flatMap((r) =>
              r.data && !r.deleted && !ids.has(r.id) ? [r.data] : []
            ),
          ];
        }
      }
      db.onlineSync = {
        accountId: account.id,
        baseline: remote.tables,
      } satisfies SyncState;
      markLocalDatabaseDirty();
    });
  }
  // Upload bounded batches; pending requests are persisted with the local database for safe retries.
  for (let batch = 0; batch < 100; batch++) {
    const pending = await localTransaction((db) => {
      const state = db.onlineSync as SyncState;
      if (!state.pending) {
        state.pending = {
          request_id: randomUUID(),
          changes: changesSince(db.tables, state.baseline).slice(0, 500),
          sent: JSON.parse(JSON.stringify(db.tables)) as typeof db.tables,
        };
        markLocalDatabaseDirty();
      }
      return state.pending;
    });
    const remote = await onlineRequest<{ tables: SyncTables }>('/sync', {
      request_id: pending.request_id,
      changes: pending.changes,
    });
    await localTransaction((db) => {
      const state = db.onlineSync as SyncState;
      // Unsent rows from later batches also count as local edits and must survive this response.
      const sent = { ...pending.sent };
      const remaining = changesSince(pending.sent, state.baseline).filter(
        (c) =>
          !pending.changes.some(
            (p) => p.collection === c.collection && p.id === c.id
          )
      );
      for (const change of remaining)
        sent[change.collection] = (sent[change.collection] ?? []).filter(
          (r) => String(r.id) !== change.id
        );
      db.tables = mergeResponse(db.tables, sent, remote.tables);
      db.onlineSync = {
        accountId: account.id,
        baseline: remote.tables,
      } satisfies SyncState;
      markLocalDatabaseDirty();
    });
    if (pending.changes.length < 500) break;
  }
  await saveSyncSettings({ lastSynced: new Date().toISOString() });
}

export function syncOnline(): Promise<void> {
  if (running) return running;
  useOnlineSync.setState({ busy: true, error: null, conflict: false });
  running = performSync()
    .catch((error: unknown) => {
      useOnlineSync.setState({
        error: error instanceof Error ? error.message : String(error),
        conflict: error instanceof OnlineError && error.status === 409,
      });
      throw error;
    })
    .finally(() => {
      running = null;
      useOnlineSync.setState({ busy: false });
    });
  return running;
}

export async function resolveSyncConflict(choice: 'device' | 'online') {
  const remote = await onlineRequest<{ tables: SyncTables }>('/sync');
  await localTransaction((db) => {
    const state = db.onlineSync as SyncState;
    if (choice === 'online')
      for (const name of SYNC_COLLECTIONS)
        db.tables[name] = (remote.tables[name] ?? []).flatMap((r) =>
          r.data && !r.deleted ? [r.data] : []
        );
    db.onlineSync = {
      accountId: state.accountId,
      baseline: remote.tables,
    } satisfies SyncState;
    markLocalDatabaseDirty();
  });
  await syncOnline();
}
