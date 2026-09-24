import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import HapticRefreshControl from '../components/HapticRefreshControl';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import DashboardTrendCards from '../components/DashboardTrendCards';
import { getTodayDate } from '../utils/dateUtils';
import TrendRangeSelector from '../components/TrendRangeSelector';
import TabHeader from '../components/TabHeader';
import StatusView from '../components/StatusView';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useHealthTrends, usePreferences, useServerConnection } from '../hooks';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useOpenStartWorkout } from '../hooks/useOpenStartWorkout';
import { useProfileSetup } from '../hooks/useProfileSetup';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import {
  resolveHealthTrendOrder,
  selectVisibleHealthTrends,
} from '../utils/healthTrendPreferences';
import { weightFromKg } from '../utils/unitConversions';
import {
  createNativeWorkoutsAction,
  createNativeProfileAction,
  setNativeTabHeaderActions,
  type NativeTabHeaderNavigation,
} from '../utils/nativeHeaderDatePicker';
import { useTabPress } from '../hooks/useTabPress';
import { useScrollTopOffset } from '../hooks/useScrollTopOffset';
import type { HealthTrendDateRange } from '../types/healthTrends';
import type { RootStackParamList, TabParamList } from '../types/navigation';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Trends'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function TrendsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const usesNativeTabs = useNativeIOSTabsActive();
  const { defaultColor } = useHeaderActionColors();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const bottomPadding = useActiveWorkoutBarPadding();
  const scrollRef = useRef<ScrollView>(null);
  const [range, setRange] = useState<HealthTrendDateRange>('w');
  const [refreshing, setRefreshing] = useState(false);
  const { isConnected, isLoading } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const order = useAppPreferencesStore((s) => s.healthTrendOrder);
  const hidden = useAppPreferencesStore((s) => s.hiddenHealthTrends);
  const visibleTrends = useMemo(
    () => selectVisibleHealthTrends(resolveHealthTrendOrder(order), hidden),
    [order, hidden]
  );
  const { refetch, ...trends } = useHealthTrends({
    range,
    enabled: isConnected,
    activeTrends: visibleTrends,
  });
  const weightUnit =
    (preferences?.default_weight_unit ?? 'kg') === 'kg' ? 'kg' : 'lbs';
  const weightSeries = useMemo(
    () =>
      weightUnit === 'kg'
        ? trends.weight
        : {
            ...trends.weight,
            data: trends.weight.data.map((point) => ({
              ...point,
              weight: weightFromKg(point.weight, weightUnit),
            })),
          },
    [trends.weight, weightUnit]
  );
  const startWorkout = useOpenStartWorkout(navigation);
  // The goal button in the left of the bar opens personal setup — the same
  // wizard, in the same native sheet, as the row on the Profile screen.
  const setup = useProfileSetup(isConnected);
  // The hook hands back a new object every render. Read through a ref at press
  // time so the handler — and the native header synced from it — stays put
  // rather than resetting the bar on every render.
  const openWizardRef = useRef(setup.openWizard);
  useLayoutEffect(() => {
    openWizardRef.current = setup.openWizard;
  });
  const openSetup = useCallback(() => {
    openWizardRef.current(() => navigation.navigate('SetupWizard'));
  }, [navigation]);
  const setupLabel = t('setup.edit', {
    defaultValue: 'Personal setup & goals',
  });
  const syncHeader = useCallback(() => {
    if (!usesNativeTabs) return;
    setNativeTabHeaderActions(
      navigation as unknown as NativeTabHeaderNavigation,
      [
        createNativeWorkoutsAction(
          startWorkout,
          t('presetSearch.title', { defaultValue: 'Start Workout' })
        ),
        createNativeProfileAction(
          () => navigation.navigate('Profile'),
          t('profile.title', { defaultValue: 'Profile' })
        ),
      ],
      defaultColor,
      [
        {
          sfSymbol: 'target',
          onPress: openSetup,
          accessibilityLabel: setupLabel,
          identifier: 'tab-header-setup',
        },
      ]
    );
  }, [
    navigation,
    usesNativeTabs,
    defaultColor,
    startWorkout,
    t,
    openSetup,
    setupLabel,
  ]);
  // Layout effect plus focus effect, matching Dashboard and Diary exactly.
  // An earlier attempt at the first-open shift dropped the focus sync from
  // here on the theory that setting header options twice was what moved the
  // content; Dashboard does the same two calls and does not move, so that was
  // wrong, and dropping it only made this the odd one out.
  useLayoutEffect(syncHeader, [syncHeader]);
  const { scrollToTop, onScroll, onScrollBeginDrag } = useScrollTopOffset();
  // Re-tapping the active Goals tab returns to the top, like every other tab.
  useTabPress(navigation, () => scrollToTop(scrollRef.current));

  useFocusEffect(
    useCallback(() => {
      syncHeader();
    }, [syncHeader])
  );
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  // Diary/Dashboard pattern: the content is built once, then rendered
  // either bare (native tabs supply the header) or under `TabHeader`. Keeping
  // the scroll view a direct, full-height child of the screen root is what lets
  // the iOS large title collapse into the header on scroll.
  const renderContent = () => {
    // No full-screen spinner while the connection resolves. The cards do not
    // need it to draw themselves — they render flat with skeletoned numbers and
    // fill in — and replacing the screen with a spinner meant every visit began
    // with the layout being thrown away and rebuilt. `isConnected` is only
    // trusted once loading has settled, so a slow check reads as "still
    // loading" rather than briefly as "no server".
    if (!isConnected && !isLoading) {
      return (
        <StatusView
          icon="cloud-offline"
          title={t('dashboard.noServerConfigured', {
            defaultValue: 'No server configured',
          })}
          action={{
            label: t('profile.title', { defaultValue: 'Profile' }),
            onPress: () => navigation.navigate('Profile'),
          }}
        />
      );
    }

    return (
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 16 + bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        // Without this, scrollTo cannot reach the top of a scroll view whose
        // inset is the automatic one: RN clamps a programmatic offset against
        // the EXPLICIT contentInset, which is zero here, so every negative y —
        // and the real top is negative — was silently pinned to 0.
        scrollToOverflowEnabled
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <HapticRefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={accent}
          />
        }
      >
        {visibleTrends.length > 0 && (
          <TrendRangeSelector range={range} onSelect={setRange} />
        )}
        <DashboardTrendCards
          onOpenTrend={(trend) =>
            navigation.navigate('GoalDetail', {
              metric: trend,
              date: getTodayDate(),
            })
          }
          steps={trends.steps}
          weight={weightSeries}
          sleep={trends.sleep}
          water={trends.water}
          range={range}
          weightUnit={weightUnit}
          visibleTrends={visibleTrends}
        />
      </ScrollView>
    );
  };

  const renderedContent = renderContent();

  // Wrapped exactly as Dashboard and Diary wrap theirs. Returning it bare was
  // another attempt at the first-open shift, on the theory that a wrapper kept
  // iOS from finding the scroll view; it changed nothing, and the two tabs
  // that do not shift both wrap.
  if (usesNativeTabs) {
    return (
      <View collapsable={false} className="flex-1 bg-background">
        {renderedContent}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TabHeader
        title={t('navigation.trends', { defaultValue: 'Goals' })}
        leadingAction={{
          icon: 'goal-target',
          accessibilityLabel: setupLabel,
          onPress: openSetup,
        }}
        onWorkoutsPress={startWorkout}
        onProfilePress={() => navigation.navigate('Profile')}
      />
      {renderedContent}
    </View>
  );
}
