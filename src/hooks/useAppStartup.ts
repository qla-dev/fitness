import { useEffect } from 'react';
import i18n from '../localization/i18n';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initWorkoutNotificationActions } from '../stores/activeWorkoutStore';
import { loadBackgroundSyncEnabled } from '../services/storage';
import {
  startObservers,
  stopObservers,
} from '../services/healthConnectService';
import {
  configureBackgroundSync,
  performBackgroundSync,
  flushPendingHealthSyncCacheRefresh,
} from '../services/backgroundSyncService';
import { tryClaimAutoSync } from '../services/autoSyncCoordinator';
import { initializeTheme } from '../services/themeService';
import { addLog, initLogService } from '../services/LogService';
import { warmLocalDatabase } from '../services/local/database';
import { afterFirstScreen } from '../services/startupGate';
import { isLocalDataMode } from '../services/dataMode';
import {
  initNotifications,
  registerLocalizedNotificationPresentation,
} from '../services/notifications';
import { initMedicationNotificationActions } from '../services/medicationNotificationHandler';
import { initWorkoutLiveActivity } from '../services/workoutLiveActivity';
import { ensureTimezoneBootstrapped } from '../services/api/preferencesApi';
import { initializeRecorder } from '../services/recording/recorder';
import { subscribeWatchGoals } from '../services/watchGoals';
import { subscribeWatchMeasurements } from '../services/watchMeasurements';
import { subscribeWatchPrograms } from '../services/watchPrograms';
import { isWatchLinkAvailable } from '../../modules/watch-link';

interface AppStartupArgs {
  /**
   * When true, an observer-triggered HealthKit sync should not run because a
   * deliberate foreground auto-sync window is open. See useAutoSyncOnOpen.
   */
  shouldYieldObserverSync: () => boolean;
}

/**
 * One-time app startup: theme, notifications, notification actions, the
 * workout Live Activity, the log service, and the sync services (timezone
 * bootstrap, background sync, iOS HealthKit observers).
 */
export function useAppStartup({ shouldYieldObserverSync }: AppStartupArgs) {
  useEffect(() => {
    let cancelled = false;
    // Whether this build can reach a watch, not which platform it is: a Wear
    // OS watch asks for goals and measurements and reads programs over the
    // same bridge the Apple Watch does. Gated on iOS, an Android watch's
    // entries timed out unanswered and its program list stayed empty.
    const watchLink = isWatchLinkAvailable();
    const watchGoals = watchLink ? subscribeWatchGoals() : null;
    const watchPrograms = watchLink ? subscribeWatchPrograms() : null;
    const watchMeasurements = watchLink ? subscribeWatchMeasurements() : null;
    const onLanguageChanged = () => {
      void registerLocalizedNotificationPresentation().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to refresh localized notification presentation: ${message}`,
          'ERROR'
        );
      });
    };
    i18n.on('languageChanged', onLanguageChanged);

    // Initialize theme from storage on app start
    initializeTheme();

    // Reset the auto-open flag on every app start
    const initializeApp = async () => {
      // Remove the flag so the dashboard will auto-open on first SyncScreen visit
      await AsyncStorage.removeItem('@HealthConnect:hasAutoOpenedDashboard');
      await initNotifications();
    };

    initializeApp().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      addLog(
        `[App] Failed to initialize app startup state: ${message}`,
        'ERROR'
      );
    });

    initWorkoutNotificationActions();
    void initializeRecorder().catch((error) => {
      addLog('[App] Could not restore run/ride recording', 'ERROR', [
        String(error),
      ]);
    });
    initMedicationNotificationActions();

    // iOS-only (no-op on Android): keeps the workout Live Activity in sync
    // with the active-workout store.
    initWorkoutLiveActivity().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      addLog(
        `[App] Failed to initialize workout Live Activity: ${message}`,
        'ERROR'
      );
    });

    // Initialize log service (warms cache, prunes old logs, registers AppState listener)
    // Pruning old logs is housekeeping; it waits for the first screen.
    afterFirstScreen()
      .then(initLogService)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[App] Failed to initialize log service: ${message}`, 'ERROR');
      });

    // Load the on-device database in the background. On the first launch after
    // the SQLite update this is also when an AsyncStorage copy moves over; it
    // is deleted only after SQLite reads back identical.
    if (isLocalDataMode()) void warmLocalDatabase();

    const initializeSyncServices = async () => {
      // Deliberately NOT gated on isLocalDataMode(): health sync is what fills
      // a local-first build. Apple Health / Health Connect is the data source
      // and the on-device database is the destination, so background sync,
      // timezone bootstrap and the HealthKit observers all still apply.
      // Bootstrap timezone before any sync path is configured so the store
      // has a stable timezone for the very first sync.
      const timezone = await ensureTimezoneBootstrapped();
      if (!timezone) {
        addLog(
          '[App] Timezone bootstrap did not resolve a timezone before sync setup.',
          'WARNING'
        );
      }

      if (cancelled) return;

      try {
        await configureBackgroundSync();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to configure background sync: ${message}`,
          'ERROR'
        );
      }

      if (cancelled || Platform.OS !== 'ios') return;

      try {
        const enabled = await loadBackgroundSyncEnabled();
        if (!enabled || cancelled) return;

        startObservers(() => {
          if (shouldYieldObserverSync()) return;

          const release = tryClaimAutoSync();
          if (!release) return;

          performBackgroundSync('healthkit-observer')
            .catch((error) => {
              const message =
                error instanceof Error ? error.message : String(error);
              addLog(
                `[App] Observer-triggered sync failed: ${message}`,
                'ERROR'
              );
            })
            .finally(() => {
              release();
            });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to configure HealthKit observers: ${message}`,
          'ERROR'
        );
      }
    };

    // Sync setup, observers and the pending refresh below all start syncs or
    // refetches; none of them is needed to draw the first screen.
    afterFirstScreen()
      .then(initializeSyncServices)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[App] Failed to initialize sync services: ${message}`, 'ERROR');
      });

    afterFirstScreen()
      .then(flushPendingHealthSyncCacheRefresh)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        addLog(
          `[App] Failed to flush pending health sync refresh: ${message}`,
          'ERROR'
        );
      });

    return () => {
      cancelled = true;
      watchGoals?.remove();
      watchPrograms?.remove();
      watchMeasurements?.remove();
      i18n.off('languageChanged', onLanguageChanged);
      if (Platform.OS === 'ios') {
        stopObservers();
      }
    };
  }, [shouldYieldObserverSync]);
}
