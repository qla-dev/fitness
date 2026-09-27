import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  loadOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';
import {
  loadSyncSettings,
  syncOnline,
  useOnlineSync as useSyncState,
} from '../services/online/sync';
import { configureOnlineBackgroundSync } from '../services/online/background';
import { queryClient } from './queryClient';
import { addLog } from '../services/LogService';

export function useOnlineSync() {
  const accountId = useOnlineAccount((s) => s.session?.user.id);
  const enabled = useSyncState((s) => s.enabled);
  const interval = useSyncState((s) => s.intervalMinutes);
  useEffect(() => {
    void Promise.all([loadOnlineAccount(), loadSyncSettings()]).catch(
      (error: unknown) =>
        addLog('[OnlineSync] Could not load settings', 'WARNING', [
          String(error),
        ])
    );
  }, []);
  useEffect(() => {
    void configureOnlineBackgroundSync(enabled && !!accountId, interval).catch(
      (error: unknown) =>
        addLog('[OnlineSync] Background scheduling unavailable', 'WARNING', [
          String(error),
        ])
    );
    if (!enabled || !accountId) return;
    const run = () => {
      const last = useSyncState.getState().lastSynced;
      if (last && Date.now() - Date.parse(last) < interval * 60000) return;
      void syncOnline().catch(() => undefined);
    };
    run();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') run();
    }, interval * 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // A background sync may have finished within the interval. Refresh
        // cached screens regardless of whether another upload is due.
        void queryClient.invalidateQueries().catch(() => undefined);
        run();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, interval, accountId]);
}
