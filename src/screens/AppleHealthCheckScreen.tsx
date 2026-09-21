import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
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
import DateRangeSheet, {
  type DateRangeSheetRef,
} from '../components/DateRangeSheet';
import HealthMetricList from '../components/HealthMetricList';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useWritebackToggles } from '../hooks/useWritebackToggles';
import { useSyncHealthData } from '../hooks';
import { useSyncTimeRangeOptions } from '../hooks/useSyncTimeRangeOptions';
import { useHealthMetricToggles } from '../hooks/useHealthMetricToggles';
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
  loadDailySyncRange,
  saveDailySyncRange,
  DEFAULT_DAILY_SYNC_RANGE,
  DEFAULT_HISTORY_SYNC_RANGE,
  saveSyncOnOpenEnabled,
  type TimeRange,
} from '../services/storage';
import {
  CATEGORY_ORDER,
  HEALTH_METRICS,
  getHealthCategoryLabel,
} from '../HealthMetrics';
import {
  WRITEBACK_METRICS,
  type WritebackDateRange,
} from '../WritebackMetrics';
import { removeWrittenData } from '../services/writeback';
import { addLog } from '../services/LogService';
import { formatLocalizedNumber } from '../localization';
import { useSyncProgress } from '../hooks/useSyncProgress';
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

const FINISHING_ROTATION_MS = 4000;

/** Remove-scope choices in the writeback section's bottom-sheet menu. */
type RemoveScope = 'all' | 'range';

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
  // Per-visit, and never loaded from storage: the history sync opens at a
  // full year every time (see DEFAULT_HISTORY_SYNC_RANGE). Narrowing it applies
  // to this visit only, which is why nothing writes it back.
  const [timeRange, setTimeRange] = useState<TimeRange>(
    DEFAULT_HISTORY_SYNC_RANGE
  );
  const [dailySyncRange, setDailySyncRange] = useState<TimeRange>(
    DEFAULT_DAILY_SYNC_RANGE
  );
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
  const dateRangeSheetRef = useRef<DateRangeSheetRef>(null);

  const syncMutation = useSyncHealthData({ onSuccess: refreshData });
  const { isAllMetricsEnabled, toggleMetric, toggleAllMetrics } =
    useHealthMetricToggles({
      healthMetricStates,
      setHealthMetricStates,
      writebackStates,
      setWritebackStates,
      onChanged: refreshData,
    });
  const { toggleWriteback } = useWritebackToggles({
    healthMetricStates,
    setWritebackStates,
  });

  // HealthMetricList keys each row's switch by `stateKey`; writeback preferences
  // are keyed by `id`, so the rows carry one pointing at themselves. The spread
  // keeps every WritebackMetric field, so onToggle still hands the hook a whole
  // metric (permission and preferenceKey included).
  const writebackRows = WRITEBACK_METRICS.map((metric) => ({
    ...metric,
    stateKey: metric.id,
  }));

  const writebackStoreName =
    Platform.OS === 'android'
      ? t('healthSync.healthConnect', { defaultValue: 'Health Connect' })
      : t('healthSync.appleHealth', { defaultValue: 'Apple Health' });

  // Delete written data, then surface the outcome honestly: success, a warning when
  // some records couldn't be deleted (partial), or an error if it threw. A full purge
  // (range === null) is a rollback, so reset the toggles locally to match the prefs.
  const doRemoveWritebackData = async (
    range: WritebackDateRange | null
  ): Promise<void> => {
    try {
      const { ok } = await removeWrittenData(range);
      if (range === null) setWritebackStates({});
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok
          ? t('syncScreen.removal.removed', { defaultValue: 'Removed' })
          : t('syncScreen.removal.partial', {
              defaultValue: 'Partially removed',
            }),
        text2: ok
          ? t('syncScreen.removal.deleted', {
              defaultValue: 'Deleted qla.fit data from {{store}}.',
              store: writebackStoreName,
            })
          : t('syncScreen.removal.partialMessage', {
              defaultValue: "Some records couldn't be deleted from {{store}}.",
              store: writebackStoreName,
            }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(
        `[AppleHealthCheck] Failed to remove writeback data: ${errorMessage}`,
        'ERROR'
      );
      Toast.show({
        type: 'error',
        text1: t('common.error', { defaultValue: 'Error' }),
        text2: t('syncScreen.removal.errorMessage', {
          defaultValue: 'Could not remove data from {{store}}.',
          store: writebackStoreName,
        }),
      });
    }
  };

  // Full purge → confirm (it's destructive and turns writeback off).
  const handleRemoveAllData = (): void => {
    Alert.alert(
      t('syncScreen.removal.confirmTitle', {
        defaultValue: 'Remove all {{store}} data',
        store: writebackStoreName,
      }),
      t('syncScreen.removal.confirmMessage', {
        defaultValue:
          'Delete every nutrition, hydration and workout record qla.fit wrote to {{store}}, and turn writeback off? Your qla.fit diary and records from other apps are not affected.',
        store: writebackStoreName,
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => void doRemoveWritebackData(null),
        },
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initialized = await initHealthConnect();
      const [dailyRange, background, onOpen, metricStates] = await Promise.all([
        loadDailySyncRange(),
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
      setDailySyncRange(dailyRange);
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
    fetchHealthDisplayData(dailySyncRange).then((data) => {
      if (cancelled) return;
      setHealthData(data);
      setIsLoadingHealthData(false);
    });
    return () => {
      cancelled = true;
    };
  }, [healthReady, dailySyncRange, dataRefreshKey]);

  /**
   * Set only by a deliberate Sync History Now press: the screen closes itself
   * once that run has finished, so the wait happens against the button's
   * spinner instead of leaving a modal the user has to dismiss by hand. The
   * syncs that start on their own — returning from the Health app, a
   * permission change — go through startSync() and never set it, so they can
   * never pull the screen out from under the user.
   */
  const dismissAfterSyncRef = useRef(false);

  const syncRange = async (range: TimeRange) => {
    if (syncMutation.isPending || isSyncClaimed()) {
      // Nothing was started, so nothing will arrive to close the screen.
      dismissAfterSyncRef.current = false;
      return;
    }
    syncMutation.mutate(
      {
        timeRange: range,
        healthMetricStates: await loadHealthMetricStates(),
      },
      {
        // Settled, not success: a failed sync has already reported itself in a
        // toast, and holding the screen open on an error the user cannot act
        // on here would strand the press.
        onSettled: () => {
          if (!dismissAfterSyncRef.current) return;
          dismissAfterSyncRef.current = false;
          navigation.goBack();
        },
      }
    );
  };

  // Turning everything on here also switches on both automatic syncs, so a
  // single tap leaves Health fully set up. Turning it off only touches metrics.
  const enableAll = async () => {
    // Read against the master switch, not the metric list: with every metric on
    // but an automatic sync off, the switch reads off, and tapping it has to
    // finish the setup rather than turn the metrics back off.
    const turningOn = !isEverythingEnabled;
    if (turningOn !== isAllMetricsEnabled) await toggleAllMetrics();
    if (!turningOn) {
      setBackgroundSync(false);
      setSyncOnOpen(false);
      await Promise.all([
        applyBackgroundSyncEnabled(false),
        saveSyncOnOpenEnabled(false),
      ]);
      return;
    }
    // A refused permission reverts the metrics; leave automatic sync alone then.
    if (!(await areAllHealthMetricsEnabled())) return;
    setBackgroundSync(true);
    setSyncOnOpen(true);
    await Promise.all([
      applyBackgroundSyncEnabled(true),
      saveSyncOnOpenEnabled(true),
      confirmHealthStartup(),
    ]);
  };

  /**
   * "Enable All" stands for a fully set-up Health connection, not just the
   * metric list: switching off either automatic sync below leaves Health only
   * half on, so the master switch has to follow it back off.
   */
  const isEverythingEnabled =
    isAllMetricsEnabled && backgroundSync && syncOnOpen;

  const syncProgress = useSyncProgress();
  const [finishingIndex, setFinishingIndex] = useState(0);
  const busy = syncMutation.isPending;

  /**
   * One sync over the History Sync Range set above, and nothing else. This
   * button used to start the full-history backfill instead, which walks the
   * whole HealthKit archive in 30-day windows — sixty-odd of them, minutes of
   * work — for a press that reads as "sync now". A one-time import of
   * everything is a deliberate act with its own screen; it does not belong
   * behind the sync button at the foot of a settings screen.
   */
  const startSync = (range: TimeRange) => {
    if (busy) return;
    void syncRange(range);
  };

  const syncNow = () => {
    if (busy) return;
    fireSelectionHaptic();
    setFinishingIndex(0);
    void confirmHealthStartup();
    dismissAfterSyncRef.current = true;
    startSync(timeRange);
  };

  // Coming back from the Health app or iPhone Settings (e.g. after Check Apple
  // Health Permissions) may mean new permissions: reload what the screen shows
  // and sync straight away. Only a return from the background counts, so
  // pulling down Notification Center does not start a sync.
  const startSyncRef = useRef<() => void>(() => startSync(dailySyncRange));
  useEffect(() => {
    // The startup window, not the history one: this fires on its own when the
    // user comes back from the Health app, and only a deliberate press should
    // reach back a year.
    startSyncRef.current = () => startSync(dailySyncRange);
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

  // Metrics settled out of metrics enabled. A one-window sync has no window
  // count to report the way the history import did, and this is the movement
  // the user can actually see: the run reads three metrics at a time.
  const syncPercent =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.completed / syncProgress.total) * 100)
      : null;

  // Every metric is in and the run is still going: it is saving and writing
  // back now, neither of which reports a count of anything.
  const finishing = syncMutation.isPending && syncPercent === 100;
  useEffect(() => {
    if (!finishing) return;
    const timer = setInterval(
      () => setFinishingIndex((index) => index + 1),
      FINISHING_ROTATION_MS
    );
    return () => clearInterval(timer);
  }, [finishing]);

  /**
   * The percentage counts metrics read, and the reads finish well before the
   * run does — saving and the writeback come after them. Rather than leave the
   * button parked on 100% looking hung, it cycles these while that tail runs.
   * Each line is true of the whole tail, so it never claims a phase the run is
   * not in.
   */
  const finishingMessages = [
    t('appleHealthCheck.finishing.saving', {
      defaultValue: 'Saving your health data…',
    }),
    t('appleHealthCheck.finishing.writeback', {
      defaultValue: 'Updating your records…',
    }),
    t('appleHealthCheck.finishing.almost', {
      defaultValue: 'Almost done…',
    }),
  ];
  const finishingMessage =
    finishingMessages[finishingIndex % finishingMessages.length];

  const syncLabel = !syncMutation.isPending
    ? t('appleHealthCheck.syncHistoryNow', { defaultValue: 'Sync History Now' })
    : finishing
      ? finishingMessage
      : syncPercent === null
        ? t('syncScreen.syncing', { defaultValue: 'Syncing…' })
        : t('appleHealthCheck.syncingPercent', {
            defaultValue: 'Syncing… {{percent}}%',
            percent: formatLocalizedNumber(syncPercent),
          });

  const header = useScreenHeader({
    variant: 'transparent',
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
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
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
                value={isEverythingEnabled}
                onValueChange={() => void enableAll()}
              />
            }
          />
        </SettingsRowGroup>
        <SettingsRowGroup>
          <SettingsRow
            icon="calendar"
            iconColor={accentColor}
            title={t('syncScreen.historyRange.title', {
              defaultValue: 'History Sync Range',
            })}
            subtitle={t('appleHealthCheck.rangeSubtitle', {
              defaultValue: 'How far back the next sync reaches',
            })}
            rightAccessory={
              <BottomSheetPicker
                value={timeRange}
                options={timeRangeOptions}
                title={t('syncScreen.historyRange.selectTitle', {
                  defaultValue: 'Select History Sync Range',
                })}
                onSelect={setTimeRange}
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
            icon="timer"
            iconColor={accentColor}
            title={t('syncScreen.startupRange.title', {
              defaultValue: 'Startup Sync Range',
            })}
            subtitle={t('appleHealthCheck.dailyRangeSubtitle', {
              defaultValue: 'How far back the automatic syncs reach',
            })}
            rightAccessory={
              <BottomSheetPicker
                value={dailySyncRange}
                options={timeRangeOptions}
                title={t('syncScreen.startupRange.selectTitle', {
                  defaultValue: 'Select Startup Sync Range',
                })}
                onSelect={(value) => {
                  setDailySyncRange(value);
                  void saveDailySyncRange(value);
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

        {/* Writeback closes the loop the groups above open: everything before
            this reads FROM the health store, these three write back TO it. One
            heading rather than the metrics' own Nutrition/Activity categories,
            which would print section names the read half already used and give
            no clue the direction had flipped. */}
        <View className="mb-4">
          <Text className="px-4 pb-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
            {t('appleHealthCheck.writebackHeading', {
              defaultValue: 'Write to {{store}}',
              store: writebackStoreName,
            })}
          </Text>
          <HealthMetricList
            card
            metrics={writebackRows}
            healthMetricStates={writebackStates}
            onToggle={(metric, value) => void toggleWriteback(metric, value)}
          />
          <Text className="px-4 pt-2 text-xs text-text-muted">
            {t('appleHealthCheck.writebackHint', {
              defaultValue:
                'Sends what you log in qla.fit out to {{store}}. Entries imported from {{store}} are never sent back.',
              store: writebackStoreName,
            })}
          </Text>
          <BottomSheetPicker<RemoveScope>
            value={'' as RemoveScope}
            title={t('healthSync.removeFrom', {
              defaultValue: 'Remove from {{store}}',
              store: writebackStoreName,
            })}
            options={[
              {
                label: t('healthSync.allTime', { defaultValue: 'All time' }),
                value: 'all',
              },
              {
                label: t('healthSync.pickDateRange', {
                  defaultValue: 'Pick a date range…',
                }),
                value: 'range',
              },
            ]}
            onSelect={(scope) =>
              scope === 'all'
                ? handleRemoveAllData()
                : dateRangeSheetRef.current?.present()
            }
            renderTrigger={({ onPress }) => (
              <Button
                variant="ghost"
                onPress={onPress}
                className="mt-1 py-1 px-4 self-start"
              >
                <Text className="text-sm font-medium text-text-danger-subtle">
                  {t('healthSync.removeData', {
                    defaultValue: 'Remove qla.fit data from {{store}}',
                    store: writebackStoreName,
                  })}
                </Text>
              </Button>
            )}
          />
        </View>
      </ScrollView>

      <DateRangeSheet
        ref={dateRangeSheetRef}
        onConfirm={(from, to) => void doRemoveWritebackData({ from, to })}
      />

      <View
        className="px-5 pt-3 bg-background border-t border-border"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button disabled={!healthReady || busy} onPress={syncNow}>
          {busy ? (
            // Beside the label rather than Button's own `loading`, which
            // replaces it: the label is where the import reports its progress,
            // and a bare spinner would hide the percentage for the length of
            // the longest wait the app has.
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-base text-white font-semibold">
                {syncLabel}
              </Text>
            </View>
          ) : (
            syncLabel
          )}
        </Button>
      </View>
    </View>
  );
}
