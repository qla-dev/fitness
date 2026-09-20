import type { Dispatch, SetStateAction } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  HEALTH_METRICS,
  getHealthMetricLabel,
  type HealthMetric,
} from '../HealthMetrics';
import {
  cleanupAllSubscriptions,
  disableAllBackgroundDelivery,
  disableBackgroundDeliveryForMetric,
  enableBackgroundDeliveryForMetric,
  refreshSubscriptions,
  requestHealthPermissions,
  saveHealthPreference,
  setupBackgroundDeliveryForEnabledMetrics,
} from '../services/healthConnectService';
import { WRITEBACK_METRICS } from '../WritebackMetrics';
import {
  allWritebackPermissions,
  enabledWritebackPermissions,
} from '../services/shared/healthPermissionSets';
import { addLog } from '../services/LogService';

type MetricStates = Record<string, boolean>;

interface HealthMetricTogglesArgs {
  healthMetricStates: MetricStates;
  setHealthMetricStates: Dispatch<SetStateAction<MetricStates>>;
  /** Writeback toggles; their write permissions ride along so a read request
   *  cannot switch them off, and "Enable All" covers them too. */
  writebackStates: Record<string, boolean>;
  setWritebackStates: Dispatch<SetStateAction<Record<string, boolean>>>;
  /** Called after any change, e.g. to reload the displayed values. */
  onChanged?: () => void;
}

/**
 * Per-metric and "enable all" health sync switches: saves the preference,
 * requests the platform permission when turning on (reverting with an alert
 * when it is refused), and keeps background delivery in step.
 *
 * "Enable All" covers the writeback switches too, so one row turns the whole
 * health integration on in both directions; per-metric writeback toggling lives
 * in useWritebackToggles beside it.
 */
export function useHealthMetricToggles({
  healthMetricStates,
  setHealthMetricStates,
  writebackStates,
  setWritebackStates,
  onChanged,
}: HealthMetricTogglesArgs) {
  const { t } = useTranslation();
  const healthSettingsName =
    Platform.OS === 'android'
      ? t('syncScreen.healthConnectSettings', {
          defaultValue: 'Health Connect settings',
        })
      : t('syncScreen.healthAppSettings', {
          defaultValue: 'Health app settings',
        });

  // "Enable All" covers both directions, so it is only "all" when the writeback
  // switches are on too — otherwise the row would read as fully on while the
  // diary was still not reaching the health store.
  const isAllMetricsEnabled =
    HEALTH_METRICS.every((metric) => healthMetricStates[metric.stateKey]) &&
    WRITEBACK_METRICS.every((metric) => writebackStates[metric.id]);

  const toggleMetric = async (
    metric: HealthMetric,
    newValue: boolean
  ): Promise<void> => {
    setHealthMetricStates((prevStates) => ({
      ...prevStates,
      [metric.stateKey]: newValue,
    }));
    await saveHealthPreference(metric.preferenceKey, newValue);
    if (!newValue) {
      disableBackgroundDeliveryForMetric(metric.recordType).catch(() => {});
    }
    if (newValue) {
      try {
        // Carry the write direction too when writeback for this record type is already
        // on, so the sheet cannot commit it back to off. See healthPermissionSets.ts.
        const granted = await requestHealthPermissions([
          ...metric.permissions,
          ...enabledWritebackPermissions(
            writebackStates,
            new Set([metric.recordType])
          ),
        ]);
        if (!granted) {
          Alert.alert(
            t('syncScreen.permissionDenied.title', {
              defaultValue: 'Permission Denied',
            }),
            t('syncScreen.permissionDenied.read', {
              defaultValue:
                'Please grant {{metric}} permission in {{settings}}.',
              metric: getHealthMetricLabel(t, metric),
              settings: healthSettingsName,
            })
          );
          setHealthMetricStates((prevStates) => ({
            ...prevStates,
            [metric.stateKey]: false,
          }));
          await saveHealthPreference(metric.preferenceKey, false);
          addLog(
            `Permission Denied: ${metric.defaultLabel} permission not granted.`,
            'WARNING'
          );
        } else {
          addLog(`${metric.id} sync enabled and permissions granted.`, 'INFO');
          enableBackgroundDeliveryForMetric(metric.recordType).catch(() => {});
        }
      } catch (permissionError) {
        const errorMessage =
          permissionError instanceof Error
            ? permissionError.message
            : String(permissionError);
        Alert.alert(
          t('syncScreen.permissionError.title', {
            defaultValue: 'Permission Error',
          }),
          t('syncScreen.permissionError.metricRead', {
            defaultValue: 'Failed to request {{metric}} permissions: {{error}}',
            metric: getHealthMetricLabel(t, metric),
            error: errorMessage,
          })
        );
        setHealthMetricStates((prevStates) => ({
          ...prevStates,
          [metric.stateKey]: false,
        }));
        await saveHealthPreference(metric.preferenceKey, false);
        addLog(
          `Permission Request Error for ${metric.id}: ${errorMessage}`,
          'ERROR'
        );
      }
    }
    refreshSubscriptions();
    onChanged?.();
  };

  const toggleAllMetrics = async (): Promise<void> => {
    const newValue = !isAllMetricsEnabled;

    const newHealthMetricStates: MetricStates = {};
    HEALTH_METRICS.forEach((metric) => {
      newHealthMetricStates[metric.stateKey] = newValue;
    });
    const newWritebackStates: Record<string, boolean> = {};
    WRITEBACK_METRICS.forEach((metric) => {
      newWritebackStates[metric.id] = newValue;
    });

    if (newValue) {
      // Every writeback write permission, not just the enabled ones: this is
      // turning them all on, so all of them need asking for in the one sheet.
      const allPermissions = [
        ...HEALTH_METRICS.flatMap((metric) => metric.permissions),
        ...allWritebackPermissions(),
      ];
      addLog(
        `[HealthMetricToggles] Requesting permissions for all ${HEALTH_METRICS.length} metrics`,
        'DEBUG'
      );

      try {
        const granted = await requestHealthPermissions(allPermissions);

        if (!granted) {
          Alert.alert(
            t('syncScreen.permissionRequired.allTitle', {
              defaultValue: 'Permissions Required',
            }),
            t('syncScreen.permissionRequired.allMessage', {
              defaultValue:
                'Some permissions were not granted. Please enable all required health permissions in the {{settings}} to sync all data.',
              settings: healthSettingsName,
            })
          );
          HEALTH_METRICS.forEach((metric) => {
            newHealthMetricStates[metric.stateKey] = false;
          });
          WRITEBACK_METRICS.forEach((metric) => {
            newWritebackStates[metric.id] = false;
          });
          addLog(
            '[HealthMetricToggles] Not all permissions were granted. Reverting "Enable All".',
            'WARNING'
          );
        } else {
          addLog(
            `[HealthMetricToggles] All ${HEALTH_METRICS.length} metric permissions granted`,
            'INFO'
          );
        }
      } catch (permissionError) {
        const errorMessage =
          permissionError instanceof Error
            ? permissionError.message
            : String(permissionError);
        Alert.alert(
          t('syncScreen.permissionError.title', {
            defaultValue: 'Permission Error',
          }),
          t('syncScreen.permissionError.allMetrics', {
            defaultValue:
              'An error occurred while requesting health permissions: {{error}}',
            error: errorMessage,
          })
        );
        HEALTH_METRICS.forEach((metric) => {
          newHealthMetricStates[metric.stateKey] = false;
        });
        WRITEBACK_METRICS.forEach((metric) => {
          newWritebackStates[metric.id] = false;
        });
        addLog(
          `[HealthMetricToggles] Error requesting all permissions: ${errorMessage}`,
          'ERROR'
        );
      }
    } else {
      addLog(
        `[HealthMetricToggles] Disabling all ${HEALTH_METRICS.length} metrics`,
        'DEBUG'
      );
      disableAllBackgroundDelivery().catch(() => {});
      cleanupAllSubscriptions();
    }

    setHealthMetricStates(newHealthMetricStates);
    setWritebackStates(newWritebackStates);

    const saveErrors: string[] = [];
    for (const metric of HEALTH_METRICS) {
      try {
        await saveHealthPreference(
          metric.preferenceKey,
          newHealthMetricStates[metric.stateKey]
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        saveErrors.push(`${metric.id}: ${errorMessage}`);
      }
    }
    for (const metric of WRITEBACK_METRICS) {
      try {
        await saveHealthPreference(
          metric.preferenceKey,
          newWritebackStates[metric.id]
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        saveErrors.push(`${metric.id}: ${errorMessage}`);
      }
    }

    if (saveErrors.length > 0) {
      addLog(
        `[HealthMetricToggles] Failed to save ${saveErrors.length}/${HEALTH_METRICS.length} metric preferences`,
        'WARNING',
        saveErrors
      );
    }

    if (newValue) {
      setupBackgroundDeliveryForEnabledMetrics().catch(() => {});
    }

    refreshSubscriptions();
    onChanged?.();
  };

  return { isAllMetricsEnabled, toggleMetric, toggleAllMetrics };
}
