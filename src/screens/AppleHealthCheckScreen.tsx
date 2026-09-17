import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Button from '../components/ui/Button';
import Switch from '../components/ui/Switch';
import Icon from '../components/Icon';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import BottomSheetPicker from '../components/BottomSheetPicker';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useSyncHealthData } from '../hooks';
import { useSyncTimeRangeOptions } from '../hooks/useSyncTimeRangeOptions';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { initHealthConnect } from '../services/healthConnectService';
import {
  applyBackgroundSyncEnabled,
  areAllHealthMetricsEnabled,
  confirmHealthStartup,
  loadHealthMetricStates,
} from '../services/healthSyncSettings';
import { isSyncClaimed } from '../services/autoSyncCoordinator';
import { fireSelectionHaptic } from '../services/haptics';
import {
  loadBackgroundSyncEnabled,
  loadSyncOnOpenEnabled,
  loadTimeRange,
  saveSyncOnOpenEnabled,
  saveTimeRange,
  type TimeRange,
} from '../services/storage';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * Last step of the iOS startup protocol, straight after the Apple Health access
 * sheet: the sync settings that matter on day one (range, background sync,
 * sync on open) and the two ways to get data in now. Laid out like the setup
 * wizard so the startup steps read as one flow.
 *
 * Only acting here (syncing, importing, or switching on automatic sync) marks
 * Health as set up; closing with Done alone brings both Health steps back on
 * the next start.
 */
export default function AppleHealthCheckScreen({
  navigation,
}: RootStackScreenProps<'AppleHealthCheck'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [accentColor, textSecondary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-secondary',
  ]) as [string, string];
  const timeRangeOptions = useSyncTimeRangeOptions();
  const [timeRange, setTimeRange] = useState<TimeRange>('3d');
  const [backgroundSync, setBackgroundSync] = useState(false);
  const [syncOnOpen, setSyncOnOpen] = useState(false);
  const [healthAllowed, setHealthAllowed] = useState(false);
  const syncMutation = useSyncHealthData();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initHealthConnect();
      const [range, background, onOpen] = await Promise.all([
        loadTimeRange(),
        loadBackgroundSyncEnabled(),
        loadSyncOnOpenEnabled(),
      ]);
      if (cancelled) return;
      if (range) setTimeRange(range);
      setBackgroundSync(background);
      setSyncOnOpen(onOpen);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-read on focus: metrics changed on the Health Data Sync screen should
  // show on the way back.
  useEffect(() => {
    const refresh = () => {
      void areAllHealthMetricsEnabled().then(setHealthAllowed);
    };
    refresh();
    return navigation.addListener('focus', refresh);
  }, [navigation]);

  const syncNow = async () => {
    if (syncMutation.isPending || isSyncClaimed()) return;
    fireSelectionHaptic();
    void confirmHealthStartup();
    syncMutation.mutate({
      timeRange,
      healthMetricStates: await loadHealthMetricStates(),
    });
  };

  const header = useScreenHeader({
    title: t('appleHealthCheck.title', { defaultValue: 'Apple Health' }),
    nativeTitle: t('appleHealthCheck.title', { defaultValue: 'Apple Health' }),
    right: {
      kind: 'text',
      label: t('common.done', { defaultValue: 'Done' }),
      onPress: () => navigation.goBack(),
    },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: usesNativeHeader ? 0 : insets.top }}
    >
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
        <View className="flex-row items-center gap-3 mb-3">
          <Icon name="heart-rate" size={28} color={accentColor} />
          <Text className="flex-1 text-text-primary text-3xl font-bold">
            {t('appleHealthCheck.heading', {
              defaultValue: 'Keep your health data in sync',
            })}
          </Text>
        </View>
        <Text className="text-text-secondary text-base mb-7">
          {t('appleHealthCheck.hint', {
            defaultValue:
              'Choose how qla.fit stays up to date with Apple Health. You can change this any time in Sync settings.',
          })}
        </Text>

        <SettingsRowGroup>
          <SettingsRow
            icon="heart-rate"
            iconColor={accentColor}
            title={t('appleHealthCheck.allowTitle', {
              defaultValue: 'Allow Apple Health',
            })}
            subtitle={t('appleHealthCheck.allowSubtitle', {
              defaultValue: 'Change what qla.fit may read in Apple Health',
            })}
            rightAccessory={
              <Switch
                accessibilityLabel={t('appleHealthCheck.allowTitle', {
                  defaultValue: 'Allow Apple Health',
                })}
                value={healthAllowed}
                // iOS offers apps no supported link into Settings > Health, and
                // read access can only be changed by the user; the Health app
                // (profile > Apps > qla.fit) is the closest the system allows.
                onValueChange={() => {
                  fireSelectionHaptic();
                  void Linking.openURL('x-apple-health://');
                }}
              />
            }
          />
          <SettingsRow
            icon="health-data-sync"
            iconColor={accentColor}
            title={t('syncScreen.title', { defaultValue: 'Health Data Sync' })}
            subtitle={t('appleHealthCheck.syncSettingsSubtitle', {
              defaultValue: 'Pick which health data qla.fit syncs',
            })}
            onPress={() => navigation.navigate('Sync')}
          />
        </SettingsRowGroup>

        <SettingsRowGroup>
          <SettingsRow
            icon="calendar"
            iconColor={accentColor}
            title={t('syncScreen.range.title', { defaultValue: 'Sync Range' })}
            subtitle={t('appleHealthCheck.rangeSubtitle', {
              defaultValue: 'How far back the next sync reaches',
            })}
            rightAccessory={
              <BottomSheetPicker
                value={timeRange}
                options={timeRangeOptions}
                title={t('syncScreen.range.selectTitle', {
                  defaultValue: 'Select Sync Range',
                })}
                onSelect={(value) => {
                  setTimeRange(value);
                  void saveTimeRange(value);
                }}
                renderTrigger={({ onPress, selectedOption }) => (
                  <Pressable
                    onPress={onPress}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-text-secondary text-base">
                      {selectedOption?.label}
                    </Text>
                    <Icon
                      name="chevron-expand"
                      size={12}
                      color={textSecondary}
                    />
                  </Pressable>
                )}
              />
            }
          />
          <SettingsRow
            icon="sync"
            iconColor={accentColor}
            title={t('syncFrequency.enable', {
              defaultValue: 'Enable Background Sync',
            })}
            subtitle={t('appleHealthCheck.backgroundSubtitle', {
              defaultValue: 'Updates whenever your iPhone allows it',
            })}
            rightAccessory={
              <Switch
                accessibilityLabel={t('syncFrequency.toggleLabel', {
                  defaultValue: 'Background sync',
                })}
                value={backgroundSync}
                onValueChange={(value) => {
                  setBackgroundSync(value);
                  void applyBackgroundSyncEnabled(value);
                  if (value) void confirmHealthStartup();
                }}
              />
            }
          />
          <SettingsRow
            icon="timer"
            iconColor={accentColor}
            title={t('syncOnOpen.enable', {
              defaultValue: 'Sync when app opens',
            })}
            subtitle={t('appleHealthCheck.onOpenSubtitle', {
              defaultValue: 'Fresh numbers every time you open the app',
            })}
            rightAccessory={
              <Switch
                accessibilityLabel={t('syncOnOpen.toggleLabel', {
                  defaultValue: 'Sync when app opens',
                })}
                value={syncOnOpen}
                onValueChange={(value) => {
                  setSyncOnOpen(value);
                  void saveSyncOnOpenEnabled(value);
                  if (value) void confirmHealthStartup();
                }}
              />
            }
          />
        </SettingsRowGroup>
      </ScrollView>

      <View
        className="px-5 pt-3 gap-2 bg-background border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button loading={syncMutation.isPending} onPress={() => void syncNow()}>
          {syncMutation.isPending
            ? t('syncScreen.syncing', { defaultValue: 'Syncing…' })
            : t('syncScreen.syncNow', { defaultValue: 'Sync Now' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            fireSelectionHaptic();
            void confirmHealthStartup();
            navigation.navigate('ImportHistory');
          }}
        >
          {t('syncScreen.import.title', {
            defaultValue: 'Import Full History',
          })}
        </Button>
      </View>
    </View>
  );
}
