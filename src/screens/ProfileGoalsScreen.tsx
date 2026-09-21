import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import Button from '../components/ui/Button';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useCustomNutrients } from '../hooks';
import { goalsQueryKey } from '../hooks/queryKeys';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  CUSTOM_GOAL_PREFIX,
  PROFILE_GOAL_SECTIONS,
  getProfileGoalLabel,
  getProfileGoalSectionTitle,
  getProfileGoalUnit,
  readGoalValue,
  type ProfileGoalSection,
} from '../constants/profileGoals';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';

type ProfileGoalsScreenProps = RootStackScreenProps<'ProfileGoals'>;

/**
 * Every goal as its own row, each drilling into {@link ProfileEditScreen} —
 * the list is the menu, the edit screen is where a value changes.
 */
const ProfileGoalsScreen: React.FC<ProfileGoalsScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const today = getTodayDate();
  const goalsQuery = useQuery({
    queryKey: goalsQueryKey(today),
    queryFn: () => fetchDailyGoals(today),
  });
  const { customNutrients } = useCustomNutrients();
  const [showHeaderTitle, setShowHeaderTitle] = React.useState(false);

  // The Profile pattern: no bar background at all on iOS, which means no
  // Liquid Glass tint picked up from whatever scrolls under it. A transparent
  // bar has no scroll-edge appearance to animate, so the title handoff is
  // done by hand — the bar is empty at the top of the list and takes the
  // title once the content has moved under it.
  const header = useScreenHeader({
    title: t('profile.goals', { defaultValue: 'Goals' }),
    nativeTitle: showHeaderTitle
      ? t('profile.goals', { defaultValue: 'Goals' })
      : '',
    left: { kind: 'back' },
    borderless: true,
    nativeOptions: {
      headerLargeTitleEnabled: false,
      headerLargeTitleShadowVisible: false,
      headerTransparent: true,
      headerShadowVisible: false,
    },
  });

  const sections: ProfileGoalSection[] = [
    ...PROFILE_GOAL_SECTIONS,
    ...(customNutrients.length > 0
      ? [
          {
            id: 'custom' as const,
            keys: customNutrients.map(
              (nutrient) => `${CUSTOM_GOAL_PREFIX}${nutrient.name}`
            ),
          },
        ]
      : []),
  ];

  const describe = (key: string): string => {
    const value = readGoalValue(goalsQuery.data, key);
    if (value === undefined)
      return t('profile.goalNotSet', { defaultValue: 'Not set' });
    const unit = getProfileGoalUnit(key, customNutrients);
    return unit ? `${value} ${unit}` : String(value);
  };

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32 + activeWorkoutBarPadding,
        }}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const offset =
            nativeEvent.contentOffset.y + nativeEvent.contentInset.top;
          setShowHeaderTitle(offset > 16);
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
      >
        <Text className="text-text-secondary text-sm mb-4">
          {t('profile.goalsHelp', {
            defaultValue:
              'New goals apply from today onward. Previous days keep their goals.',
          })}
        </Text>
        {goalsQuery.isLoading ? (
          <ActivityIndicator />
        ) : goalsQuery.isError ? (
          <Button onPress={() => void goalsQuery.refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        ) : (
          sections.map((section) => (
            <SettingsRowGroup
              key={section.id}
              title={getProfileGoalSectionTitle(t, section.id)}
            >
              {section.keys.map((key) => (
                <SettingsRow
                  key={key}
                  title={getProfileGoalLabel(t, key, customNutrients)}
                  subtitle={describe(key)}
                  onPress={() =>
                    navigation.navigate('ProfileEdit', {
                      field: 'goal',
                      goalKey: key,
                    })
                  }
                />
              ))}
            </SettingsRowGroup>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default ProfileGoalsScreen;
