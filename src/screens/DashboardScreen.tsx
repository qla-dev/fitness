import { isLocalDataMode } from '../services/dataMode';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import DashboardNutrientCard from '../components/DashboardNutrientCard';
import CycleCard from '../components/CycleCard';
import TabHeader from '../components/TabHeader';
import DashboardActivityCard from '../components/DashboardActivityCard';
import DashboardActivityDetails from '../components/DashboardActivityDetails';
import FastingCard from '../components/FastingCard';
import FastingGoalReconciler from '../components/FastingGoalReconciler';
import Icon from '../components/Icon';
import MedicationsCard from '../components/MedicationsCard';
import ProgressPhotosCard from '../components/ProgressPhotosCard';
import SegmentedControl from '../components/SegmentedControl';
import StatusView from '../components/StatusView';
import { NUTRIENT_META, getNutrientLabel } from '../constants/nutrients';
import {
  fastingRootQueryKey,
  medicationsRootQueryKey,
  useCustomNutrients,
  useDailySummary,
  useMeasurements,
  useNutrientDisplayPreferences,
  usePreferences,
  useServerConnection,
  useWidgetSync,
} from '../hooks';
import { useCheckInPhotoDates } from '../hooks/useCheckInPhotos';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { formatDateLabel } from '../utils/dateUtils';
import {
  createNativeProfileAction,
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';
import { getNetCarbsValue } from '../utils/nutrientUtils';

type DashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const queryClient = useQueryClient();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const setSelectedDate = useDiaryDateStore((s) => s.setSelectedDate);
  const goToPreviousDay = useDiaryDateStore((s) => s.goToPreviousDay);
  const goToNextDay = useDiaryDateStore((s) => s.goToNextDay);
  const goToToday = useDiaryDateStore((s) => s.goToToday);
  const syncTodayRollover = useDiaryDateStore((s) => s.syncTodayRollover);
  const scrollViewRef = useRef<ScrollView>(null);
  const calendarRef = useRef<CalendarSheetRef>(null);

  // Only reset to today when the calendar day has actually changed (midnight rollover)
  useFocusEffect(
    useCallback(() => {
      syncTodayRollover();
    }, [syncTodayRollover])
  );

  // Re-tapping the active Dashboard tab acts as a quick return to
  // today's summary and the top of the screen.
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        goToToday();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation, goToToday]);
  // The photo-day markers are fetched on first calendar open rather than at
  // mount: a user who never opens the picker should not pay a request for it.
  const [calendarOpened, setCalendarOpened] = useState(false);
  const { dates: photoDates } = useCheckInPhotoDates(calendarOpened);
  const openCalendar = useCallback(() => {
    setCalendarOpened(true);
    calendarRef.current?.present();
  }, []);
  const handleCalendarSelect = useCallback(
    (date: string) => setSelectedDate(date),
    [setSelectedDate]
  );
  const usesNativeTabs = useNativeIOSTabsActive();
  const insets = useSafeAreaInsets();
  const { defaultColor: nativeHeaderActionColor } = useHeaderActionColors();
  const syncNativeHeaderDatePicker = useCallback(() => {
    if (!usesNativeTabs) return;

    setNativeHeaderDatePickerOptions(
      navigation as unknown as NativeHeaderDatePickerNavigation,
      {
        selectedDate,
        onDatePress: openCalendar,
        tintColor: nativeHeaderActionColor,
        accessibilityLabel: t('dashboard.chooseDate', {
          defaultValue: 'Choose dashboard date',
        }),
        dateLabel: `${formatDateLabel(selectedDate, t, dateLocale)} ▾`,
        t,
        locale: dateLocale,
        trailingActions: [
          createNativeProfileAction(
            () => navigation.navigate('Profile'),
            t('profile.title', { defaultValue: 'Profile' })
          ),
        ],
      }
    );
  }, [
    nativeHeaderActionColor,
    navigation,
    openCalendar,
    selectedDate,
    usesNativeTabs,
    t,
    dateLocale,
  ]);

  // The header lost its previous/next chevrons, so the day moves by flinging
  // the content sideways — the same gesture the Diary already uses.
  const swipeGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .onEnd(goToPreviousDay)
          .runOnJS(true),
        Gesture.Fling()
          .direction(Directions.LEFT)
          .onEnd(goToNextDay)
          .runOnJS(true)
      ),
    [goToPreviousDay, goToNextDay]
  );

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { summary, isLoading, isError, refetch } = useDailySummary({
    date: selectedDate,
    enabled: isConnected,
  });
  const {
    preferences,
    isLoading: isPreferencesLoading,
    isError: isPreferencesError,
    refetch: refetchPreferences,
  } = usePreferences({
    enabled: isConnected,
  });
  const {
    measurements,
    isLoading: isMeasurementsLoading,
    isError: isMeasurementsError,
    refetch: refetchMeasurements,
  } = useMeasurements({
    date: selectedDate,
    enabled: isConnected,
  });

  const { customNutrients, refetch: refetchCustomNutrients } =
    useCustomNutrients({ enabled: isConnected });
  const { summaryNutrients, refetch: refetchNutrientPrefs } =
    useNutrientDisplayPreferences({ enabled: isConnected });

  useWidgetSync(summary);

  // CSS variable macro colors are theme-aware (lower saturation than hardcoded hex)
  const [proteinColor, carbsColor, fatColor, fiberColor, caloriesColor] =
    useCSSVariable([
      '--color-macro-protein',
      '--color-macro-carbs',
      '--color-macro-fat',
      '--color-macro-fiber',
      '--color-calories',
    ]) as [string, string, string, string, string];

  const accentColor = useCSSVariable('--color-accent-primary') as string;

  const savedDashboardMode = useAppPreferencesStore((s) => s.dashboardMode);
  const dashboardMode =
    savedDashboardMode === 'trends' ? 'activity' : savedDashboardMode;
  const setDashboardMode = useAppPreferencesStore((s) => s.setDashboardMode);
  const [refreshing, setRefreshing] = useState(false);
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const fastingCardVisible = useAppPreferencesStore(
    (s) => s.fastingCardVisible
  );
  const cycleCardVisible = useAppPreferencesStore((s) => s.cycleCardVisible);
  const askSparkyVisible = useAppPreferencesStore((s) => s.askSparkyVisible);
  const medicationsCardVisible = useAppPreferencesStore(
    (s) => s.medicationsCardVisible
  );
  const progressPhotosCardVisible = useAppPreferencesStore(
    (s) => s.progressPhotosCardVisible
  );

  useLayoutEffect(() => {
    syncNativeHeaderDatePicker();
  }, [syncNativeHeaderDatePicker]);

  useFocusEffect(
    useCallback(() => {
      syncNativeHeaderDatePicker();
    }, [syncNativeHeaderDatePicker])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchPreferences(),
      refetchMeasurements(),
      refetchCustomNutrients(),
      refetchNutrientPrefs(),
      // FastingCard owns its own queries; nudge them on pull-to-refresh.
      queryClient.invalidateQueries({ queryKey: fastingRootQueryKey }),
      // MedicationsCard owns its own queries.
      queryClient.invalidateQueries({ queryKey: medicationsRootQueryKey }),
    ]);
    setRefreshing(false);
  }, [
    refetch,
    refetchPreferences,
    refetchMeasurements,
    refetchCustomNutrients,
    refetchNutrientPrefs,
    queryClient,
  ]);

  // Render content based on state
  const renderContent = () => {
    // No server configured
    if (!isConnectionLoading && !isConnected) {
      return (
        <View className="flex-1">
          {!usesNativeTabs && (
            <View className="px-4 pb-5" style={{ paddingTop: insets.top + 16 }}>
              <Text className="text-2xl font-bold text-text-primary">
                {t('navigation.dashboard', { defaultValue: 'Dashboard' })}
              </Text>
            </View>
          )}
          <StatusView
            icon="cloud-offline"
            iconTone="muted"
            iconSize={64}
            title={t('dashboard.noServerConfigured', {
              defaultValue: 'No server configured',
            })}
            subtitle={t('dashboard.configureServer', {
              defaultValue:
                'Configure your server connection in Settings to view your daily summary.',
            })}
            action={{
              label: t('dashboard.goToSettings', {
                defaultValue: 'Go to Settings',
              }),
              onPress: () => navigation.navigate('Profile'),
              variant: 'primary',
            }}
          />
        </View>
      );
    }

    // Loading state
    if (
      isLoading ||
      isConnectionLoading ||
      isPreferencesLoading ||
      isMeasurementsLoading
    ) {
      return (
        <StatusView
          loading
          title={t('dashboard.loadingSummary', {
            defaultValue: 'Loading summary...',
          })}
        />
      );
    }

    // Error state
    if (isError || isPreferencesError || isMeasurementsError) {
      return (
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('dashboard.loadFailed', {
            defaultValue: 'Failed to load summary',
          })}
          subtitle={t('dashboard.checkConnection', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => refetch(),
            variant: 'primary',
          }}
        />
      );
    }

    // Data loaded successfully
    if (!summary || !preferences) {
      return null;
    }

    const { eaten, burned, remaining, goal } = summary.calorieBalance;
    const showNetCarbs = preferences.show_net_carbs === true;

    const CORE_MACROS = new Set(['protein', 'carbs', 'fat', 'dietary_fiber']);
    const customNutrientNames = new Set(customNutrients.map((cn) => cn.name));
    const dashboardNutrients = summaryNutrients.filter(
      (key) => CORE_MACROS.has(key) || customNutrientNames.has(key)
    );

    const nutrientMetrics = dashboardNutrients.map((nutrientKey) => {
      // Resolve display label and unit.
      const meta = NUTRIENT_META[nutrientKey];
      const customDef = !meta
        ? customNutrients.find((cn) => cn.name === nutrientKey)
        : undefined;
      const label = meta
        ? getNutrientLabel(t, nutrientKey)
        : (customDef?.name ?? nutrientKey);
      const unit = meta?.unit ?? customDef?.unit ?? 'g';

      // Use theme-aware CSS variable colors for the 4 core macros;
      // custom nutrients fall back to the app accent color.
      let color: string;
      if (nutrientKey === 'protein') color = proteinColor;
      else if (nutrientKey === 'carbs') color = carbsColor;
      else if (nutrientKey === 'fat') color = fatColor;
      else if (nutrientKey === 'dietary_fiber') color = fiberColor;
      else color = accentColor;

      // Resolve consumed value.
      let consumed: number;
      if (nutrientKey === 'carbs' && showNetCarbs) {
        consumed = getNetCarbsValue(
          summary.carbs.consumed,
          summary.fiber.consumed
        );
      } else if (nutrientKey === 'protein') {
        consumed = summary.protein.consumed;
      } else if (nutrientKey === 'carbs') {
        consumed = summary.carbs.consumed;
      } else if (nutrientKey === 'fat') {
        consumed = summary.fat.consumed;
      } else if (nutrientKey === 'dietary_fiber') {
        consumed = summary.fiber.consumed;
      } else {
        consumed = summary.customNutrientTotals[nutrientKey] ?? 0;
      }

      // Resolve goal. Core macros use their tracked goals; custom
      // nutrients use their per-nutrient goal when one is set. When a
      // custom nutrient has no goal, `goal` stays undefined and
      // Rings omit the goal denominator.
      let goal: number | undefined;
      if (nutrientKey === 'protein') goal = summary.protein.goal || undefined;
      else if (nutrientKey === 'carbs') goal = summary.carbs.goal || undefined;
      else if (nutrientKey === 'fat') goal = summary.fat.goal || undefined;
      else if (nutrientKey === 'dietary_fiber')
        goal = summary.fiber.goal || undefined;
      else goal = summary.customNutrientGoals[nutrientKey] || undefined;

      const displayLabel =
        nutrientKey === 'carbs' && showNetCarbs
          ? t('nutrients.netCarbs', {
              defaultValue: 'Net Carbs',
            })
          : label;

      return {
        key: nutrientKey,
        label: displayLabel,
        consumed,
        goal,
        color,
        unit,
      };
    });

    return (
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 16 + activeWorkoutBarPadding,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor || '#3B82F6'}
          />
        }
      >
        <View className="mb-3">
          <SegmentedControl<'activity' | 'nutrients'>
            segments={[
              {
                key: 'activity',
                label: t('dashboard.activity', { defaultValue: 'Activity' }),
              },
              {
                key: 'nutrients',
                label: t('dashboard.nutrients', { defaultValue: 'Nutrients' }),
              },
            ]}
            activeKey={dashboardMode}
            onSelect={setDashboardMode}
          />
        </View>
        {dashboardMode === 'activity' ? (
          <DashboardActivityCard
            summary={summary}
            steps={measurements?.steps}
          />
        ) : (
          <>
            <DashboardNutrientCard
              metrics={[
                {
                  key: 'calories',
                  label: t('dashboard.consumed', { defaultValue: 'Consumed' }),
                  consumed: eaten,
                  goal,
                  progress: summary.calorieBalance.progress / 100,
                  color: caloriesColor,
                  unit: t('dashboard.activityKcal', { defaultValue: 'kcal' }),
                },
                ...nutrientMetrics,
              ]}
              remaining={remaining}
              burned={burned}
              onDetails={() =>
                navigation.navigate('DailyNutritionDetails', {
                  date: summary.date,
                })
              }
            />
            {/* Tap-to-open launcher for the Sparky chat. Styled like an input to
            invite, but it pushes the full chat screen rather than capturing text
            here — the Dashboard's scroll + date-fling gestures make a live input
            on this screen more trouble than it's worth. The composer autofocuses
            on arrival so the affordance is honored immediately. Visibility is a
            local app setting toggled from Dashboard Settings. */}
            {!isLocalDataMode() && askSparkyVisible && (
              <Pressable
                onPress={() => navigation.navigate('Chat')}
                className="flex-row items-center bg-surface rounded-2xl px-4 py-3 mb-3"
              >
                <Icon name="sparkles" size={18} color={accentColor} />
                <Text className="text-text-muted text-base ml-3">
                  {t('dashboard.askSparky', { defaultValue: 'Ask Sparky…' })}
                </Text>
              </Pressable>
            )}

            {summary.foodEntries.length === 0 && (
              <Pressable
                className="bg-surface rounded-2xl p-4 mb-3"
                onPress={() =>
                  navigation.navigate('FoodSearch', { date: selectedDate })
                }
              >
                <Text className="text-md font-bold text-text-primary mb-4">
                  {t('dashboard.food', { defaultValue: 'Food' })}
                </Text>
                <Text className="text-text-muted text-sm text-center mb-4">
                  {t('dashboard.tapToAddFood', {
                    defaultValue: 'Tap to add food',
                  })}
                </Text>
              </Pressable>
            )}
          </>
        )}

        <DashboardActivityDetails
          summary={summary}
          steps={measurements?.steps}
          distanceUnit={preferences.default_distance_unit ?? 'km'}
          standGoal={summary.goals.stand_hours}
        />

        {/* Goal-notification reconciliation is owned here (headless, always
            mounted) so it survives the card being hidden. Fasting is "now"-based,
            so the card is deliberately date-independent — it always reflects the
            current/active fast regardless of the date navigator. Do not wire it
            to `selectedDate`. Visibility is a local app setting toggled from
            Dashboard Settings. */}
        {!isLocalDataMode() && <FastingGoalReconciler />}
        {!isLocalDataMode() && fastingCardVisible && (
          <FastingCard navigation={navigation} />
        )}
        {!isLocalDataMode() && cycleCardVisible && (
          <CycleCard navigation={navigation} />
        )}

        {!isLocalDataMode() && medicationsCardVisible && (
          <MedicationsCard navigation={navigation} />
        )}

        {!isLocalDataMode() && progressPhotosCardVisible && (
          <ProgressPhotosCard navigation={navigation} date={selectedDate} />
        )}
      </ScrollView>
    );
  };

  const renderedContent = renderContent();

  if (usesNativeTabs) {
    return (
      <>
        <GestureDetector gesture={swipeGesture}>
          <View collapsable={false} className="flex-1">
            {renderedContent}
          </View>
        </GestureDetector>
        <CalendarSheet
          ref={calendarRef}
          selectedDate={selectedDate}
          onSelectDate={handleCalendarSelect}
          markedDates={photoDates}
        />
      </>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {!isConnectionLoading && isConnected ? (
        <TabHeader
          title={t('navigation.dashboard', { defaultValue: 'Dashboard' })}
          selectedDate={selectedDate}
          onDatePress={openCalendar}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      ) : null}
      <GestureDetector gesture={swipeGesture}>
        <View collapsable={false} className="flex-1">
          {renderedContent}
        </View>
      </GestureDetector>
      <CalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        markedDates={photoDates}
      />
    </View>
  );
};

export default DashboardScreen;
