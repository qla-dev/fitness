import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getHealthMetricLabel, type HealthMetric } from '../HealthMetrics';
import { NO_DATA_DISPLAY } from '../services/healthDataDisplay';
import MenuItem, { MenuItemDivider } from './MenuItem';
import MenuItemIcon from './MenuItemIcon';
import Switch from './ui/Switch';

interface HealthMetricListProps {
  metrics: HealthMetric[];
  healthMetricStates: Record<string, boolean>;
  onToggle: (metric: HealthMetric, newValue: boolean) => void;
  /** Latest value per metric id, shown before the switch. */
  healthData?: Record<string, string>;
  isLoadingHealthData?: boolean;
  /** Wrap the rows in their own surface card (off when already inside one). */
  card?: boolean;
}

/**
 * Health metrics as menu item rows: icon tile, name, latest value and the sync
 * switch, with the standard dividers between rows.
 */
export default function HealthMetricList({
  metrics,
  healthMetricStates,
  onToggle,
  healthData,
  isLoadingHealthData,
  card = false,
}: HealthMetricListProps) {
  const { t } = useTranslation();

  return (
    <View className={card ? 'bg-surface rounded-2xl overflow-hidden' : ''}>
      {metrics.map((metric, index) => {
        const metricLabel = getHealthMetricLabel(t, metric);
        const value = healthData?.[metric.id];
        const noData = value === NO_DATA_DISPLAY;
        return (
          <React.Fragment key={metric.id}>
            {index > 0 && <MenuItemDivider />}
            <MenuItem
              leading={
                <MenuItemIcon>
                  <Image source={metric.icon} className="w-6 h-6" />
                </MenuItemIcon>
              }
              trailing={
                <View className="flex-row items-center gap-2">
                  {isLoadingHealthData && !value ? (
                    <ActivityIndicator
                      size="small"
                      accessibilityLabel={t('healthSync.loading', {
                        defaultValue: 'Loading health data',
                      })}
                      accessibilityState={{ busy: true }}
                    />
                  ) : value ? (
                    <Text
                      className={`text-sm text-text-muted ${noData ? 'italic' : ''}`}
                      numberOfLines={1}
                    >
                      {noData
                        ? t('healthSync.noData', { defaultValue: 'No data' })
                        : value}
                    </Text>
                  ) : null}
                  <Switch
                    accessibilityLabel={t('healthSync.syncMetricLabel', {
                      defaultValue: 'Sync {{metric}}',
                      metric: metricLabel,
                    })}
                    accessibilityHint={t('healthSync.syncMetricHint', {
                      defaultValue:
                        'Toggles synchronization for this health metric.',
                    })}
                    value={healthMetricStates[metric.stateKey] === true}
                    onValueChange={(newValue) => onToggle(metric, newValue)}
                  />
                </View>
              }
            >
              <Text
                className="text-base font-semibold text-text-primary"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {metricLabel}
              </Text>
            </MenuItem>
          </React.Fragment>
        );
      })}
    </View>
  );
}
