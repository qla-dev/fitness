import { isLocalDataMode } from '../services/dataMode';
import SectionIntro from '../components/SectionIntro';
import { distanceFromKm } from '../utils/unitConversions';
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
import { addSheetRef } from '../components/AddSheet';
import RingCalendarSheet, {
  type RingCalendarSheetRef,
} from '../components/RingCalendarSheet';
import CycleCard from '../components/CycleCard';
import TabHeader from '../components/TabHeader';
import DashboardActivityCard from '../components/DashboardActivityCard';
import type { ActivityGoalKey } from '../constants/activityGoals';
import { emptyDailySummary } from '../services/dailySummaryService';
import DashboardActivityDetails from '../components/DashboardActivityDetails';
import CompactActivityCard from '../components/CompactActivityCard';
import FastingCard from '../components/FastingCard';
import FastingGoalReconciler from '../components/FastingGoalReconciler';
import Icon from '../components/Icon';
import MedicationsCard from '../components/MedicationsCard';
import ProgressPhotosCard from '../components/ProgressPhotosCard';
import StatusView from '../components/StatusView';
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
import { useOpenStartWorkout } from '../hooks/useOpenStartWorkout';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { formatDateLabel } from '../utils/dateUtils';
import { buildHourlyExerciseMinutes } from '../utils/hourlyActivity';
import {
  createNativeWorkoutsAction,
  createNativeProfileAction,
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';

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
  const calendarRef = useRef<RingCalendarSheetRef>(null);

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
  const startWorkout = useOpenStartWorkout(navigation);
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
        // Workouts first, then profile, so profile stays in the corner
        // position it occupies on every tab.
        trailingActions: [
          createNativeWorkoutsAction(
            startWorkout,
            t('presetSearch.title', { defaultValue: 'Start Workout' })
          ),
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
    startWorkout,
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
  const {
    summary: loadedSummary,
    isLoading,
    isError,
    refetch,
  } = useDailySummary({
    date: selectedDate,
    enabled: isConnected,
  });
  const {
    preferences,
    isError: isPreferencesError,
    refetch: refetchPreferences,
  } = usePreferences({
    enabled: isConnected,
  });
  const {
    measurements,
    isError: isMeasurementsError,
    refetch: refetchMeasurements,
  } = useMeasurements({
    date: selectedDate,
    enabled: isConnected,
  });

  // Units and exercise thumbnails for the logged-workout card at the foot of
  // the screen; the same values the Diary used to resolve for it.
  const distanceUnit =
    (preferences?.default_distance_unit as 'km' | 'miles') ?? 'km';
  // Every Activities card drills into the same screen, differing only in which
  // metric it opens and which day it opens it for.
  const openGoal = useCallback(
    (metric: ActivityGoalKey) =>
      navigation.navigate('GoalDetail', { metric, date: selectedDate }),
    [navigation, selectedDate]
  );
  // Health providers aggregate distance in metres; the card and the goal
  // screen both want it in the user's own unit.
  const dayDistance = useMemo(() => {
    const metres = measurements?.distance_m;
    if (metres == null || !Number.isFinite(Number(metres))) return undefined;
    return distanceFromKm(Number(metres) / 1000, distanceUnit);
  }, [measurements?.distance_m, distanceUnit]);
  // The Exercise chart's 24 bars, built from the day's logged sessions. Move
  // and Stand come off the summary instead: their breakdowns are read from the
  // health provider, not derived from anything the app holds.
  // The provider's own breakdown wins where it exists: it is the same figure
  // the ring shows, split by hour. The session-derived series stands in for a
  // day whose exercise was logged here rather than synced.
  const hourlyExercise = useMemo(
    () =>
      loadedSummary?.hourlyExercise ??
      buildHourlyExerciseMinutes(loadedSummary?.exerciseEntries),
    [loadedSummary?.hourlyExercise, loadedSummary?.exerciseEntries]
  );

  const { refetch: refetchCustomNutrients } = useCustomNutrients({
    enabled: isConnected,
  });
  const { refetch: refetchNutrientPrefs } = useNutrientDisplayPreferences({
    enabled: isConnected,
  });

  // Widgets only ever publish real numbers, never the placeholder day.
  useWidgetSync(loadedSummary);

  const accentColor = useCSSVariable('--color-accent-primary') as string;

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
                {t('navigation.dashboard', { defaultValue: 'Activities' })}
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

    // No skeleton: the card titles and ring tracks are identical either way,
    // so an empty day stands in until the real one lands and the values fill.
    const summary = loadedSummary ?? emptyDailySummary(selectedDate);

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
        {/* The same line the Tracker carries under its title, for the same
            reason: the screen name alone says what you are looking at but not
            what it is for. */}
        {/* No link: everything this line names is already on the screen
            under it, so a "More" would only lead back to what you can see. */}
        <SectionIntro
          className="mb-3"
          testID="dashboard-intro"
          subtitle={t('dashboard.subtitle', {
            defaultValue: 'Your rings, steps and workouts',
          })}
        />
        <DashboardActivityCard
          summary={summary}
          steps={measurements?.steps}
          loading={isLoading}
          onOpenGoal={openGoal}
        />

        {/* Tap-to-open launcher for the Sparky chat. Styled like an input to
            invite, but it pushes the full chat screen rather than capturing text
            here — the screen's scroll + date-fling gestures make a live input
            here more trouble than it is worth. The composer autofocuses on
            arrival so the affordance is honored immediately. Visibility is a
            local app setting toggled from Activities Settings. */}
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

        <DashboardActivityDetails
          summary={summary}
          steps={measurements?.steps}
          distance={dayDistance}
          standHours={measurements?.stand_hours}
          hourlyExercise={hourlyExercise}
          hourlyMove={summary.hourlyMove}
          totalCaloriesBurned={summary.totalCaloriesBurned}
          hourlyStand={summary.hourlyStand}
          distanceUnit={distanceUnit}
          standGoal={summary.goals.stand_hours}
          stepsGoal={summary.goals.steps}
          onOpenGoal={openGoal}
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

        {/* The day's logged workouts and activities, last on the screen.
            This is the same card the Diary used to carry, with the same
            rows, swipe-to-delete and tap targets — exercise is an activity,
            so it is logged here rather than on the Nutrition tab. */}
        <CompactActivityCard
          sessions={summary.exerciseEntries}
          entryDate={selectedDate}
          distanceUnit={distanceUnit}
          onAddExercise={() =>
            addSheetRef.current?.present({ initialMenu: 'exercise' })
          }
          onPressMore={() => navigation.navigate('ActivityHistory')}
          onPressSession={(session) => {
            if (session.type === 'preset') {
              // The live workout's surface is the active screen; detail is
              // for reviewing past or planned sessions.
              if (useActiveWorkoutStore.getState().sessionId === session.id) {
                navigation.navigate('ActiveWorkout');
                return;
              }
              navigation.navigate('WorkoutDetail', { session });
            } else {
              navigation.navigate('ActivityDetail', { session });
            }
          }}
        />
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
        <RingCalendarSheet
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
          title={t('navigation.dashboard', { defaultValue: 'Activities' })}
          selectedDate={selectedDate}
          onDatePress={openCalendar}
          onWorkoutsPress={startWorkout}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      ) : null}
      <GestureDetector gesture={swipeGesture}>
        <View collapsable={false} className="flex-1">
          {renderedContent}
        </View>
      </GestureDetector>
      <RingCalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        markedDates={photoDates}
      />
    </View>
  );
};

export default DashboardScreen;
