import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDiscreetMode } from '../hooks/useDiscreetMode';
import { useCycleMode } from '../hooks/useCycleMode';
import { useCycleSettings } from '../hooks/useCycleSettings';
import { useCycleHistory } from '../hooks/useCycleHistory';
import { useCycleLogsRange } from '../hooks/useCycleLogs';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { trackingMenu } from '../utils/trackingMenu';
import type { RootStackScreenProps } from '../types/navigation';

import FeatureFacts from '../components/FeatureFacts';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import SegmentedControl from '../components/SegmentedControl';
import StatusView from '../components/StatusView';
import CycleCalendarGrid from '../components/wellness/CycleCalendarGrid';
import CycleHistoryList from '../components/wellness/CycleHistoryList';
import CycleInsightsView from '../components/wellness/CycleInsightsView';
import CycleHubSummary from '../components/wellness/CycleHubSummary';
import { fireSelectionHaptic } from '../services/haptics';
import CycleAlerts from '../components/wellness/CycleAlerts';
import FertilityCard from '../components/wellness/ttc/FertilityCard';
import PregnancyOverviewView from '../components/wellness/pregnancy/PregnancyOverviewView';

import { buildCycleAlerts } from '@workspace/shared';
import { getTodayDate, addDays } from '../utils/dateUtils';
import { getPhaseDisplayName } from '../utils/cycleDisplayUtils';
import { useCyclePredictionData } from '../hooks/useCyclePredictionData';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type CycleHubScreenProps = RootStackScreenProps<'CycleHub'>;

const CycleHubScreen: React.FC<CycleHubScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();

  const {
    mode,
    enabled,
    isLoading: isModeLoading,
    onboardedAt,
  } = useCycleMode();
  const {
    settings,
    isLoading: isSettingsLoading,
    updateSettings,
  } = useCycleSettings();
  const { discreetMode } = useDiscreetMode();

  // Redirect to Onboarding if not enabled or not onboarded
  useEffect(() => {
    if (!isModeLoading) {
      if (!enabled || !onboardedAt) {
        navigation.replace('CycleOnboarding');
      }
    }
  }, [isModeLoading, enabled, onboardedAt, navigation]);

  // Anchor date for predictions, alerts, and the header log action
  const [selectedDate] = useState(getTodayDate);

  // Tabs State. The middle segment is mode-specific: cycle/TTC gets Trends,
  // pregnancy gets Tools; a middle-tab selection left over from the other mode
  // falls back to Overview.
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trends' | 'tools' | 'history'
  >('overview');
  const middleTab =
    mode === 'pregnant'
      ? ({
          key: 'tools',
          label: t('cycleHub.tools', { defaultValue: 'Tools' }),
        } as const)
      : ({
          key: 'trends',
          label: t('cycleHub.trends', { defaultValue: 'Trends' }),
        } as const);
  const currentTab =
    (activeTab === 'trends' || activeTab === 'tools') &&
    activeTab !== middleTab.key
      ? 'overview'
      : activeTab;

  // Queries. Logs feed the History calendar, so the range follows the month
  // it is showing, padded to cover the adjacent-month days the grid renders.
  const { cycles, isLoading: isHistoryLoading } = useCycleHistory();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    selectedDate.slice(0, 7)
  );
  const monthStart = `${visibleMonth}-01`;
  const { logs, isLoading: isLogsLoading } = useCycleLogsRange({
    startDate: useMemo(() => addDays(monthStart, -7), [monthStart]),
    endDate: useMemo(() => addDays(monthStart, 45), [monthStart]),
  });

  const isLoading =
    isModeLoading || isSettingsLoading || isHistoryLoading || isLogsLoading;

  // 2. Shared Cycle Prediction Hook
  const sharedPrediction = useCyclePredictionData(selectedDate);

  const cycleStats = useMemo(() => {
    return {
      avgCycleLength: sharedPrediction?.avgCycleLength ?? 28,
      avgPeriodLength: sharedPrediction?.avgPeriodLength ?? 5,
    };
  }, [sharedPrediction]);

  const dayStats = useMemo(() => {
    return {
      phase: sharedPrediction?.phase ?? 'unknown',
      cycleDay: sharedPrediction?.day ?? null,
    };
  }, [sharedPrediction]);

  const ringMarkers = useMemo(() => {
    return {
      fertileStartDay: sharedPrediction?.fertileStartDay ?? null,
      fertileEndDay: sharedPrediction?.fertileEndDay ?? null,
      ovulationDay: sharedPrediction?.ovulationDay ?? null,
    };
  }, [sharedPrediction]);

  // 5. Alerts
  const alerts = useMemo(() => {
    if (
      !settings ||
      !sharedPrediction?.prediction ||
      !sharedPrediction.prediction.cycles ||
      sharedPrediction.prediction.cycles.length === 0
    )
      return [];
    return buildCycleAlerts(selectedDate, sharedPrediction.prediction, []);
  }, [selectedDate, sharedPrediction, settings]);

  const activeSegmentLabel = useMemo(() => {
    return getPhaseDisplayName(dayStats.phase, discreetMode, t);
  }, [dayStats, discreetMode, t]);

  const hubTitle = discreetMode
    ? t('cycleHub.wellness', { defaultValue: 'Wellness' })
    : mode === 'pregnant'
      ? t('cycleHub.pregnancyHub', { defaultValue: 'Pregnancy Hub' })
      : t('cycleHub.cycleHub', { defaultValue: 'Cycle Hub' });

  // The goal screen's header: transparent, the title held in the bar, and
  // everything under it scrolling, the segmented control included.
  const header = useScreenHeader({
    variant: 'transparent',
    title: hubTitle,
    nativeTitle: hubTitle,
    left: { kind: 'back' },
    right: [
      trackingMenu({
        t,
        identifier: 'cycle-hub-tracking',
        title: t('cycleHub.trackingTitle', {
          defaultValue:
            'Your rhythm, on your terms. Pause any time and pick it up again from Profile.',
        }),
        tracking: true,
        confirmTitle: t('cycleHub.stopTitle', {
          defaultValue: 'Stop cycle tracking?',
        }),
        confirmMessage: t('cycleHub.stopMessage', {
          defaultValue:
            'Cycle tracking turns off and leaves your Tracker. Your logged days are kept, and you can turn it back on in Profile under Cycle & Pregnancy.',
        }),
        // The same switch as Profile's Cycle & Pregnancy toggle.
        onStop: () => {
          updateSettings({ enabled: false });
          navigation.goBack();
        },
      }),
      {
        kind: 'icon',
        ionicon: 'add-outline',
        sfSymbol: 'plus',
        role: 'primary',
        separated: true,
        accessibilityLabel: t('cycleHub.logEntry', {
          defaultValue: 'Log Entry',
        }),
        onPress: () =>
          navigation.navigate('CycleLogModal', { date: selectedDate }),
      },
    ],
  });

  // The copy is about cycles, so it stays out of pregnancy mode, and out of
  // discreet mode, which keeps cycle wording off the screen.
  const showsFacts =
    currentTab === 'overview' && mode !== 'pregnant' && !discreetMode;

  if (isLoading || !settings) {
    return <StatusView loading className="bg-background" />;
  }

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      <NativeHeaderScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 80,
        }}
      >
        <View className="mb-3">
          <SegmentedControl
            segments={[
              {
                key: 'overview',
                label: t('cycleHub.overview', { defaultValue: 'Overview' }),
              },
              middleTab,
              {
                key: 'history',
                label: t('cycleHub.history', { defaultValue: 'History' }),
              },
            ]}
            activeKey={currentTab}
            onSelect={setActiveTab}
          />
        </View>
        {currentTab === 'overview' && (
          <View className="gap-3">
            {/* Pregnancy Overview or Cycle Overview */}
            {mode === 'pregnant' ? (
              <PregnancyOverviewView section="overview" />
            ) : (
              <>
                {/* The day-bead bracelet with countdowns beside it. A tap
                    gives a light tick, so the bracelet feels like an object
                    in the hand rather than a picture of one. */}
                <Pressable
                  className="p-4 bg-surface rounded-xl border-0"
                  onPress={fireSelectionHaptic}
                  accessibilityRole="summary"
                >
                  <CycleHubSummary
                    cycleDay={dayStats.cycleDay}
                    cycleLength={cycleStats.avgCycleLength}
                    periodLength={cycleStats.avgPeriodLength}
                    fertileStartDay={ringMarkers.fertileStartDay}
                    fertileEndDay={ringMarkers.fertileEndDay}
                    ovulationDay={ringMarkers.ovulationDay}
                    phase={dayStats.phase}
                    phaseLabel={activeSegmentLabel}
                    daysLate={sharedPrediction?.daysLate ?? 0}
                    discreet={discreetMode}
                  />
                </Pressable>

                {/* Cycle Alerts */}
                {alerts.length > 0 && (
                  <CycleAlerts
                    alerts={alerts.map((a) => ({
                      key: a.key,
                      severity: a.severity,
                      message: a.message,
                      params: a.params,
                    }))}
                  />
                )}

                {/* TTC: fertility summary */}
                {mode === 'ttc' && <FertilityCard date={selectedDate} />}
              </>
            )}
          </View>
        )}

        {showsFacts && <FeatureFacts feature="cycle" />}

        {currentTab === 'trends' && (
          <View className="gap-3">
            <CycleInsightsView />
          </View>
        )}

        {currentTab === 'tools' && (
          <View className="gap-3">
            <PregnancyOverviewView section="tools" />
          </View>
        )}

        {currentTab === 'history' && (
          <View className="gap-6">
            <CycleCalendarGrid
              initialDate={selectedDate}
              onDayPress={(date) =>
                navigation.navigate('CycleLogModal', { date })
              }
              cycles={cycles}
              logs={logs}
              settings={settings}
              onMonthChange={setVisibleMonth}
            />
            <View className="border-t border-border-subtle" />
            <CycleHistoryList />
          </View>
        )}

        {/* The About card above already carries its own bottom margin. */}
        <View className={`${showsFacts ? 'mt-0' : 'mt-6'} px-2`}>
          <MedicalDisclaimer />
        </View>
      </NativeHeaderScrollView>
    </View>
  );
};

export default CycleHubScreen;
