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
import LiquidGlassSurface from '../components/LiquidGlassSurface';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useExerciseHistory } from '../hooks/useExerciseHistory';
import { usePreferences } from '../hooks/usePreferences';
import { useServerConnection } from '../hooks/useServerConnection';
import { getWorkoutSummary } from '../utils/workoutSession';
import { getAppLocale } from '../localization';
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
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
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

  useScreenHeader({
    title: t('activityHistory.title', { defaultValue: 'Activities' }),
    nativeTitle: t('activityHistory.title', { defaultValue: 'Activities' }),
    left: { kind: 'back' },
  });

  // Chips are derived from what the history actually holds, so the row never
  // offers a filter that would come back empty.
  const filters = useMemo(() => {
    const names = new Map<string, string>();
    for (const session of sessions) {
      const { name } = getWorkoutSummary(session, t);
      const key = name.trim().toLowerCase();
      if (key && !names.has(key)) names.set(key, name.trim());
    }
    return [...names.entries()].map(([value, label]) => ({ value, label }));
  }, [sessions, t]);

  const visible = useMemo(
    () =>
      filter === ALL
        ? sessions
        : sessions.filter(
            (session) =>
              getWorkoutSummary(session, t).name.trim().toLowerCase() === filter
          ),
    [sessions, filter, t]
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
    if (session.type === 'preset') navigation.navigate('WorkoutDetail', { session });
    else navigation.navigate('ActivityDetail', { session });
  };

  return (
    <View className="flex-1 bg-background">
      {/* Horizontal chips rather than a SegmentedControl: the set is open —
          one per activity the user has logged — and a segmented control with a
          dozen segments is unreadable and untappable.

          Liquid Glass, exactly as the Store's category pills: selection is a
          tint ON the material rather than a solid fill swapped in behind it, so
          a chosen chip is still the same piece of glass as the ones beside it.
          Off iOS 26 the tint becomes that flat fill. */}
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(session, index) => session.id || String(index)}
          contentContainerStyle={{
            paddingHorizontal: 16,
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
              onPress={() => openSession(item)}
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
