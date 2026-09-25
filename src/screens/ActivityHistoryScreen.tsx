import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import type { ExerciseSessionResponse } from '@workspace/shared';
import CompactActivityRow from '../components/CompactActivityRow';
import LiquidGlassSurface, {
  useGlassChipFill,
} from '../components/LiquidGlassSurface';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
import { useExerciseHistory } from '../hooks/useExerciseHistory';
import { usePreferences } from '../hooks/usePreferences';
import { useServerConnection } from '../hooks/useServerConnection';
import {
  getWorkoutSummary,
  isProviderDayTotal,
} from '../utils/workoutSession';
import { getAppLocale } from '../localization';
import { getTodayDate } from '../utils/dateUtils';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackScreenProps } from '../types/navigation';

/** Every session the filter chips can stand for, plus the always-present All. */
const ALL = '__all__';

/** Pill height, matching the Store's category chips. */
const CHIP_HEIGHT = 40;

/**
 * Month heading for a section, in the app's locale.
 *
 * Built from the day string's own parts rather than `new Date(day)`, which
 * parses a bare YYYY-MM-DD as UTC and so names the previous month for anyone
 * east of Greenwich on the first of the month.
 */
const monthLabel = (day: string): string => {
  const [y, m] = day.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(getAppLocale(), {
    month: 'long',
    year: 'numeric',
  });
};

/**
 * The whole logged-activity history: every session, newest first, grouped by
 * the month it belongs to and filterable by what kind of activity it was.
 *
 * Reached from the Home section's "More". Every card carries its own date in
 * both places; what this screen adds is the month HEADINGS, which only earn
 * their space once the list spans more than the one day Home shows.
 */
export default function ActivityHistoryScreen({
  navigation,
}: RootStackScreenProps<'ActivityHistory'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const [accessoryHeight, setAccessoryHeight] = useState(0);
  // Under a transparent bar and the chip row that floats with it; both are
  // measured, so no height is written down here.
  const contentTopInset = usesNativeHeader ? headerOffset + accessoryHeight : 0;
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const chipFill = useGlassChipFill();
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const distanceUnit =
    (preferences?.default_distance_unit as 'km' | 'miles') ?? 'km';

  // Refetches on focus like every other list, so logging an activity and
  // coming back shows it. That is only affordable because the history endpoint
  // now parses one page rather than the whole table per request.
  const { sessions, isLoading, isLoadingMore, loadMore, hasMore } =
    useExerciseHistory();
  const [filter, setFilter] = useState<string>(ALL);

  // This screen answers "what did I do", so the health importer's per-day
  // totals are dropped before anything reads the list: they are Apple's rings
  // filed as exercise entries, and shown here they read as a workout logged
  // under a provider's metric name — an "Apple Exercise Time" row sitting
  // between two runs, with a workout's icon and a workout's detail screen.
  // Their figures still reach the day through the dashboard and the exercise
  // stats, which read them deliberately.
  //
  // Dropped after paging rather than in the query: the history endpoint has no
  // notion of them, and at most a couple exist per synced day, so no page ever
  // thins out enough to matter.
  const logged = useMemo(
    () => sessions.filter((session) => !isProviderDayTotal(session)),
    [sessions]
  );

  // Chips are derived from what the history actually holds, so the row never
  // offers a filter that would come back empty.
  const filters = useMemo(() => {
    const names = new Map<string, string>();
    for (const session of logged) {
      const { name } = getWorkoutSummary(session, t);
      const key = name.trim().toLowerCase();
      if (key && !names.has(key)) names.set(key, name.trim());
    }
    return [...names.entries()].map(([value, label]) => ({ value, label }));
  }, [logged, t]);

  // Manual logging lives where the log itself lives: the two entry points
  // the add sheet used to hold — an activity (duration & distance) and a
  // workout typed up after the fact — are this screen's header buttons now.
  // Neither passes skipDraftLoad, so an unfinished draft is picked back
  // up rather than silently replaced.
  const header = useScreenHeader({
    variant: 'transparent',
    // Horizontal chips rather than a SegmentedControl: the set is open — one
    // per activity the user has logged — and a segmented control with a dozen
    // segments is unreadable and untappable.
    //
    // Liquid Glass, exactly as the Store's category pills: selection is a tint
    // ON the material rather than a solid fill swapped in behind it, so a
    // chosen chip is still the same piece of glass as the ones beside it. Off
    // iOS 26 the tint becomes that flat fill.
    accessory: (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="pt-1 pb-3"
      >
        {[{ value: ALL, label: t('common.all', { defaultValue: 'All' }) }]
          .concat(filters)
          .map((chip) => {
            const selected = chip.value === filter;
            return (
              <LiquidGlassSurface
                key={chip.value}
                isInteractive
                tintColor={selected ? accentPrimary : undefined}
                style={{
                  height: CHIP_HEIGHT,
                  borderRadius: CHIP_HEIGHT / 2,
                  overflow: 'hidden',
                  ...chipFill(selected),
                }}
              >
                <Pressable
                  onPress={() => {
                    fireSelectionHaptic();
                    setFilter(chip.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="h-full px-4 items-center justify-center"
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? 'text-accent-text' : 'text-text-primary'
                    }`}
                    numberOfLines={1}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              </LiquidGlassSurface>
            );
          })}
      </ScrollView>
    ),
    onAccessoryHeight: setAccessoryHeight,
    title: t('activityHistory.title', { defaultValue: 'Activities' }),
    nativeTitle: t('activityHistory.title', { defaultValue: 'Activities' }),
    left: { kind: 'back' },
    right: [
      {
        kind: 'icon',
        sfSymbol: 'figure.strengthtraining.traditional',
        ionicon: 'barbell-outline',
        accessibilityLabel: t('activityHistory.logWorkout', {
          defaultValue: 'Log workout',
        }),
        identifier: 'activity-history-log-workout',
        onPress: () =>
          navigation.navigate('WorkoutAdd', { date: getTodayDate() }),
        separated: true,
      },
      {
        kind: 'icon',
        sfSymbol: 'square.and.pencil',
        ionicon: 'create-outline',
        accessibilityLabel: t('activityHistory.logActivity', {
          defaultValue: 'Log activity',
        }),
        identifier: 'activity-history-log-activity',
        onPress: () =>
          navigation.navigate('ActivityAdd', { date: getTodayDate() }),
        // Own glass capsule each, or iOS 26 merges the pair into one control.
        separated: true,
      },
    ],
  });

  const visible = useMemo(
    () =>
      filter === ALL
        ? logged
        : logged.filter(
            (session) =>
              getWorkoutSummary(session, t).name.trim().toLowerCase() === filter
          ),
    [logged, filter, t]
  );

  // Grouped by month, preserving the newest-first order the history arrives in
  // rather than re-sorting — the server decides what "recent" means.
  const sections = useMemo(() => {
    const byMonth = new Map<string, ExerciseSessionResponse[]>();
    for (const session of visible) {
      const day = session.entry_date;
      if (!day) continue;
      const key = day.slice(0, 7);
      const bucket = byMonth.get(key);
      if (bucket) bucket.push(session);
      else byMonth.set(key, [session]);
    }
    return [...byMonth.entries()].map(([key, data]) => ({
      key,
      title: monthLabel(`${key}-01`),
      data,
    }));
  }, [visible]);

  // Split rather than a computed route name: the two routes take different
  // session shapes, and the discriminated union only narrows inside the branch.
  const openSession = (session: ExerciseSessionResponse) => {
    if (session.type === 'preset')
      navigation.navigate('WorkoutDetail', { session });
    else navigation.navigate('ActivityDetail', { session });
  };

  return (
    // The status-bar inset belongs above the bar on the screen-owned header
    // path, where the bar is the first thing on screen rather than something
    // the system laid out for us.
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          showsVerticalScrollIndicator={false}
          sections={sections}
          keyExtractor={(session, index) => session.id || String(index)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: contentTopInset,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
          stickySectionHeadersEnabled={false}
          // Guarded against re-entry: a SectionList whose content is shorter
          // than the viewport fires onEndReached immediately and again after
          // each page lands, which would walk the entire history on open.
          onEndReached={() => {
            if (hasMore && !isLoadingMore) loadMore();
          }}
          onEndReachedThreshold={0.2}
          renderSectionHeader={({ section }) => (
            <Text
              accessibilityRole="header"
              className="text-2xl font-bold text-text-primary mt-4 mb-2"
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <CompactActivityRow
              session={item}
              onPress={() => {
                fireSelectionHaptic();
                openSession(item);
              }}
              distanceUnit={distanceUnit}
            />
          )}
          ListEmptyComponent={
            <Text className="text-text-muted text-base text-center py-12">
              {t('activityHistory.empty', {
                defaultValue: 'No activities logged yet.',
              })}
            </Text>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View className="py-6">
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
