import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSyncHealthData } from './useSyncHealthData';
import {
  loadDailySyncRange,
  getActiveServerConfig,
  loadSyncOnOpenEnabled,
} from '../services/storage';
import type { TimeRange } from '../services/storage';
import {
  initHealthConnect,
  loadHealthPreference,
} from '../services/healthConnectService';
import { HEALTH_METRICS } from '../HealthMetrics';
import { flushPendingHealthSyncCacheRefresh } from '../services/backgroundSyncService';
import {
  tryClaimAutoSync,
  isForegroundAutoSyncWindowOpen,
  setForegroundAutoSyncWindowOpen,
  shouldRunForegroundResumeAutoSync,
  recordAutoSyncTime,
} from '../services/autoSyncCoordinator';
import { addLog } from '../services/LogService';
import { isLocalDataMode } from '../services/dataMode';

/**
 * Bookkeeping key for an auto-sync run, used for the per-target cooldown.
 * Local-first builds have no server config, so they use a stable synthetic id
 * rather than skipping the sync outright — the health data still has somewhere
 * to go, namely the on-device database.
 */
const resolveSyncConfigId = async (): Promise<string | null> => {
  if (isLocalDataMode()) return 'local';
  const config = await getActiveServerConfig();
  return config?.id ?? null;
};

const AUTO_SYNC_WATCHDOG_MS = 90_000;

interface AutoSyncOnOpenArgs {
  initialRoute: 'Tabs' | 'Onboarding' | null;
  syncMutation: ReturnType<typeof useSyncHealthData>;
}

/**
 * Owns the sync-on-open orchestration: cold-start sync once the user lands on
 * Tabs, foreground-return sync after the app has been backgrounded long
 * enough, and the foreground auto-sync window that tells iOS HealthKit
 * observers to yield while one of those deliberate syncs is running.
 */
export function useAutoSyncOnOpen({
  initialRoute,
  syncMutation,
}: AutoSyncOnOpenArgs) {
  const foregroundAutoSyncWindowRef = useRef(false);
  const backgroundEnteredAtRef = useRef<number | null>(null);
  const wasInBackgroundRef = useRef(false);

  const setForegroundAutoSyncWindowState = useCallback((isOpen: boolean) => {
    foregroundAutoSyncWindowRef.current = isOpen;
    setForegroundAutoSyncWindowOpen(isOpen);
  }, []);

  // Yield only during a deliberate foreground auto-sync window (cold-start or
  // foreground-return). Outside that narrow window, let background delivery fire normally.
  const shouldYieldObserverSync = useCallback(
    () =>
      AppState.currentState === 'active' &&
      foregroundAutoSyncWindowRef.current &&
      isForegroundAutoSyncWindowOpen(),
    []
  );

  const triggerAutoSync = useCallback(
    async (configId: string, release: () => void) => {
      let committed = false;
      try {
        if (syncMutation.isPending) {
          addLog(
            '[App] Auto sync on open skipped: a health sync is already running.',
            'DEBUG'
          );
          return;
        }

        const initialized = await initHealthConnect();
        if (!initialized) {
          addLog(
            '[App] Auto sync on open skipped: health provider unavailable or permissions not granted.',
            'WARNING'
          );
          return;
        }

        // The automatic syncs use their own range, so widening the manual
        // Sync Range for a one-off catch-up does not make every app open read
        // that far back.
        const timeRange: TimeRange = await loadDailySyncRange();
        const healthMetricStates: Record<string, boolean> = {};
        await Promise.all(
          HEALTH_METRICS.map(async (metric) => {
            const enabled = await loadHealthPreference<boolean>(
              metric.preferenceKey
            );
            healthMetricStates[metric.stateKey] = enabled === true;
          })
        );

        committed = true;
        syncMutation.mutate(
          {
            timeRange,
            healthMetricStates,
          },
          {
            onSuccess: () => {
              void recordAutoSyncTime(configId);
            },
            onSettled: () => {
              release();
            },
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[App] Auto sync on open failed: ${message}`, 'ERROR');
      } finally {
        if (!committed) release();
      }
    },
    [syncMutation]
  );

  const triggerAutoSyncRef = useRef(triggerAutoSync);
  useEffect(() => {
    triggerAutoSyncRef.current = triggerAutoSync;
  }, [triggerAutoSync]);

  useEffect(() => {
    // Logged, because this gate produced no evidence at all: the effect reruns
    // as initialRoute resolves from null, so a startup that never reaches
    // 'Tabs' looked identical to one where sync-on-open simply did nothing.
    if (initialRoute !== 'Tabs') {
      addLog(
        `[App] Cold-start sync on open not started: initialRoute=${initialRoute ?? 'null'}.`,
        'DEBUG'
      );
      return;
    }

    const triggerColdStartSync = async () => {
      // Open the yield window and take the claim BEFORE the preference reads.
      // Those reads are async, and on iOS a HealthKit observer firing in that
      // gap would take the claim first, leaving this path to return silently
      // while the observer ran a toast-less background sync instead.
      setForegroundAutoSyncWindowState(true);
      const coordRelease = tryClaimAutoSync();
      if (!coordRelease) {
        setForegroundAutoSyncWindowState(false);
        addLog(
          '[App] Cold-start sync on open skipped: another sync already holds the auto-sync claim.',
          'DEBUG'
        );
        return;
      }

      const cleanup = () => {
        setForegroundAutoSyncWindowState(false);
        coordRelease();
      };
      const watchdog = setTimeout(cleanup, AUTO_SYNC_WATCHDOG_MS);
      const safeCleanup = () => {
        clearTimeout(watchdog);
        cleanup();
      };

      try {
        const syncOnOpen = await loadSyncOnOpenEnabled();
        if (!syncOnOpen) {
          addLog(
            '[App] Cold-start sync on open skipped: "Sync on Open" is turned off in Sync settings.',
            'INFO'
          );
          safeCleanup();
          return;
        }
        const configId = await resolveSyncConfigId();
        if (!configId) {
          addLog(
            '[App] Cold-start sync on open skipped: no active server config.',
            'WARNING'
          );
          safeCleanup();
          return;
        }

        await triggerAutoSyncRef.current(configId, safeCleanup);
      } catch (error) {
        safeCleanup();
        throw error;
      }
    };

    triggerColdStartSync().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`[App] Cold-start sync on open failed: ${message}`, 'ERROR');
    });
  }, [initialRoute, setForegroundAutoSyncWindowState]);

  useEffect(() => {
    const FOREGROUND_SYNC_MIN_AWAY_MS = 5 * 60 * 1000;

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        try {
          if (nextAppState === 'background') {
            backgroundEnteredAtRef.current = Date.now();
            wasInBackgroundRef.current = true;
            return;
          }

          if (nextAppState !== 'active') return;

          // Fire-and-forget: this now awaits the Dashboard refetches, and a
          // request issued the instant the app resumes can retry for tens of
          // seconds over a radio that has not reconnected yet. Awaiting it
          // here delayed — or, past the watchdog, effectively skipped — the
          // foreground-return sync decision below.
          void flushPendingHealthSyncCacheRefresh().catch((error) => {
            const message =
              error instanceof Error ? error.message : String(error);
            addLog(
              `[App] Failed to flush pending health sync refresh: ${message}`,
              'ERROR'
            );
          });
          if (!wasInBackgroundRef.current) return;

          const enteredAt = backgroundEnteredAtRef.current;
          wasInBackgroundRef.current = false;
          backgroundEnteredAtRef.current = null;

          const timeAway =
            enteredAt !== null ? Date.now() - enteredAt : Infinity;
          if (timeAway < FOREGROUND_SYNC_MIN_AWAY_MS) return;

          // Claim before the preference reads, for the same reason the
          // cold-start path does.
          setForegroundAutoSyncWindowState(true);
          const coordRelease = tryClaimAutoSync();
          if (!coordRelease) {
            setForegroundAutoSyncWindowState(false);
            addLog(
              '[App] Foreground-return sync skipped: another sync already holds the auto-sync claim.',
              'DEBUG'
            );
            return;
          }

          const cleanup = () => {
            setForegroundAutoSyncWindowState(false);
            coordRelease();
          };
          const watchdog = setTimeout(cleanup, AUTO_SYNC_WATCHDOG_MS);
          const safeCleanup = () => {
            clearTimeout(watchdog);
            cleanup();
          };

          try {
            const configId = await resolveSyncConfigId();
            if (!configId) {
              addLog(
                '[App] Foreground-return sync skipped: no active server config.',
                'WARNING'
              );
              safeCleanup();
              return;
            }

            const syncOnOpen = await loadSyncOnOpenEnabled();
            if (!syncOnOpen) {
              addLog(
                '[App] Foreground-return sync skipped: "Sync on Open" is turned off in Sync settings.',
                'INFO'
              );
              safeCleanup();
              return;
            }
            if (!(await shouldRunForegroundResumeAutoSync(configId))) {
              addLog(
                '[App] Foreground-return sync skipped: within the auto-sync cooldown.',
                'DEBUG'
              );
              safeCleanup();
              return;
            }

            await triggerAutoSyncRef.current(configId, safeCleanup);
          } catch (error) {
            safeCleanup();
            throw error;
          }
        } catch (error) {
          setForegroundAutoSyncWindowState(false);
          const message =
            error instanceof Error ? error.message : String(error);
          addLog(
            `[App] Foreground-return sync on open failed: ${message}`,
            'ERROR'
          );
        }
      }
    );

    return () => subscription.remove();
  }, [setForegroundAutoSyncWindowState]);

  return { shouldYieldObserverSync };
}
