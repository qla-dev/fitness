import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Button from '../components/ui/Button';
import Switch from '../components/ui/Switch';
import Icon from '../components/Icon';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import BottomSheetPicker from '../components/BottomSheetPicker';
import HealthMetricList from '../components/HealthMetricList';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useSyncHealthData } from '../hooks';
import { useSyncTimeRangeOptions } from '../hooks/useSyncTimeRangeOptions';
import { useHealthMetricToggles } from '../hooks/useHealthMetricToggles';
import { useBackfillRunner } from '../hooks/useBackfillRunner';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  initHealthConnect,
  loadHealthPreference,
} from '../services/healthConnectService';
import {
  applyBackgroundSyncEnabled,
  areAllHealthMetricsEnabled,
  confirmHealthStartup,
  loadHealthMetricStates,
} from '../services/healthSyncSettings';
import { fetchHealthDisplayData } from '../services/healthDataDisplay';
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
import {
  CATEGORY_ORDER,
  HEALTH_METRICS,
  getHealthCategoryLabel,
} from '../HealthMetrics';
import { WRITEBACK_METRICS } from '../WritebackMetrics';
import { formatLocalizedNumber } from '../localization';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * Health app's apps-and-sources list, where a user turns an app's read access
 * back on after declining the system sheet (iOS cannot re-present it). The path
 * is undocumented: reported to open that list on iOS 16, and anything the
 * Health app does not recognise still opens the app itself.
 */
const HEALTH_APPS_URL = 'x-apple-health://Sources/';

// Fixed blue tones so the heart reads the same in light and dark mode.
const HERO_GRADIENT_TOP = 'hsl(205, 95%, 62%)';
const HERO_GRADIENT_BOTTOM = 'hsl(225, 85%, 50%)';
const HERO_SIZE = 76;
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/** A gradient-filled heart with a slow, resting heartbeat pulse. */
function HealthHeroIcon() {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    return () => cancelAnimation(scale);
  }, [reducedMotion, scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Svg width={HERO_SIZE} height={HERO_SIZE} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="healthHero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={HERO_GRADIENT_TOP} />
            <Stop offset="1" stopColor={HERO_GRADIENT_BOTTOM} />
          </LinearGradient>
        </Defs>
        <Path d={HEART_PATH} fill="url(#healthHero)" />
      </Svg>
    </Animated.View>
  );
}

const metricsByCategory = CATEGORY_ORDER.map((category) => ({
  category,
  metrics: HEALTH_METRICS.filter(
    (metric) => (metric.category || 'Other') === category
  ),
})).filter((group) => group.metrics.length > 0);

/**
 * Last step of the iOS startup protocol, straight after the Apple Health access
 * sheet: where to fix Health permissions, which data syncs, the sync range and
 * automatic sync settings, and one Sync Now that imports the full history the
 * first time.
 * Laid out like the setup wizard so the startup steps read as one flow.
 *
 * Only acting here (syncing or switching on automatic sync) marks Health as set
 * up; closing with Done alone brings both Health steps back on the next start.
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
  const [healthReady, setHealthReady] = useState(false);
  const [healthMetricStates, setHealthMetricStates] = useState<
    Record<string, boolean>
  >({});
  const [writebackStates, setWritebackStates] = useState<
    Record<string, boolean>
  >({});
  const [healthData, setHealthData] = useState<Record<string, string>>({});
  const [isLoadingHealthData, setIsLoadingHealthData] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const refreshData = () => setDataRefreshKey((key) => key + 1);

  const syncMutation = useSyncHealthData({ onSuccess: refreshData });
  const backfill = useBackfillRunner();
  const { isAllMetricsEnabled, toggleMetric, toggleAllMetrics } =
    useHealthMetricToggles({
      healthMetricStates,
      setHealthMetricStates,
      writebackStates,
      onChanged: refreshData,
    });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initialized = await initHealthConnect();
      const [range, background, onOpen, metricStates] = await Promise.all([
        loadTimeRange(),
        loadBackgroundSyncEnabled(),
        loadSyncOnOpenEnabled(),
        loadHealthMetricStates(),
      ]);
      const writeback: Record<string, boolean> = {};
      for (const metric of WRITEBACK_METRICS) {
        writeback[metric.id] =
          (await loadHealthPreference<boolean>(metric.preferenceKey)) === true;
      }
      if (cancelled) return;
      if (range) setTimeRange(range);
      setBackgroundSync(background);
      setSyncOnOpen(onOpen);
      setHealthMetricStates(metricStates);
      setWritebackStates(writeback);
      setHealthReady(initialized);
      if (!initialized) setIsLoadingHealthData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Latest value per metric, so an empty one points the user at permissions.
  useEffect(() => {
    if (!healthReady) return;
    let cancelled = false;
    fetchHealthDisplayData(timeRange).then((data) => {
      if (cancelled) return;
      setHealthData(data);
      setIsLoadingHealthData(false);
    });
    return () => {
      cancelled = true;
    };
  }, [healthReady, timeRange, dataRefreshKey]);

  const syncRange = async () => {
    if (syncMutation.isPending || isSyncClaimed()) return;
    syncMutation.mutate({
      timeRange,
      healthMetricStates: await loadHealthMetricStates(),
    });
  };

  // The history import stops at the start of today, so a finished import is
  // followed by a normal sync that brings today in too.
  const importWasRunning = useRef(false);
  useEffect(() => {
    if (backfill.status === 'running') {
      importWasRunning.current = true;
      return;
    }
    if (!importWasRunning.current) return;
    importWasRunning.current = false;
    refreshData();
    if (backfill.status === 'done') void syncRange();
    // syncRange reads current state; only the status transition should fire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backfill.status]);

  // Turning everything on here also switches on both automatic syncs, so a
  // single tap leaves Health fully set up. Turning it off only touches metrics.
  const enableAll = async () => {
    const turningOn = !isAllMetricsEnabled;
    await toggleAllMetrics();
    // A refused permission reverts the metrics; leave automatic sync alone then.
    if (!turningOn || !(await areAllHealthMetricsEnabled())) return;
    setBackgroundSync(true);
    setSyncOnOpen(true);
    await Promise.all([
      applyBackgroundSyncEnabled(true),
      saveSyncOnOpenEnabled(true),
      confirmHealthStartup(),
    ]);
  };

  const importing = backfill.status === 'running';
  const busy = importing || syncMutation.isPending;

  // Sync Now imports the full history until it has completed once (resuming an
  // interrupted import), then syncs the chosen range like the Sync screen.
  const startSync = () => {
    if (busy || backfill.status === 'loading') return;
    if (backfill.status === 'done') void syncRange();
    else backfill.start();
  };

  const syncNow = () => {
    if (busy || backfill.status === 'loading') return;
    fireSelectionHaptic();
    void confirmHealthStartup();
    startSync();
  };

  // Coming back from the Health app or iPhone Settings (e.g. after Check Apple
  // Health Permissions) may mean new permissions: reload what the screen shows
  // and sync straight away. Only a return from the background counts, so
  // pulling down Notification Center does not start a sync.
  const startSyncRef = useRef(startSync);
  useEffect(() => {
    startSyncRef.current = startSync;
  });
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      const cameBack = previous === 'background' && next === 'active';
      previous = next;
      if (!cameBack) return;
      void loadHealthMetricStates().then(setHealthMetricStates);
      setDataRefreshKey((key) => key + 1);
      startSyncRef.current();
    });
    return () => subscription.remove();
  }, []);

  const progress = backfill.progress;
  const syncLabel = importing
    ? progress?.phase === 'importing' && progress.totalDays > 0
      ? t('appleHealthCheck.importingPercent', {
          defaultValue: 'Importing history… {{percent}}%',
          percent: formatLocalizedNumber(
            Math.round((progress.importedDays / progress.totalDays) * 100)
          ),
        })
      : t('appleHealthCheck.preparingImport', {
          defaultValue: 'Preparing import…',
        })
    : syncMutation.isPending
      ? t('syncScreen.syncing', { defaultValue: 'Syncing…' })
      : t('syncScreen.syncNow', { defaultValue: 'Sync Now' });

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
        <View className="items-center mb-4">
          <HealthHeroIcon />
        </View>
        <Text className="text-text-primary text-3xl font-bold mb-3">
          {t('appleHealthCheck.heading', {
            defaultValue: 'Keep your health data in sync',
          })}
        </Text>
        <Text className="text-text-secondary text-base mb-7">
          {t('appleHealthCheck.hint', {
            defaultValue:
              'Choose how qla.fit stays up to date with Apple Health. You can change this any time in Sync settings.',
          })}
        </Text>

        <SettingsRowGroup>
          <SettingsRow
            icon="health-data-sync"
            iconColor={accentColor}
            title={t('appleHealthCheck.checkPermissionsTitle', {
              defaultValue: 'Check Apple Health Permissions',
            })}
            subtitle={t('appleHealthCheck.checkPermissionsSubtitle', {
              defaultValue: 'Opens the Health app',
            })}
            // iOS offers apps no supported link into Settings > Health, and
            // read access can only be changed by the user; see HEALTH_APPS_URL.
            onPress={() => {
              void Linking.openURL(HEALTH_APPS_URL);
            }}
          />
        </SettingsRowGroup>
        <Text className="text-text-secondary text-sm px-4 -mt-2 mb-6">
          {t('appleHealthCheck.permissionsHelp', {
            defaultValue:
              'If a metric below shows no data, open the Health app, tap Sharing, then Apps, then qla.fit, and turn that data on.',
          })}
        </Text>

        <SettingsRowGroup
          title={t('healthSync.title', { defaultValue: 'Health Data to Sync' })}
        >
          <SettingsRow
            title={t('healthSync.enableAll', {
              defaultValue: 'Enable All Health Metrics',
            })}
            rightAccessory={
              <Switch
                accessibilityLabel={t('healthSync.enableAll', {
                  defaultValue: 'Enable All Health Metrics',
                })}
                value={isAllMetricsEnabled}
                onValueChange={() => void enableAll()}
              />
            }
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
        {metricsByCategory.map(({ category, metrics }) => (
          <View key={category} className="mb-4">
            <Text className="px-4 pb-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
              {getHealthCategoryLabel(t, category)}
            </Text>
            <HealthMetricList
              card
              metrics={metrics}
              healthMetricStates={healthMetricStates}
              onToggle={(metric, value) => void toggleMetric(metric, value)}
              healthData={healthData}
              isLoadingHealthData={isLoadingHealthData}
            />
          </View>
        ))}
      </ScrollView>

      <View
        className="px-5 pt-3 bg-background border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button loading={busy} disabled={!healthReady} onPress={syncNow}>
          {syncLabel}
        </Button>
      </View>
    </View>
  );
}
