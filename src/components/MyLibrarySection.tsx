import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useMeals, useMedications } from '../hooks';
import { fetchFoodsPage } from '../services/api/foodsApi';
import { fetchWorkoutPresetsPage } from '../services/api/workoutPresetsApi';
import { isLocalDataMode } from '../services/dataMode';
import { formatLocalizedNumber } from '../localization';
import type { RootStackParamList } from '../types/navigation';
import CreateTile from './CreateTile';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';

/**
 * The saved-items block on the Profile screen: the four things the user
 * collects as a tile grid, then the schedule-shaped lists that do not fit a
 * tile underneath. Every entry opens the user's own list — creating a new food,
 * meal, exercise or program is the "+" in the logging screens' headers, so
 * nothing here is a create action.
 */
export default function MyLibrarySection({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const localMode = isLocalDataMode();

  const { meals } = useMeals({ enabled });
  const { data: medications } = useMedications({ enabled });
  // The ['foods', ...] prefix keeps this count inside the existing
  // `foodsQueryKey` invalidations in useSaveFood / useDeleteFood.
  const { data: foodsCount } = useQuery({
    queryKey: ['foods', 'count'] as const,
    queryFn: () =>
      fetchFoodsPage({ page: 1, itemsPerPage: 1 }).then(
        (r) => r.pagination.totalCount
      ),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
  const { data: presetsCount } = useQuery({
    queryKey: ['workoutPresets', 'count'] as const,
    queryFn: () =>
      fetchWorkoutPresetsPage({ page: 1, pageSize: 1 }).then(
        (r) => r.pagination.totalCount
      ),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  // A tile that has not resolved its count yet shows no subtitle rather than a
  // placeholder, so the label never shifts when the number lands.
  const countLabel = (count: number | undefined) =>
    count === undefined
      ? ''
      : t('profile.library.itemCount', {
          defaultValue: '{{formattedCount}} items',
          defaultValue_one: '{{formattedCount}} item',
          defaultValue_other: '{{formattedCount}} items',
          count,
          formattedCount: formatLocalizedNumber(count),
        });

  return (
    <View className="mb-4">
      <View className="px-4 pb-2">
        <Text className="text-xs font-bold text-text-secondary uppercase tracking-wider">
          {t('profile.library.title', { defaultValue: 'Library' })}
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-between">
        <CreateTile
          icon="food"
          title={t('profile.library.myFood', { defaultValue: 'My Food' })}
          subtitle={countLabel(foodsCount)}
          onPress={() => navigation.navigate('FoodsLibrary')}
          className="w-[48%] mb-3"
        />
        <CreateTile
          icon="meal"
          title={t('profile.library.myMeals', { defaultValue: 'My Meals' })}
          subtitle={countLabel(meals.length)}
          onPress={() => navigation.navigate('MealsLibrary')}
          className="w-[48%] mb-3"
        />
        <CreateTile
          icon="history"
          title={t('profile.library.myLogs', { defaultValue: 'My Logs' })}
          subtitle={t('screens.library.recentlyLogged', {
            defaultValue: 'Recently Logged',
          })}
          onPress={() => navigation.navigate('MyLogs')}
          className="w-[48%] mb-3"
        />
        <CreateTile
          icon="exercise-weights"
          title={t('profile.library.workout', {
            defaultValue: 'My Programs',
          })}
          subtitle={countLabel(presetsCount)}
          onPress={() => navigation.navigate('WorkoutPresetsLibrary')}
          className="w-[48%] mb-3"
        />
      </View>

      {!localMode && (
        <SettingsRowGroup>
          <SettingsRow
            icon="calendar"
            title={t('screens.library.mealPlans', {
              defaultValue: 'Meal plans',
            })}
            subtitle={t('screens.library.mealPlansSubtitle', {
              defaultValue: 'Repeat meals on selected days',
            })}
            onPress={() => navigation.navigate('MealPlans')}
          />
          <SettingsRow
            icon="medication"
            title={t('screens.library.medications', {
              defaultValue: 'Medications',
            })}
            subtitle={countLabel(medications?.length)}
            onPress={() => navigation.navigate('MedicationsList')}
          />
        </SettingsRowGroup>
      )}
    </View>
  );
}
