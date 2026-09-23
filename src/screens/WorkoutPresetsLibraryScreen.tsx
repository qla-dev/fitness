import { useTranslation } from 'react-i18next';
import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import HapticRefreshControl from '../components/HapticRefreshControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import LibrarySearchBar from '../components/LibrarySearchBar';
import PaginatedLibraryFooter from '../components/PaginatedLibraryFooter';
import StatusView from '../components/StatusView';
import SafeImage from '../components/SafeImage';
import ProgramCountdown from '../components/ProgramCountdown';
import Icon from '../components/Icon';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import {
  useServerConnection,
  useWorkoutPresetsLibrary,
  useProfile,
} from '../hooks';
import {
  deriveShareStatus,
  filterByOwnership,
  ownershipFilterEmptyState,
  ownershipFilterHeaderMenu,
} from '../utils/shareStatus';
import ShareStatusBadge from '../components/ShareStatusBadge';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  HEADER_CONTENT_GAP,
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
import { useStartLiveWorkout } from '../hooks/useStartLiveWorkout';
import { buildPresetStartExercisesPayload } from '../utils/workoutSession';
import { fireSelectionHaptic } from '../services/haptics';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import type { WorkoutPreset } from '../types/workoutPresets';
import type { RootStackScreenProps } from '../types/navigation';

type WorkoutPresetsLibraryScreenProps =
  RootStackScreenProps<'WorkoutPresetsLibrary'>;

const WorkoutPresetsLibraryScreen: React.FC<
  WorkoutPresetsLibraryScreenProps
> = ({ navigation }) => {
  const { t } = useTranslation();
  const { getImageSource } = useExerciseImageSource();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const [accentColor, textSecondary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-secondary',
  ]) as [string, string];
  const scrollBottomPadding = insets.bottom + activeWorkoutBarPadding + 16;
  const [searchText, setSearchText] = useState('');
  const headerOffset = useNativeHeaderOffset();
  const [accessoryHeight, setAccessoryHeight] = useState(0);
  // Under a transparent bar and the search that floats with it; both measured,
  // so the list starts where the Store's does.
  const contentTopInset = usesNativeHeader
    ? headerOffset + accessoryHeight + HEADER_CONTENT_GAP
    : 0;
  const ownershipFilter = useAppPreferencesStore(
    (s) => s.workoutPresetsLibraryOwnershipFilter
  );
  const setOwnershipFilter = useAppPreferencesStore(
    (s) => s.setWorkoutPresetsLibraryOwnershipFilter
  );

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { profile } = useProfile();
  const {
    presets,
    isLoading,
    isSearching,
    isError,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    refetch,
  } = useWorkoutPresetsLibrary(searchText, { enabled: isConnected });
  const filteredPresets = useMemo(
    () => filterByOwnership(presets, ownershipFilter, profile?.id),
    [presets, ownershipFilter, profile?.id]
  );

  const { startLiveWorkout, isStarting } = useStartLiveWorkout(navigation);

  const handlePresetPress = useCallback(
    (preset: WorkoutPreset) => {
      navigation.navigate('WorkoutPresetDetail', { preset });
    },
    [navigation]
  );

  const renderEmpty = () => {
    if (
      ownershipFilter !== 'all' &&
      presets.length > 0 &&
      filteredPresets.length === 0
    ) {
      return (
        <StatusView
          inline
          {...ownershipFilterEmptyState({
            noun: t('presetLibrary.noun', { defaultValue: 'workout programs' }),
            filter: ownershipFilter,
            onReset: () => setOwnershipFilter('all'),
            labels: {
              all: t('ownership.all', { defaultValue: 'All' }),
              mine: t('ownership.mine', { defaultValue: 'Mine' }),
              family: t('ownership.family', { defaultValue: 'Family' }),
              public: t('ownership.public', { defaultValue: 'Public' }),
            },
            emptyTitle: t('ownership.emptyTitle', {
              defaultValue: 'No {{noun}} in {{filter}}',
            }),
            emptySubtitle: t('ownership.emptySubtitle', {
              defaultValue: 'Change the filter to see your other {{noun}}.',
            }),
            showAllLabel: t('ownership.showAll', { defaultValue: 'Show All' }),
          })}
        />
      );
    }
    return (
      <StatusView
        inline
        title={
          searchText.trim().length > 0
            ? t('presetLibrary.noMatch', {
                defaultValue: 'No matching programs found',
              })
            : t('presetLibrary.noItems', {
                defaultValue: 'No workout programs yet',
              })
        }
        subtitle={
          searchText.trim().length > 0
            ? t('presetLibrary.trySearch', {
                defaultValue:
                  'Try a different search term to find a workout program.',
              })
            : t('presetLibrary.empty', {
                defaultValue: 'Workout programs you create will appear here.',
              })
        }
      />
    );
  };

  const renderRow = ({ item }: { item: WorkoutPreset }) => {
    const image = item.exercises?.find((exercise) =>
      exercise.image_url?.trim()
    )?.image_url;
    const exerciseCount = item.exercises?.length ?? 0;
    const status = deriveShareStatus(item.user_id, item.is_public, profile?.id);
    return (
      <TouchableOpacity
        className="px-4 py-3 flex-row items-center gap-3"
        activeOpacity={0.7}
        onPress={() => handlePresetPress(item)}
      >
        <SafeImage
          source={image ? getImageSource(image) : null}
          style={{ width: 44, height: 44, borderRadius: 8 }}
          fallback={
            <View
              className="bg-raised items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 8 }}
            >
              <Icon name="exercise-weights" size={22} color={textSecondary} />
            </View>
          }
        />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-text-primary text-base font-medium flex-shrink"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <ShareStatusBadge status={status} />
          </View>
          <Text className="text-sm mt-0.5" style={{ color: textSecondary }}>
            {t('presetLibrary.exerciseCount', {
              defaultValue: '{{count}} exercises',
              defaultValue_one: '{{count}} exercise',
              defaultValue_other: '{{count}} exercises',
              count: exerciseCount,
            })}
          </Text>
        </View>
        <ProgramCountdown presetId={item.id} />
        {/* The store row's shape: the row opens the program, the button runs
            it. A program you already own has nothing left to buy, so the word
            is "Start now" rather than the store's "Start". */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('presetLibrary.startNow', {
            defaultValue: 'Start now',
          })}
          disabled={isStarting}
          onPress={() => {
            fireSelectionHaptic();
            void startLiveWorkout({
              name: item.name,
              exercises: buildPresetStartExercisesPayload(item),
              sourcePresetId: item.id,
            });
          }}
          className="px-3 py-2 rounded-full bg-raised"
          style={{ opacity: isStarting ? 0.5 : 1 }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: accentColor }}
          >
            {t('presetLibrary.startNow', { defaultValue: 'Start now' })}
          </Text>
        </Pressable>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (!isConnectionLoading && !isConnected) {
      return (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('presetLibrary.noServer', {
            defaultValue: 'No server configured',
          })}
          subtitle={t('workoutPresetLibrary.configure', {
            defaultValue:
              'Configure your server connection in Settings to view your workout programs.',
          })}
          action={{
            label: t('presetLibrary.go', { defaultValue: 'Go to Settings' }),
            onPress: () => navigation.navigate('Profile'),
            variant: 'primary',
          }}
        />
      );
    }

    if (isLoading || isConnectionLoading) {
      return (
        <StatusView
          loading
          title={t('presetLibrary.loading', {
            defaultValue: 'Loading workout programs...',
          })}
        />
      );
    }

    if (isError) {
      return (
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('presetLibrary.failed', {
            defaultValue: 'Failed to load workout programs',
          })}
          subtitle={t('presetLibrary.check', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('presetLibrary.retry', { defaultValue: 'Retry' }),
            onPress: () => {
              void refetch();
            },
            variant: 'primary',
          }}
        />
      );
    }

    return (
      <FlatList
        showsVerticalScrollIndicator={false}
        data={filteredPresets}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRow}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          <PaginatedLibraryFooter
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            errorMessage={t('presetLibrary.moreFailed', {
              defaultValue: 'Failed to load more programs.',
            })}
            onRetry={loadMore}
          />
        }
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <HapticRefreshControl
            refreshing={isSearching}
            onRefresh={refetch}
            tintColor={accentColor}
          />
        }
        contentContainerStyle={{
          paddingTop: contentTopInset,
          paddingBottom: scrollBottomPadding,
          flexGrow: 1,
        }}
      />
    );
  };

  const header = useScreenHeader({
    variant: 'transparent',
    accessory: isConnected ? (
      <LibrarySearchBar
        glass
        value={searchText}
        onChangeText={setSearchText}
        placeholder={t('presetLibrary.search', {
          defaultValue: 'Search workout programs...',
        })}
        isSearching={isSearching}
      />
    ) : null,
    onAccessoryHeight: setAccessoryHeight,
    title: t('profile.library.workout', { defaultValue: 'My Programs' }),
    left: { kind: 'back' },
    right: ownershipFilterHeaderMenu({
      noun: t('presetLibrary.noun', { defaultValue: 'workout programs' }),
      labels: {
        all: t('ownership.all', { defaultValue: 'All' }),
        mine: t('ownership.mine', { defaultValue: 'Mine' }),
        family: t('ownership.family', { defaultValue: 'Family' }),
        public: t('ownership.public', { defaultValue: 'Public' }),
      },
      showLabel: t('ownership.show', { defaultValue: 'Show' }),
      filterAccessibilityLabel: t('ownership.filter', {
        defaultValue: 'Filter {{noun}}, filtered to {{filter}}',
      }),
      identifier: 'workout-presets-library-filter',
      filter: ownershipFilter,
      onSelect: setOwnershipFilter,
    }),
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {renderContent()}
    </View>
  );
};

export default WorkoutPresetsLibraryScreen;
