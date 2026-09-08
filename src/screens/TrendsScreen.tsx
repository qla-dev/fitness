import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import DashboardTrendCards from '../components/DashboardTrendCards';
import SegmentedControl from '../components/SegmentedControl';
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
  const [range, setRange] = useState<HealthTrendDateRange>('7d');
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
  return (
    <View className="flex-1 bg-background">
      {!usesNativeTabs && (
        <TabHeader
          title={t('navigation.trends', { defaultValue: 'Trends' })}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      )}
      {isLoading ? (
        <StatusView
          loading
          title={t('trends.loading', {
            defaultValue: 'Loading trends...',
          })}
        />
      ) : !isConnected ? (
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
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1 bg-background"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 16 + bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={
            usesNativeTabs ? 'automatic' : 'never'
          }
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
            <SegmentedControl<HealthTrendDateRange>
              segments={[
                { key: '7d', label: t('ranges.7d', { defaultValue: '7d' }) },
                { key: '30d', label: t('ranges.30d', { defaultValue: '30d' }) },
                { key: '90d', label: t('ranges.90d', { defaultValue: '90d' }) },
              ]}
              activeKey={range}
              onSelect={setRange}
            />
          )}
          <DashboardTrendCards
            steps={trends.steps}
            weight={weightSeries}
            sleep={trends.sleep}
            range={range}
            weightUnit={weightUnit}
            visibleTrends={visibleTrends}
          />
        </ScrollView>
      )}
    </View>
  );
}
