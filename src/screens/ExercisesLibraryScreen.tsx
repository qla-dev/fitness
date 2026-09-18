import { useTranslation } from 'react-i18next';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import LibrarySearchBar from '../components/LibrarySearchBar';
import PaginatedLibraryFooter from '../components/PaginatedLibraryFooter';
import StatusView from '../components/StatusView';
import ProgramStore from '../components/ProgramStore';
import ProgramPurchaseSheet from '../components/ProgramPurchaseSheet';
import type { ExerciseProgram } from '../types/exerciseProgram';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useExercisesLibrary, useServerConnection, useProfile } from '../hooks';
import { useExternalProviders } from '../hooks/useExternalProviders';
import { useExternalExerciseSearch } from '../hooks/useExternalExerciseSearch';
import { suggestedExercisesQueryKey } from '../hooks/queryKeys';
import { importExercise } from '../services/api/externalExerciseSearchApi';
import { getApiErrorMessage } from '../services/api/errors';
import type { ExternalExerciseItem } from '../types/externalExercises';
import {
  deriveShareStatus,
  filterByOwnership,
  ownershipFilterEmptyState,
  ownershipFilterHeaderMenu,
} from '../utils/shareStatus';
import ShareStatusBadge from '../components/ShareStatusBadge';
import SafeImage from '../components/SafeImage';
import Icon from '../components/Icon';
import { CATEGORY_ICON_MAP } from '../utils/workoutSession';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import type { Exercise } from '../types/exercise';
import type { RootStackScreenProps } from '../types/navigation';
import { localizeExerciseTaxonomyValue } from '../localization/exerciseTaxonomy';

type ExercisesLibraryScreenProps = RootStackScreenProps<'ExercisesLibrary'>;

/** A saved exercise, a provider result, or the heading above either group. */
type LibraryRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'saved'; key: string; exercise: Exercise; isLast: boolean }
  | {
      kind: 'online';
      key: string;
      item: ExternalExerciseItem;
      isLast: boolean;
    };

const ExercisesLibraryScreen: React.FC<ExercisesLibraryScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const [textSecondary, textPrimary] = useCSSVariable([
    '--color-text-secondary',
    '--color-text-primary',
  ]) as [string, string];
  const scrollBottomPadding = insets.bottom + activeWorkoutBarPadding + 16;
  const [searchText, setSearchText] = useState('');
  const ownershipFilter = useAppPreferencesStore(
    (s) => s.exercisesLibraryOwnershipFilter
  );
  const setOwnershipFilter = useAppPreferencesStore(
    (s) => s.setExercisesLibraryOwnershipFilter
  );

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { profile } = useProfile();
  const { getImageSource } = useExerciseImageSource();

  const {
    exercises,
    isLoading,
    isSearching,
    isError,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    refetch,
  } = useExercisesLibrary(searchText, { enabled: isConnected });
  const filteredExercises = useMemo(
    () => filterByOwnership(exercises, ownershipFilter, profile?.id),
    [exercises, ownershipFilter, profile?.id]
  );

  // Online results come from the user's default active exercise provider.
  // There is no picker here, unlike ExerciseSearchScreen: this screen is a
  // library browser, and the provider choice belongs to the flow that is
  // explicitly picking an exercise.
  const { providers } = useExternalProviders({
    enabled: isConnected,
    category: 'exercise',
  });
  const provider = providers[0] ?? null;
  const {
    searchResults: onlineResults,
    isSearching: isOnlineSearching,
    isSearchActive: isOnlineSearchActive,
    isSearchError: isOnlineSearchError,
    fetchNextPage: fetchMoreOnline,
    hasNextPage: hasMoreOnline,
    isFetchingNextPage: isFetchingMoreOnline,
  } = useExternalExerciseSearch(searchText, provider?.provider_type ?? '', {
    enabled: isConnected && provider !== null,
    providerId: provider?.id,
  });

  // Anything already in the library is dropped from the online half, so one
  // exercise never appears twice in the same list.
  const savedNames = useMemo(
    () => new Set(exercises.map((item) => item.name.trim().toLowerCase())),
    [exercises]
  );
  const newOnlineResults = useMemo(
    () =>
      onlineResults.filter(
        (item) => !savedNames.has(item.name.trim().toLowerCase())
      ),
    [onlineResults, savedNames]
  );

  const handleExercisePress = useCallback(
    (exercise: Exercise) => {
      navigation.navigate('ExerciseDetail', { item: exercise });
    },
    [navigation]
  );

  const queryClient = useQueryClient();
  // The program the add sheet is open for, if any.
  const [purchasing, setPurchasing] = useState<ExerciseProgram | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  // `importingId` only disables the rows after a re-render; the ref blocks a
  // second tap landing before that.
  const importInFlight = useRef(false);
  const handleImportPress = useCallback(
    async (item: ExternalExerciseItem) => {
      if (importInFlight.current) return;
      importInFlight.current = true;
      setImportingId(item.id);
      try {
        const imported = await importExercise(item.source, item.id);
        // The import succeeded server-side, so the library must reflect it
        // even if the user navigates away before the detail screen opens.
        queryClient.invalidateQueries({ queryKey: suggestedExercisesQueryKey });
        await refetch();
        if (navigation.isFocused()) {
          navigation.navigate('ExerciseDetail', { item: imported });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: t('exerciseSearch.errors.failedToAddExercise', {
            defaultValue: 'Failed to add exercise',
          }),
          text2: getApiErrorMessage(error) ?? undefined,
        });
      }
      importInFlight.current = false;
      setImportingId(null);
    },
    [navigation, queryClient, refetch, t]
  );

  /**
   * One list, two halves: the matching saved exercises first, then whatever
   * the provider returns that is not already saved. Section headings appear
   * only while searching — with an empty box the screen is still just the
   * library, unheaded, as it was before.
   */
  const rows = useMemo<LibraryRow[]>(() => {
    const isSearching = searchText.trim().length > 0;
    const savedRows: LibraryRow[] = filteredExercises.map(
      (exercise, index) => ({
        kind: 'saved',
        key: exercise.id,
        exercise,
        isLast: index === filteredExercises.length - 1,
      })
    );
    if (!isSearching) return savedRows;

    const onlineRows: LibraryRow[] = newOnlineResults.map((item, index) => ({
      kind: 'online',
      key: `online-${item.source}-${item.id}`,
      item,
      isLast: index === newOnlineResults.length - 1,
    }));

    return [
      ...(savedRows.length > 0
        ? [
            {
              kind: 'section' as const,
              key: 'section-saved',
              title: t('exerciseLibrary.savedSection', {
                defaultValue: 'My exercises',
              }),
            },
            ...savedRows,
          ]
        : []),
      ...(onlineRows.length > 0
        ? [
            {
              kind: 'section' as const,
              key: 'section-online',
              title: t('exerciseLibrary.onlineSection', {
                defaultValue: 'Online',
              }),
            },
            ...onlineRows,
          ]
        : []),
    ];
  }, [filteredExercises, newOnlineResults, searchText, t]);

  const renderEmpty = () => {
    if (
      ownershipFilter !== 'all' &&
      exercises.length > 0 &&
      filteredExercises.length === 0
    ) {
      return (
        <StatusView
          inline
          {...ownershipFilterEmptyState({
            noun: t('exerciseLibrary.noun', { defaultValue: 'exercises' }),
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
            ? t('exerciseLibrary.noMatch', {
                defaultValue: 'No matching exercises found',
              })
            : t('exerciseLibrary.noItems', {
                defaultValue: 'No exercises found',
              })
        }
        subtitle={
          searchText.trim().length > 0
            ? t('exerciseLibrary.trySearch', {
                defaultValue:
                  'Try a different search term to find saved exercises.',
              })
            : t('exerciseLibrary.empty', {
                defaultValue: 'Exercises you save or log will appear here.',
              })
        }
      />
    );
  };

  const renderSection = (title: string) => (
    <View className="px-4 pt-4 pb-2 bg-background">
      <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider">
        {title}
      </Text>
    </View>
  );

  const renderOnlineRow = (item: ExternalExerciseItem) => {
    const image = item.images?.find((image) => image.trim().length > 0) ?? null;
    const fallbackIcon =
      (item.category && CATEGORY_ICON_MAP[item.category]) || 'exercise-weights';
    const isImporting = importingId !== null;
    return (
      <TouchableOpacity
        className="px-4 py-3"
        activeOpacity={0.7}
        disabled={isImporting}
        accessibilityLabel={t('exerciseLibrary.addOnline', {
          defaultValue: 'Add {{name}} to your exercises',
          name: item.name,
        })}
        onPress={() => void handleImportPress(item)}
      >
        <View className="flex-row items-center gap-3">
          <SafeImage
            source={image ? getImageSource(image) : null}
            style={{ width: 44, height: 44, borderRadius: 8 }}
            fallback={
              <View
                className="bg-raised items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 8 }}
              >
                <Icon name={fallbackIcon} size={22} color={textSecondary} />
              </View>
            }
          />
          <View className="flex-1">
            <Text
              className="text-text-primary text-base font-medium"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.category ? (
              <Text className="text-sm mt-0.5" style={{ color: textSecondary }}>
                {localizeExerciseTaxonomyValue(t, 'category', item.category)}
              </Text>
            ) : null}
          </View>
          {importingId === item.id ? (
            <ActivityIndicator size="small" color={textPrimary} />
          ) : (
            <Icon name="add-circle" size={22} color={textSecondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRow = ({ item }: { item: Exercise; isLast: boolean }) => {
    const status = deriveShareStatus(
      item.userId,
      item.sharedWithPublic,
      profile?.id
    );
    const image = item.images?.find((image) => image.trim().length > 0) ?? null;
    const fallbackIcon =
      (item.category && CATEGORY_ICON_MAP[item.category]) || 'exercise-weights';
    return (
      <TouchableOpacity
        className="px-4 py-3"
        activeOpacity={0.7}
        onPress={() => handleExercisePress(item)}
      >
        <View className="flex-row items-center gap-3">
          <SafeImage
            source={image ? getImageSource(image) : null}
            style={{ width: 44, height: 44, borderRadius: 8 }}
            fallback={
              <View
                className="bg-raised items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 8 }}
              >
                <Icon name={fallbackIcon} size={22} color={textSecondary} />
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
            {item.category ? (
              <Text className="text-sm mt-0.5" style={{ color: textSecondary }}>
                {localizeExerciseTaxonomyValue(t, 'category', item.category)}
              </Text>
            ) : null}
          </View>
        </View>
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
          title={t('exerciseLibrary.noServer', {
            defaultValue: 'No server configured',
          })}
          subtitle={t('exerciseLibrary.configure', {
            defaultValue:
              'Configure your server connection in Settings to view your exercise library.',
          })}
          action={{
            label: t('exerciseLibrary.go', { defaultValue: 'Go to Settings' }),
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
          title={t('exerciseLibrary.loading', {
            defaultValue: 'Loading exercises...',
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
          title={t('exerciseLibrary.failed', {
            defaultValue: 'Failed to load exercises',
          })}
          subtitle={t('exerciseLibrary.check', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('exerciseLibrary.retry', { defaultValue: 'Retry' }),
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
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) => {
          if (row.kind === 'section') return renderSection(row.title);
          if (row.kind === 'online') return renderOnlineRow(row.item);
          return renderRow({ item: row.exercise, isLast: row.isLast });
        }}
        ListHeaderComponent={
          searchText.trim().length > 0 ? null : (
            <>
              <ProgramStore
                onSelectProgram={(program) =>
                  navigation.navigate('ExerciseProgram', {
                    programId: program.id,
                  })
                }
                onStartProgram={setPurchasing}
              />
              <View className="px-4 pt-6 pb-2">
                <Text className="text-lg font-bold text-text-primary">
                  {t('exerciseLibrary.savedSection', {
                    defaultValue: 'My exercises',
                  })}
                </Text>
              </View>
            </>
          )
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          <>
            <PaginatedLibraryFooter
              isFetchingNextPage={isFetchingNextPage || isFetchingMoreOnline}
              isFetchNextPageError={isFetchNextPageError}
              errorMessage={t('exerciseLibrary.moreFailed', {
                defaultValue: 'Failed to load more exercises.',
              })}
              onRetry={loadMore}
            />
            {isOnlineSearchActive && isOnlineSearching && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={textSecondary} />
              </View>
            )}
            {isOnlineSearchError && (
              <Text className="text-text-secondary text-sm text-center px-4 py-3">
                {t('exerciseLibrary.onlineFailed', {
                  defaultValue: 'Could not search online exercises.',
                })}
              </Text>
            )}
          </>
        }
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          // Exhaust the saved half first, then page the provider — the list
          // renders them in that order.
          if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
            loadMore();
            return;
          }
          if (hasMoreOnline && !isFetchingMoreOnline) {
            void fetchMoreOnline();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isSearching}
            onRefresh={refetch}
            tintColor={textPrimary}
          />
        }
        contentContainerStyle={{
          paddingBottom: scrollBottomPadding,
          flexGrow: 1,
        }}
      />
    );
  };

  // The screen is both a tab root and a Library drill-in, and only the tab
  // root carries the store chrome. Decided by the route name, NOT by
  // `navigation.canGoBack()`: a tab navigator's router answers GO_BACK once
  // its history holds a second entry, so arriving on the store from any other
  // tab made canGoBack() true here too and collapsed the store header into the
  // drill-in one.
  const isTabRoot = (route.name as string) !== 'ExercisesLibrary';
  const filterItem = ownershipFilterHeaderMenu({
    noun: t('exerciseLibrary.noun', { defaultValue: 'exercises' }),
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
    identifier: 'exercises-library-filter',
    filter: ownershipFilter,
    onSelect: setOwnershipFilter,
  });
  const header = useScreenHeader({
    // The tab root is the program store; the Library drill-in is still the
    // exercise library.
    title: isTabRoot
      ? t('programs.storeTab', { defaultValue: 'Store' })
      : t('exerciseLibrary.title', { defaultValue: 'Exercises' }),
    // The search bar sits immediately below on the custom path, so a hairline
    // here would draw a line between the bar and the field rather than
    // between two sections.
    borderless: true,
    // The store keeps the cart and profile pair every tab header carries in
    // the right corner, so the filter moves to the leading slot the back
    // button would otherwise occupy. The drill-in still needs that slot for
    // back, so there the filter stays on the right.
    left: isTabRoot ? filterItem : { kind: 'back' },
    right: isTabRoot
      ? [
          {
            kind: 'icon' as const,
            sfSymbol: 'fork.knife',
            ionicon: 'restaurant',
            accessibilityLabel: t('cart.title', { defaultValue: 'Meals' }),
            identifier: 'exercises-library-cart',
            onPress: () => navigation.navigate('Cart'),
            // Own glass capsule each, or iOS 26 merges the pair into one
            // joined control.
            separated: true,
          },
          {
            kind: 'icon' as const,
            sfSymbol: 'person.crop.circle',
            ionicon: 'person-circle-outline',
            accessibilityLabel: t('profile.title', {
              defaultValue: 'Profile',
            }),
            identifier: 'exercises-library-profile',
            onPress: () => navigation.navigate('Profile'),
            separated: true,
          },
        ]
      : [filterItem],
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {isConnected ? (
        <LibrarySearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('exerciseLibrary.search', {
            defaultValue: 'Search exercises...',
          })}
          isSearching={isSearching}
        />
      ) : null}
      {renderContent()}
      {purchasing && (
        <ProgramPurchaseSheet
          program={purchasing}
          onClose={() => setPurchasing(null)}
          onInstalled={(result) => {
            setPurchasing(null);
            Toast.show({
              type: 'success',
              text1: t('programs.purchase.added', {
                count: result.presetsCreated,
                defaultValue: '{{count}} workouts added to Programs',
                defaultValue_one: '{{count}} workout added to Programs',
                defaultValue_other: '{{count}} workouts added to Programs',
              }),
            });
          }}
        />
      )}
    </View>
  );
};

export default ExercisesLibraryScreen;
