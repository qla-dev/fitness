import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import HapticRefreshControl from '../components/HapticRefreshControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useOpenStartWorkout } from '../hooks/useOpenStartWorkout';
import {
  createNativeWorkoutsAction,
  createNativeProfileAction,
  setNativeTabHeaderActions,
  type NativeTabHeaderNavigation,
} from '../utils/nativeHeaderDatePicker';
import Button from '../components/ui/Button';
import FoodLibraryRow from '../components/FoodLibraryRow';
import MealLibraryRow from '../components/MealLibraryRow';
import StatusView from '../components/StatusView';
import TabHeader from '../components/TabHeader';
import {
  useFavorites,
  useFoods,
  useRecentMeals,
  useServerConnection,
  useSuggestedExercises,
} from '../hooks';
import type { Exercise } from '../types/exercise';
import { foodItemToFoodInfo } from '../types/foodInfo';
import type { FoodItem } from '../types/foods';
import type { Meal } from '../types/meals';
import type { RootStackParamList } from '../types/navigation';

type LibraryScreenProps = {
  navigation: Pick<
    NativeStackScreenProps<RootStackParamList>['navigation'],
    'navigate'
  >;
  route?: unknown;
};

const RECENT_LIMIT = 4;

type RecentItem =
  | { type: 'meal'; data: Meal }
  | { type: 'food'; data: FoodItem }
  | { type: 'exercise'; data: Exercise };

type SharedLibraryProps = (
  LibraryScreenProps | NativeStackScreenProps<RootStackParamList, 'MyLogs'>
) & {
  logsHeader?: React.ReactNode;
  logsNativeHeader?: boolean;
};
const LibraryScreen: React.FC<SharedLibraryProps> = ({
  navigation: screenNavigation,
  logsHeader,
  logsNativeHeader,
}) => {
  const navigation: Pick<
    NativeStackScreenProps<RootStackParamList>['navigation'],
    'navigate'
  > = screenNavigation;
  const isLogs = logsNativeHeader !== undefined;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding(
    isLogs ? 'stack' : undefined
  );
  const nativeTabs = useNativeIOSTabsActive();
  const usesNativeTabs = isLogs ? logsNativeHeader : nativeTabs;
  const { defaultColor: nativeHeaderActionColor } = useHeaderActionColors();
  const startWorkout = useOpenStartWorkout(navigation);

  // The tab has no date, so it never went through the shared date-picker
  // helper; it still needs the workouts and profile buttons every tab header
  // carries.
  useLayoutEffect(() => {
    if (!usesNativeTabs || isLogs) return;
    setNativeTabHeaderActions(
      // On the native path this screen sits in the tab-local native stack,
      // whose header options the bottom-tab navigation type does not describe.
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
      nativeHeaderActionColor
    );
  }, [
    navigation,
    nativeHeaderActionColor,
    startWorkout,
    t,
    usesNativeTabs,
    isLogs,
  ]);
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { favoriteFoods, favoriteMeals } = useFavorites({
    enabled: isConnected,
  });
  const favoriteFoodIds = useMemo(
    () => new Set(favoriteFoods.map((f) => f.id)),
    [favoriteFoods]
  );
  const favoriteMealIds = useMemo(
    () => new Set(favoriteMeals.map((m) => m.id)),
    [favoriteMeals]
  );
  const {
    recentFoods,
    isLoading: isFoodsLoading,
    isError: isFoodsError,
    refetch: refetchFoods,
  } = useFoods({ enabled: isConnected });
  const {
    recentMeals,
    isLoading: isRecentMealsLoading,
    isError: isRecentMealsError,
    refetch: refetchRecentMeals,
  } = useRecentMeals({ enabled: isConnected, limit: RECENT_LIMIT });
  const {
    recentExercises,
    isLoading: isRecentExercisesLoading,
    isError: isRecentExercisesError,
    refetch: refetchRecentExercises,
  } = useSuggestedExercises();
  const onRefresh = useCallback(async () => {
    if (!isConnected) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchFoods(),
        refetchRecentMeals(),
        refetchRecentExercises(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isConnected, refetchFoods, refetchRecentMeals, refetchRecentExercises]);

  const recentItems = useMemo<RecentItem[]>(() => {
    const items: RecentItem[] = [];
    let mi = 0;
    let fi = 0;
    let ei = 0;
    while (items.length < RECENT_LIMIT) {
      const hasMeal = mi < recentMeals.length;
      const hasFood = fi < recentFoods.length;
      const hasExercise = ei < recentExercises.length;
      if (!hasMeal && !hasFood && !hasExercise) break;
      if (hasMeal) {
        items.push({ type: 'meal', data: recentMeals[mi++] });
        if (items.length >= RECENT_LIMIT) break;
      }
      if (hasFood) {
        items.push({ type: 'food', data: recentFoods[fi++] });
        if (items.length >= RECENT_LIMIT) break;
      }
      if (hasExercise)
        items.push({ type: 'exercise', data: recentExercises[ei++] });
    }
    return items;
  }, [recentMeals, recentFoods, recentExercises]);

  const isRecentLoading =
    isFoodsLoading || isRecentMealsLoading || isRecentExercisesLoading;
  const showRecentError =
    !isRecentLoading &&
    recentItems.length === 0 &&
    (isFoodsError || isRecentMealsError || isRecentExercisesError);

  const retryRecent = () => {
    void refetchFoods();
    void refetchRecentMeals();
    void refetchRecentExercises();
  };

  if (!isConnectionLoading && !isConnected) {
    return (
      <View
        className="flex-1 bg-background"
        style={usesNativeTabs ? undefined : { paddingTop: insets.top }}
      >
        {isLogs && logsHeader}
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('screens.library.noServerConfigured', {
            defaultValue: 'No server configured',
          })}
          subtitle={t('screens.library.configureServer', {
            defaultValue:
              'Configure your server connection in Settings to view your library.',
          })}
          action={{
            label: t('screens.library.goToSettings', {
              defaultValue: 'Go to Settings',
            }),
            onPress: () => navigation.navigate('Profile'),
            variant: 'primary',
          }}
        />
      </View>
    );
  }

  if (isConnectionLoading) {
    return (
      <View
        className="flex-1 bg-background"
        style={usesNativeTabs ? undefined : { paddingTop: insets.top }}
      >
        <StatusView
          loading
          title={t('screens.library.loading', {
            defaultValue: 'Loading library...',
          })}
        />
      </View>
    );
  }

  // Library and My Logs share the same recent entries and refresh behavior.
  return (
    <View
      className="flex-1 bg-background"
      style={isLogs && !usesNativeTabs ? { paddingTop: insets.top } : undefined}
    >
      {isLogs && logsHeader}
      {!isLogs && !usesNativeTabs && (
        <TabHeader
          title={t('screens.library.title', { defaultValue: 'Library' })}
          onWorkoutsPress={startWorkout}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 16 + activeWorkoutBarPadding,
        }}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <HapticRefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
          />
        }
      >
        <View className="mb-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('screens.library.recentlyLogged', {
              defaultValue: 'Recently Logged',
            })}
          </Text>
        </View>

        <View className="bg-surface rounded-xl overflow-hidden">
          {isRecentLoading ? (
            <View className="px-4 py-8 items-center">
              <ActivityIndicator size="small" color="#6B7280" />
              <Text className="text-text-secondary text-sm mt-3">
                {t('screens.library.loadingRecentItems', {
                  defaultValue: 'Loading recent items...',
                })}
              </Text>
            </View>
          ) : showRecentError ? (
            <View className="px-4 py-6 items-start">
              <Text className="text-text-secondary text-sm">
                {t('screens.library.failedRecentItems', {
                  defaultValue: 'Failed to load recent items.',
                })}
              </Text>
              <Button
                variant="link"
                className="px-0 py-0 mt-3"
                textClassName="text-sm"
                onPress={retryRecent}
              >
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </View>
          ) : recentItems.length > 0 ? (
            recentItems.map((item, index) => {
              const showDivider = index < recentItems.length - 1;
              if (item.type === 'meal') {
                return (
                  <MealLibraryRow
                    key={`meal-${item.data.id}`}
                    meal={item.data}
                    isFavorite={favoriteMealIds.has(item.data.id)}
                    showDivider={showDivider}
                    onPress={() =>
                      navigation.navigate('MealDetail', {
                        mealId: item.data.id,
                        initialMeal: item.data,
                      })
                    }
                  />
                );
              }
              if (item.type === 'food') {
                return (
                  <FoodLibraryRow
                    key={`food-${item.data.id}`}
                    food={item.data}
                    isFavorite={favoriteFoodIds.has(item.data.id)}
                    showDivider={showDivider}
                    onPress={() =>
                      navigation.navigate('FoodDetail', {
                        item: foodItemToFoodInfo(item.data),
                      })
                    }
                  />
                );
              }
              return (
                <Pressable
                  key={`exercise-${item.data.id}`}
                  className={`px-4 py-3 ${showDivider ? 'border-b border-border-subtle' : ''}`}
                  onPress={() =>
                    navigation.navigate('ExerciseDetail', { item: item.data })
                  }
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <Text className="text-text-primary text-base font-medium">
                    {item.data.name}
                  </Text>
                  {item.data.category ? (
                    <Text className="text-text-secondary text-sm mt-0.5">
                      {item.data.category}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View className="px-4 py-6">
              <Text className="text-text-primary text-base font-medium">
                {t('screens.library.noRecentItems', {
                  defaultValue: 'No recent items yet',
                })}
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                {t('screens.library.recentItemsHint', {
                  defaultValue:
                    'Foods, meals, and exercises you log will appear here for quick access.',
                })}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default LibraryScreen;
