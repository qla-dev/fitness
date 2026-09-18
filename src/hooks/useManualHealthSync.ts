import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  initHealthConnect,
  loadHealthPreference,
} from '../services/healthConnectService';
import { loadDailySyncRange } from '../services/storage';
import type { TimeRange } from '../services/storage';
import { HEALTH_METRICS } from '../HealthMetrics';
import { isSyncClaimed } from '../services/autoSyncCoordinator';
import { useSyncHealthData } from './useSyncHealthData';

interface ManualSyncParams {
  timeRange: TimeRange;
  healthMetricStates: Record<string, boolean>;
}

/**
 * Resolve the parameters a user-initiated sync runs with: the stored window and
 * every metric's opt-in state.
 *
 * Returns null when the platform health store cannot be reached, having already
 * told the user why — callers should simply stop rather than surface a second
 * message.
 */
export async function prepareManualHealthSync(
  t: TFunction
): Promise<ManualSyncParams | null> {
  const initialized = await initHealthConnect();
  if (!initialized) {
    Alert.alert(
      t('addSheetActions.healthUnavailable.title', {
        defaultValue: 'Health Data Unavailable',
      }),
      t('addSheetActions.healthUnavailable.message', {
        defaultValue:
          'Could not initialize health data access. Check your permissions in Settings.',
      })
    );
    return null;
  }

  // The startup window, not the history one: these callers are the Dashboard
  // card and the AddSheet row, which are everyday taps rather than a deliberate
  // catch-up, and a year-wide read behind either of them is felt immediately.
  const loadedTimeRange = await loadDailySyncRange();
  const healthMetricStates: Record<string, boolean> = {};
  for (const metric of HEALTH_METRICS) {
    const enabled = await loadHealthPreference<boolean>(metric.preferenceKey);
    healthMetricStates[metric.stateKey] = enabled === true;
  }

  if (!Object.values(healthMetricStates).some(Boolean)) {
    Alert.alert(
      t('syncHealth.noMetricsTitle', {
        defaultValue: 'Choose health data to sync',
      }),
      t('syncHealth.noMetricsMessage', {
        defaultValue:
          'Tap the profile icon in the top-right, open Health Data Sync, and enable the metrics you want to import. Then try again.',
      })
    );
    return null;
  }

  return { timeRange: loadedTimeRange, healthMetricStates };
}

/**
 * A self-contained manual health sync for surfaces that are not the AddSheet
 * (which already threads a shared mutation through useAddSheetActions).
 *
 * `isSyncClaimed()` is checked as well as the mutation's own pending state:
 * background sync, sync-on-open and the AddSheet row all run through the same
 * coordinator, and starting a second pass while one of those holds the claim
 * would be dropped anyway.
 */
export function useManualHealthSync() {
  const { t } = useTranslation();
  const syncMutation = useSyncHealthData();

  const sync = useCallback(async () => {
    if (syncMutation.isPending || isSyncClaimed()) return;
    const params = await prepareManualHealthSync(t);
    if (!params) return;
    syncMutation.mutate(params);
  }, [syncMutation, t]);

  return { sync, isPending: syncMutation.isPending };
}
