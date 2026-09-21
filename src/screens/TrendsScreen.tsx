import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
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
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import {
  resolveHealthTrendOrder,
  selectVisibleHealthTrends,
} from '../utils/healthTrendPreferences';
import { weightFromKg } from '../utils/unitConversions';
import {
  createNativeCartAction,
  createNativeProfileAction,
  setNativeTabHeaderActions,
  type NativeTabHeaderNavigation,
} from '../utils/nativeHeaderDatePicker';
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
  const syncHeader = useCallback(() => {
    if (!usesNativeTabs) return;
    setNativeTabHeaderActions(
      navigation as unknown as NativeTabHeaderNavigation,
      [
        createNativeCartAction(
          () => navigation.navigate('Cart'),
          t('cart.title', { defaultValue: 'Meals' })
        ),
        createNativeProfileAction(
          () => navigation.navigate('Profile'),
          t('profile.title', { defaultValue: 'Profile' })
        ),
      ],
      defaultColor
    );
  }, [navigation, usesNativeTabs, defaultColor, t]);
  useLayoutEffect(syncHeader, [syncHeader]);
  useFocusEffect(syncHeader);
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
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
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
        onCartPress={() => navigation.navigate('Cart')}
        onProfilePress={() => navigation.navigate('Profile')}
      />
      {renderedContent}
    </View>
  );
}
