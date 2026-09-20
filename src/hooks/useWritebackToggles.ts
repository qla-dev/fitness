import type { Dispatch, SetStateAction } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getHealthMetricLabel } from '../HealthMetrics';
import type { WritebackMetric } from '../WritebackMetrics';
import {
  requestHealthPermissions,
  saveHealthPreference,
} from '../services/healthConnectService';
import { enabledReadPermissionsForRecordType } from '../services/shared/healthPermissionSets';
import { addLog } from '../services/LogService';
import type { HealthMetricStates } from '../types/healthRecords';

interface WritebackTogglesArgs {
  /** Read states, so an enabled read direction rides along with the request. */
  healthMetricStates: HealthMetricStates;
  setWritebackStates: Dispatch<SetStateAction<Record<string, boolean>>>;
}

/**
 * The writeback opt-in switches: saves the preference, requests the platform
 * write permission when turning on, and reverts the switch with an alert when
 * it is refused.
 *
 * Lives beside `useHealthMetricToggles`, the read side's equivalent, so the two
 * directions behave the same way on the one screen that owns both. The read
 * direction of the same record type is carried into the request
 * whenever it is already on: the authorization sheet is authoritative for every
 * row it shows, so asking for write alone could commit read back to off.
 */
export function useWritebackToggles({
  healthMetricStates,
  setWritebackStates,
}: WritebackTogglesArgs) {
  const { t } = useTranslation();
  const healthSettingsName =
    Platform.OS === 'android'
      ? t('syncScreen.healthConnectSettings', {
          defaultValue: 'Health Connect settings',
        })
      : t('syncScreen.healthAppSettings', {
          defaultValue: 'Health app settings',
        });

  const toggleWriteback = async (
    metric: WritebackMetric,
    newValue: boolean
  ): Promise<void> => {
    setWritebackStates((prev) => ({ ...prev, [metric.id]: newValue }));
    await saveHealthPreference(metric.preferenceKey, newValue);
    if (!newValue) {
      return;
    }
    // Enabling: request the write permission; revert the toggle if denied.
    try {
      const granted = await requestHealthPermissions([
        metric.permission,
        ...enabledReadPermissionsForRecordType(
          healthMetricStates,
          metric.permission.recordType
        ),
      ]);
      if (!granted) {
        Alert.alert(
          t('syncScreen.permissionDenied.title', {
            defaultValue: 'Permission Denied',
          }),
          t('syncScreen.permissionDenied.write', {
            defaultValue:
              'Please grant {{metric}} write permission in {{settings}}.',
            metric: getHealthMetricLabel(t, metric),
            settings: healthSettingsName,
          })
        );
        setWritebackStates((prev) => ({ ...prev, [metric.id]: false }));
        await saveHealthPreference(metric.preferenceKey, false);
        addLog(`Writeback permission denied: ${metric.id}.`, 'WARNING');
      } else {
        addLog(
          `${metric.id} writeback enabled and write permission granted.`,
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
        t('syncScreen.permissionError.metricWrite', {
          defaultValue:
            'Failed to request {{metric}} write permission: {{error}}',
          metric: getHealthMetricLabel(t, metric),
          error: errorMessage,
        })
      );
      setWritebackStates((prev) => ({ ...prev, [metric.id]: false }));
      await saveHealthPreference(metric.preferenceKey, false);
      addLog(
        `Writeback permission request error for ${metric.id}: ${errorMessage}`,
        'ERROR'
      );
    }
  };

  return { toggleWriteback };
}
