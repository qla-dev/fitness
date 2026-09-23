import React from 'react';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import MenuItem, { MenuItemDivider } from './MenuItem';
import { GOAL_APPS, type GoalApp } from '../constants/goalApps';
import type { ActivityGoalKey } from '../constants/activityGoals';
import type { HealthTrendKey } from '../constants/healthTrends';
import { addLog } from '../services/LogService';

const ICON_SIZE = 39;

const storeUrl = (app: GoalApp) =>
  Platform.OS === 'ios' ? app.appStoreUrl : app.playStoreUrl;

/**
 * "Apps for: <goal>", the Health app's list of apps that work on the same
 * thing. Each row opens that app's listing in the store for this platform.
 * Renders nothing for a goal with no apps, so an empty heading never shows.
 */
export default function GoalApps({
  metric,
  title,
}: {
  metric: ActivityGoalKey | HealthTrendKey;
  title: string;
}) {
  const { t } = useTranslation();
  const muted = useCSSVariable('--color-text-muted') as string;
  const apps = GOAL_APPS[metric];
  if (apps.length === 0) return null;

  const open = (app: GoalApp) => {
    Linking.openURL(storeUrl(app)).catch((error: unknown) => {
      addLog(`[GoalApps] Could not open the store for ${app.id}`, 'WARNING', [
        error instanceof Error ? error.message : String(error),
      ]);
    });
  };

  return (
    <View className="px-4 pt-6" testID={`goal-apps-${metric}`}>
      <Text
        accessibilityRole="header"
        className="text-xl font-bold text-text-primary mb-4"
      >
        {t('goalApps.heading', {
          defaultValue: 'Apps for: {{goal}}',
          goal: title,
        })}
      </Text>
      <View className="bg-surface rounded-xl overflow-hidden mb-4">
        {apps.map((app, index) => (
          <React.Fragment key={app.id}>
            {index > 0 && <MenuItemDivider />}
            <Pressable
              accessibilityRole="link"
              accessibilityHint={t('goalApps.openStore', {
                defaultValue: 'Opens the app in the store',
              })}
              onPress={() => open(app)}
              testID={`goal-app-${app.id}`}
            >
              <MenuItem
                leading={
                  <Image
                    source={app.icon}
                    accessible={false}
                    style={{
                      width: ICON_SIZE,
                      height: ICON_SIZE,
                      borderRadius: 9,
                    }}
                  />
                }
                trailing={<Icon name="info-circle" size={22} color={muted} />}
              >
                <Text
                  className="text-base font-semibold text-text-primary"
                  numberOfLines={2}
                >
                  {app.name}
                </Text>
                <Text className="text-sm text-text-secondary" numberOfLines={1}>
                  {app.developer}
                </Text>
              </MenuItem>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
