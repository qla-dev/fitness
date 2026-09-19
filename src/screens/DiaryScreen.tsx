import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { hasSupplementNutrition } from '@workspace/shared';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import RingCalendarSheet, {
  type RingCalendarSheetRef,
} from '../components/RingCalendarSheet';
import CheckInPhotosSummary from '../components/CheckInPhotosSummary';
import TabHeader from '../components/TabHeader';
import DiaryCalorieMacroSummary from '../components/DiaryCalorieMacroSummary';
import DiaryNutritionCard from '../components/DiaryNutritionCard';
import FoodSummary from '../components/FoodSummary';
import MeasurementsSummary from '../components/MeasurementsSummary';
import { emptyDailySummary } from '../services/dailySummaryService';
import SectionIntro from '../components/SectionIntro';
import { useMeasurementHistory } from '../hooks/useMeasurementHistory';
import ServingAdjustSheet, {
  type ServingAdjustSheetRef,
} from '../components/ServingAdjustSheet';
import { NapsCard, SleepTile } from '../components/SleepCards';
import WaterTile from '../components/WaterTile';
import WaterRecordSheet from '../components/WaterRecordSheet';
import StatusView from '../components/StatusView';
import {
  useCustomNutrients,
  useDailySummary,
  useFamilyUsers,
  useMealTypes,
  useNutrientDisplayPreferences,
  useServerConnection,
} from '../hooks';
import {
  useCheckInPhotoDates,
  useCheckInPhotosByDate,
} from '../hooks/useCheckInPhotos';
import { useCustomMeasurementsByDate } from '../hooks/useCustomMeasurements';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useMeasurements } from '../hooks/useMeasurements';
import { usePreferences } from '../hooks/usePreferences';
import { useSleepDay } from '../hooks/useSleepDay';
import { useSleepComparison } from '../hooks/useSleepComparison';
import { CARD_GAP, SCREEN_GUTTER } from '../constants/layout';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import type { FoodEntry } from '../types/foodEntries';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { isManualSource } from '../utils/customMeasurementsForm';
import { formatDateLabel } from '../utils/dateUtils';
import {
  getHistoricalMealTypeLabel,
  getMealTypeDisplayLabel,
} from '../utils/mealNutrition';
import {
  createNativeCartAction,
  createNativeProfileAction,
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';

type DiaryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Diary'>,
  NativeStackScreenProps<RootStackParamList>
>;
const DiaryScreen: React.FC<DiaryScreenProps> = ({ navigation }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const insets = useSafeAreaInsets();
  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { data: familyUsers = [] } = useFamilyUsers({ enabled: isConnected });
  const hasFamilyDiaries = isConnected && familyUsers.length > 0;
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const setSelectedDate = useDiaryDateStore((s) => s.setSelectedDate);
  const goToPreviousDay = useDiaryDateStore((s) => s.goToPreviousDay);
  const goToNextDay = useDiaryDateStore((s) => s.goToNextDay);
  const goToToday = useDiaryDateStore((s) => s.goToToday);
  const syncTodayRollover = useDiaryDateStore((s) => s.syncTodayRollover);
  const scrollViewRef = useRef<ScrollView>(null);
  const calendarRef = useRef<RingCalendarSheetRef>(null);
  const servingSheetRef = useRef<ServingAdjustSheetRef>(null);

  useFocusEffect(
    useCallback(() => {
      syncTodayRollover();
    }, [syncTodayRollover])
  );

  // Re-tapping the active Diary tab acts as a quick return to today's
  // entries and the top of the screen.
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        goToToday();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation, goToToday]);

  useEffect(() => {
    navigation.setParams({ selectedDate });
  }, [navigation, selectedDate]);

  // The photo-day markers are fetched on first calendar open rather than at
  // mount: a user who never opens the picker should not pay a request for it.
  const [calendarOpened, setCalendarOpened] = useState(false);
  // Held here rather than inside MeasurementsSummary: the button that opens the
  // full measurement list now sits in this screen's own header row.
  const [measurementsMoreOpen, setMeasurementsMoreOpen] = useState(false);
  // Mounted only while open, the way the record sheets are: the tile renders on
  // every diary day and a sheet mounted with it would build its modal and
  // backdrop for a tap most days never get.
  const [waterOpen, setWaterOpen] = useState(false);
  const { dates: photoDates } = useCheckInPhotoDates(calendarOpened);
  // Owned here rather than inside CheckInPhotosSummary: the empty-day predicate
  // below needs the same answer, and one subscription keeps refetch-on-focus
  // from firing twice for one query.
  const { photos: dayPhotos } = useCheckInPhotosByDate(selectedDate);
  const openCalendar = useCallback(() => {
    setCalendarOpened(true);
    calendarRef.current?.present();
  }, []);
  const openFamilyDiaries = useCallback(
    () => navigation.navigate('FamilyMembers'),
    [navigation]
  );
  const familyDiariesAccessibilityLabel = t('familyDiary.openFamilyDiaries', {
    defaultValue: 'Open family diaries',
  });
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const usesNativeTabs = useNativeIOSTabsActive();
  const { defaultColor: nativeHeaderActionColor } = useHeaderActionColors();

  const syncNativeHeaderDatePicker = useCallback(() => {
    if (!usesNativeTabs) return;

    setNativeHeaderDatePickerOptions(
      navigation as unknown as NativeHeaderDatePickerNavigation,
      {
        selectedDate,
        onDatePress: openCalendar,
        tintColor: nativeHeaderActionColor,
        accessibilityLabel: t('diary.chooseDate', {
          defaultValue: 'Choose diary date',
        }),
        dateLabel: `${formatDateLabel(selectedDate, t, dateLocale)} ▾`,
        t,
        locale: dateLocale,
        // Family diaries first, then the cart, then the profile button, so
        // profile stays in the corner position it occupies on every other tab.
        trailingActions: [
          ...(hasFamilyDiaries
            ? [
                {
                  sfSymbol: 'person.2.fill',
                  onPress: openFamilyDiaries,
                  accessibilityLabel: familyDiariesAccessibilityLabel,
                  identifier: 'family-diaries',
                },
              ]
            : []),
          createNativeCartAction(
            () => navigation.navigate('Cart'),
            t('cart.title', { defaultValue: 'Meals' })
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
    openFamilyDiaries,
    openCalendar,
    selectedDate,
    familyDiariesAccessibilityLabel,
    hasFamilyDiaries,
    usesNativeTabs,
    t,
    dateLocale,
  ]);

  useLayoutEffect(() => {
    syncNativeHeaderDatePicker();
  }, [syncNativeHeaderDatePicker]);

  useFocusEffect(
    useCallback(() => {
      syncNativeHeaderDatePicker();
    }, [syncNativeHeaderDatePicker])
  );

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

  const handleCalendarSelect = useCallback(
    (date: string) => setSelectedDate(date),
    [setSelectedDate]
  );
  const { mealTypes } = useMealTypes();
  const openMealTypeDetail = useCallback(
    (mealTypeId: string | null, mealTypeName: string, entries: FoodEntry[]) => {
      // Resolve the label from the canonical definition (ownership-aware); for
      // a deleted/hidden type fall back to the literal historical name.
      const definition = mealTypes.find((mt) => mt.id === mealTypeId) ?? null;
      const mealLabel = definition
        ? getMealTypeDisplayLabel(definition, t)
        : getHistoricalMealTypeLabel(mealTypeName, t);
      navigation.navigate('MealTypeDetail', {
        date: selectedDate,
        mealTypeId: mealTypeId ?? undefined,
        mealType: mealTypeName,
        mealLabel,
      });
    },
    [navigation, selectedDate, mealTypes, t]
  );

  const { preferences } = usePreferences();
  const weightMode = preferences?.default_weight_unit ?? 'kg';
  const bodyUnit: 'cm' | 'inches' =
    preferences?.default_measurement_unit === 'inches' ? 'inches' : 'cm';
  const heightMode = preferences?.default_measurement_unit ?? 'cm';

  const {
    summary: loadedSummary,
    isLoading,
    isError,
    refetch,
  } = useDailySummary({
    date: selectedDate,
    enabled: isConnected,
  });

  // The chrome is identical whether or not the day has landed — same cards,
  // same icons, same ring track — so an empty day stands in and only the
  // numbers wait. Holding the whole screen behind "Loading diary..." meant
  // every open rebuilt it from nothing, which is what Activities stopped
  // doing and why it opens instantly.
  const summary = loadedSummary ?? emptyDailySummary(selectedDate);
  const { measurements, refetch: refetchMeasurements } = useMeasurements({
    date: selectedDate,
    enabled: isConnected,
  });

  // One range read behind the tiles: what each measurement was the day before,
  // and the last value recorded for it, so a tile shows a real number on a day
  // nothing was logged instead of a dash.
  const { history: measurementHistory } = useMeasurementHistory(
    selectedDate,
    isConnected
  );
  const { data: customMeasurements, refetch: refetchCustomMeasurements } =
    useCustomMeasurementsByDate(selectedDate, { enabled: isConnected });
  const { customNutrients, refetch: refetchCustomNutrients } =
    useCustomNutrients({ enabled: isConnected });
  const { preferences: nutrientPrefs, refetch: refetchNutrientPrefs } =
    useNutrientDisplayPreferences({ enabled: isConnected });

  const {
    wakeUp,
    naps,
    bedTime,
    refetch: refetchSleep,
  } = useSleepDay(selectedDate, { enabled: isConnected });
  // The night the wake tile measures itself against — the most recent one
  // before this day, which is not always yesterday.
  const { previousSleep } = useSleepComparison(selectedDate, isConnected);

  const diaryNutrientRow = nutrientPrefs.find(
    (p) => p.view_group === 'diary' && p.platform === 'mobile'
  );
  const customNutrientKeys = (diaryNutrientRow?.visible_nutrients ?? []).slice(
    0,
    4
  );
  // Manual-only custom entries for the Diary tiles: health-synced entries are
  // filtered here (before presentation) so MeasurementsSummary never receives
  // them; the component itself re-filters defensively too.
  const manualCustomMeasurements = useMemo(
    () => (customMeasurements ?? []).filter((e) => isManualSource(e.source)),
    [customMeasurements]
  );

  const [refreshing, setRefreshing] = useState(false);
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const onRefresh = useCallback(async () => {
    if (!isConnected) return;
    setRefreshing(true);
    // Error-isolated refresh: one failing query must not prevent the others
    // from completing nor produce an unhandled rejection. The spinner is torn
    // down in `finally` regardless of individual query outcomes.
    try {
      await Promise.allSettled([
        refetch(),
        refetchMeasurements(),
        refetchCustomMeasurements(),
        refetchCustomNutrients(),
        refetchNutrientPrefs(),
        refetchSleep(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    isConnected,
    refetch,
    refetchMeasurements,
    refetchCustomMeasurements,
    refetchCustomNutrients,
    refetchNutrientPrefs,
    refetchSleep,
  ]);

  const isRefreshing = refreshing;

  const renderContent = () => {
    if (!isConnectionLoading && !isConnected) {
      return (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('diary.noServer', { defaultValue: 'No server configured' })}
          subtitle={t('diary.configureServer', {
            defaultValue:
              'Configure your server connection in Settings to view your diary.',
          })}
          action={{
            label: t('diary.goToSettings', { defaultValue: 'Go to Settings' }),
            onPress: () => navigation.navigate('Profile'),
            variant: 'primary',
          }}
        />
      );
    }

    // Sleep is deliberately not part of this gate: the cards render nothing until their
    // entries arrive, so a slow `/api/sleep` fills them in late instead of holding the
    // food and exercise that already loaded behind "Loading diary...".

    if (isError) {
      return (
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('diary.loadFailed', {
            defaultValue: 'Failed to load diary',
          })}
          subtitle={t('diary.checkConnection', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('diary.retry', { defaultValue: 'Retry' }),
            onPress: () => refetch(),
            variant: 'primary',
          }}
        />
      );
    }

    if (!summary) {
      return null;
    }

    return (
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          // No padding above the subtitle: iOS already leaves room under its
          // large title, and adding to it pushed the line away from the name it
          // belongs to.
          paddingTop: 0,
          paddingBottom: SCREEN_GUTTER + activeWorkoutBarPadding,
          gap: CARD_GAP,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
          />
        }
      >
        {/* The line under the screen's name, the way Mail sets one under its
            own large title — and the row that finally gives More a home.

            A real row of content rather than anything positioned over the
            title: iOS draws its large title above this scroll view instead of
            inside it, so nothing can be laid out beside it, and a raised
            overlay would have had to be nudged into place by hand and would
            still have sat wrong at other text sizes. This just follows the
            title, on every header path, and scrolls with the content. */}
        {/* Each intro introduces the block under it, so this one belongs to
            the nutrition card rather than to the screen as a whole. The
            habits line moved down to sit over the measurement tiles it was
            always describing. */}
        <SectionIntro
          testID="diary-macros-intro"
          subtitle={t('diary.macrosSubtitle', {
            defaultValue: 'See all your macros in one place',
          })}
          actionLabel={t('measurements.more', { defaultValue: 'More' })}
          onPress={() => navigation.navigate('Macros')}
        />
        {/* Directly under the intro, above the body tiles: the day's calories
            and macros are the first thing this screen is asked for. Not gated
            on the Summary preference below it — that toggle hides a different
            card, and this one is the head of the screen. */}
        <DiaryNutritionCard
          summary={summary}
          showNetCarbs={preferences?.show_net_carbs === true}
          loading={isLoading}
        />
        {(summary.foodEntries.length > 0 ||
          hasSupplementNutrition(summary.supplementTotals) ||
          summary.exerciseEntries.length > 0 ||
          summary.calorieGoal > 0) && (
          <DiaryCalorieMacroSummary
            summary={summary}
            showNetCarbs={preferences?.show_net_carbs === true}
            customNutrientKeys={customNutrientKeys}
            customNutrients={customNutrients}
          />
        )}
        {/* The day always renders in full. It used to collapse to an
            illustration and one Add Food button once every query settled
            empty, which hid the per-meal cards — the very things that offer a
            place to log on an untouched day. */}
        {/* Above the meal cards: the day's body numbers are what the user
              comes to this screen to check, and the meal list is long enough
              to push them off the first screenful. The photos stay directly
              under them — both halves are one check-in, keyed on
              (user_id, entry_date). */}
        <SectionIntro
          testID="diary-intro"
          subtitle={t('diary.subtitle', {
            defaultValue: 'Keep a track of your habits',
          })}
          actionLabel={t('measurements.more', { defaultValue: 'More' })}
          onPress={() => setMeasurementsMoreOpen(true)}
        />
        <MeasurementsSummary
          measurements={measurements}
          history={measurementHistory}
          date={selectedDate}
          customMeasurements={manualCustomMeasurements}
          weightMode={weightMode}
          bodyUnit={bodyUnit}
          heightMode={heightMode}
          onPress={() =>
            navigation.navigate('MeasurementsAdd', { date: selectedDate })
          }
          moreOpen={measurementsMoreOpen}
          onMoreOpenChange={setMeasurementsMoreOpen}
          water={{
            consumedMl: summary.waterConsumed,
            goalMl: summary.waterGoal,
          }}
          onOpenWater={() => setWaterOpen(true)}
          // Water, then the night, in the same grid: both are things the body
          // did today, and as cards of their own they sat above and below
          // everything else on the screen.
          trailingTiles={[
            <WaterTile
              key="water"
              consumedMl={summary.waterConsumed}
              goalMl={summary.waterGoal}
              onPress={() => setWaterOpen(true)}
            />,
            <SleepTile
              key="wake"
              kind="wake"
              entry={wakeUp}
              day={selectedDate}
              navigation={navigation}
              previousSeconds={previousSleep?.seconds ?? null}
            />,
            <SleepTile
              key="bedtime"
              kind="bedtime"
              entry={bedTime}
              day={selectedDate}
              navigation={navigation}
            />,
          ]}
        />
        {/* Below the measurements: both are the same check-in, keyed on
              (user_id, entry_date) server-side. */}
        <CheckInPhotosSummary
          date={selectedDate}
          photos={dayPhotos}
          onPress={() =>
            navigation.navigate('ProgressPhotos', { date: selectedDate })
          }
        />
        {/* The third intro, over the meals. Its link opens the same list on a
            screen of its own, headed by the day rather than by a meal — the
            per-meal screen is what the three-dot menu already gives. */}
        <SectionIntro
          testID="diary-meals-intro"
          subtitle={t('diary.mealsSubtitle', {
            defaultValue: 'Log your every meal, fast',
          })}
          actionLabel={t('measurements.more', { defaultValue: 'More' })}
          onPress={() =>
            navigation.navigate('DayMeals', { date: selectedDate })
          }
        />
        <FoodSummary
          foodEntries={summary.foodEntries}
          mealTypes={mealTypes}
          goals={summary.goals}
          calorieGoal={summary.calorieGoal}
          onAddFood={() =>
            navigation.navigate('FoodSearch', { date: selectedDate })
          }
          onAdjustServing={(entry) => servingSheetRef.current?.present(entry)}
          onPressMealType={openMealTypeDetail}
          onLogFood={(mealTypeId) =>
            navigation.navigate('FoodSearch', {
              date: selectedDate,
              // A historical group has no live meal type to log into, so
              // the search opens on the day with no meal preselected.
              mealTypeId: mealTypeId ?? undefined,
            })
          }
        />
        <NapsCard naps={naps} day={selectedDate} navigation={navigation} />
      </ScrollView>
    );
  };

  const renderedContent = renderContent();

  const waterSheet = waterOpen ? (
    <WaterRecordSheet
      date={selectedDate}
      consumedMl={summary?.waterConsumed ?? 0}
      goalMl={summary?.waterGoal ?? 0}
      onClose={() => setWaterOpen(false)}
    />
  ) : null;

  if (usesNativeTabs) {
    return (
      <>
        <GestureDetector gesture={swipeGesture}>
          <View collapsable={false} className="flex-1">
            {renderedContent ?? <View className="flex-1 bg-background" />}
          </View>
        </GestureDetector>
        <RingCalendarSheet
          ref={calendarRef}
          selectedDate={selectedDate}
          onSelectDate={handleCalendarSelect}
          markedDates={photoDates}
        />
        <ServingAdjustSheet
          ref={servingSheetRef}
          onViewEntry={(entry) =>
            navigation.navigate('FoodEntryView', { entry })
          }
        />
        {waterSheet}
      </>
    );
  }

  const content = (
    <>
      {!isConnectionLoading && isConnected ? (
        <TabHeader
          title={t('diary.title', { defaultValue: 'Tracker' })}
          selectedDate={selectedDate}
          onDatePress={openCalendar}
          onProfilePress={() => navigation.navigate('Profile')}
          action={
            hasFamilyDiaries
              ? {
                  icon: 'people',
                  accessibilityLabel: familyDiariesAccessibilityLabel,
                  onPress: openFamilyDiaries,
                }
              : undefined
          }
        />
      ) : (
        !isConnectionLoading && (
          <View className="px-4 pb-5" style={{ paddingTop: insets.top + 16 }}>
            <Text className="text-2xl font-bold text-text-primary">
              {t('diary.title', { defaultValue: 'Tracker' })}
            </Text>
          </View>
        )
      )}
      {renderedContent}
      {waterSheet}
      <RingCalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        markedDates={photoDates}
      />
      <ServingAdjustSheet
        ref={servingSheetRef}
        onViewEntry={(entry) => navigation.navigate('FoodEntryView', { entry })}
      />
    </>
  );

  return (
    <>
      <GestureDetector gesture={swipeGesture}>
        <View className="flex-1 bg-background">{content}</View>
      </GestureDetector>
    </>
  );
};

export default DiaryScreen;
