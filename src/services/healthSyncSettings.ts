import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HEALTH_METRICS } from '../HealthMetrics';
import { WRITEBACK_METRICS } from '../WritebackMetrics';
import {
  loadHealthPreference,
  requestHealthPermissions,
  saveHealthPreference,
  setupBackgroundDeliveryForEnabledMetrics,
  refreshSubscriptions,
  startObservers,
  stopObservers,
} from './healthConnectService';
import {
  configureBackgroundSync,
  performBackgroundSync,
  stopBackgroundSync,
} from './backgroundSyncService';
import {
  isForegroundAutoSyncWindowOpen,
  tryClaimAutoSync,
} from './autoSyncCoordinator';
import { saveBackgroundSyncEnabled } from './storage';
import { addLog } from './LogService';
import { getErrorMessage } from '../utils/errors';
import { enabledWritebackPermissions } from './shared/healthPermissionSets';

/** Every read metric's sync preference, keyed like the Sync screen's state. */
export async function loadHealthMetricStates(): Promise<
  Record<string, boolean>
> {
  const states: Record<string, boolean> = {};
  for (const metric of HEALTH_METRICS) {
    states[metric.stateKey] =
      (await loadHealthPreference<boolean>(metric.preferenceKey)) === true;
  }
  return states;
}

export async function areAllHealthMetricsEnabled(): Promise<boolean> {
  const states = await loadHealthMetricStates();
  return HEALTH_METRICS.every((metric) => states[metric.stateKey]);
}

const HEALTH_STARTUP_CONFIRMED_KEY = '@HealthKit:startupHealthConfirmed';

/**
 * iOS never reveals whether read access was denied: the Health sheet reports
 * success either way. So the startup protocol treats Health as set up only
 * once the user acts on the AppleHealthCheck screen (syncs, imports, or turns
 * on automatic sync), alongside its other conditions.
 */
export async function isHealthStartupConfirmed(): Promise<boolean> {
  return (await AsyncStorage.getItem(HEALTH_STARTUP_CONFIRMED_KEY)) === 'true';
}

export async function confirmHealthStartup(): Promise<void> {
  await AsyncStorage.setItem(HEALTH_STARTUP_CONFIRMED_KEY, 'true');
}

/**
 * Asks for every read metric's permission without changing which metrics sync.
 * On iOS this presents the system Health access sheet for any data type the
 * user has not answered yet (and nothing otherwise). Writeback permissions
 * already on are carried so the sheet cannot switch them off.
 */
export async function requestAllHealthPermissions(): Promise<boolean> {
  const writebackStates: Record<string, boolean> = {};
  for (const metric of WRITEBACK_METRICS) {
    writebackStates[metric.id] =
      (await loadHealthPreference<boolean>(metric.preferenceKey)) === true;
  }
  try {
    return await requestHealthPermissions([
      ...HEALTH_METRICS.flatMap((metric) => metric.permissions),
      ...enabledWritebackPermissions(writebackStates),
    ]);
  } catch (error) {
    addLog(
      `[HealthSyncSettings] Health permission request failed: ${getErrorMessage(error)}`,
      'ERROR'
    );
    return false;
  }
}

/**
 * Turns on every read metric. Mirrors the Sync screen's "Enable All": metrics
 * are saved on only when the permission request reports success.
 */
export async function enableAllHealthMetrics(): Promise<boolean> {
  const granted = await requestAllHealthPermissions();
  if (!granted) {
    addLog(
      '[HealthSyncSettings] Not all health permissions were granted.',
      'WARNING'
    );
    return false;
  }

  for (const metric of HEALTH_METRICS) {
    await saveHealthPreference(metric.preferenceKey, true);
  }
  setupBackgroundDeliveryForEnabledMetrics().catch(() => {});
  refreshSubscriptions();
  addLog(
    `[HealthSyncSettings] All ${HEALTH_METRICS.length} metric permissions granted`,
    'INFO'
  );
  return true;
}

/**
 * Saves the background sync switch and starts or stops the background task,
 * plus the HealthKit observers on iOS. Android's background-access permission
 * prompt stays with the caller, which owns the alert copy.
 */
export async function applyBackgroundSyncEnabled(
  enabled: boolean
): Promise<void> {
  await saveBackgroundSyncEnabled(enabled);
  if (!enabled) {
    await stopBackgroundSync();
    if (Platform.OS === 'ios') stopObservers();
    return;
  }
  await configureBackgroundSync();
  if (Platform.OS !== 'ios') return;
  startObservers(() => {
    if (
      AppState.currentState === 'active' &&
      isForegroundAutoSyncWindowOpen()
    ) {
      return;
    }
    const release = tryClaimAutoSync();
    if (!release) return;
    performBackgroundSync('healthkit-observer')
      .catch((error) => {
        addLog(
          `[HealthSyncSettings] Observer-triggered sync failed: ${getErrorMessage(error)}`,
          'ERROR'
        );
      })
      .finally(() => {
        release();
      });
  });
}
