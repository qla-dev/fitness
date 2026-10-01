import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { fetchWorkoutPresetsPage } from '../services/api/workoutPresetsApi';
import { formatLocalizedNumber } from '../localization';
import type { RootStackParamList } from '../types/navigation';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';

/**
 * The saved-items block on the Profile screen. Food, meals, logs and meal
 * plans live behind the food tab, so only the user's training programs stay
 * here. The row opens the user's own list — creating a program is the "+" in
 * the logging screens' headers, so nothing here is a create action.
 */
export default function MyLibrarySection({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: presetsCount } = useQuery({
    queryKey: ['workoutPresets', 'count'] as const,
    queryFn: () =>
      fetchWorkoutPresetsPage({ page: 1, pageSize: 1 }).then(
        (r) => r.pagination.totalCount
      ),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  // A row that has not resolved its count yet shows no subtitle rather than a
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

      <SettingsRowGroup>
        <SettingsRow
          icon="exercise-weights"
          title={t('profile.library.workout', {
            defaultValue: 'My Programs',
          })}
          subtitle={countLabel(presetsCount)}
          onPress={() => navigation.navigate('WorkoutPresetsLibrary')}
        />
      </SettingsRowGroup>
    </View>
  );
}
