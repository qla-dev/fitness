import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FoodSummary from '../components/FoodSummary';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useDailySummary, useMealTypes } from '../hooks';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { getAppLocale } from '../localization';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { CARD_GAP, SCREEN_GUTTER } from '../constants/layout';
import { formatDateLabel } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';

type DayMealsScreenProps = RootStackScreenProps<'DayMeals'>;

/**
 * Every meal of one day, on its own screen.
 *
 * The same list the Tracker carries at its foot, lifted out of the rest of the
 * day so it can be worked through without the nutrition card and the body
 * tiles scrolling past first. It renders `FoodSummary`, which is what the
 * Tracker renders — the list is one component, not two that have to be kept
 * looking alike.
 *
 * The header names the day rather than a meal, which is the difference between
 * this and the per-meal screen the three-dot menu opens.
 */
const DayMealsScreen: React.FC<DayMealsScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const { date } = route.params;

  const { summary } = useDailySummary({ date });
  const { mealTypes } = useMealTypes();

  const header = useScreenHeader({
    title: formatDateLabel(date, t, getAppLocale()),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: CARD_GAP,
          paddingBottom: SCREEN_GUTTER + activeWorkoutBarPadding,
          gap: CARD_GAP,
        }}
      >
        <FoodSummary
          foodEntries={summary?.foodEntries ?? []}
          mealTypes={mealTypes}
          goals={summary?.goals}
          calorieGoal={summary?.calorieGoal}
          onAddFood={() => navigation.navigate('FoodSearch', { date })}
          onPressMealType={(mealTypeId, mealTypeName) =>
            navigation.navigate('MealTypeDetail', {
              date,
              mealTypeId: mealTypeId ?? undefined,
              mealLabel: mealTypeName,
            })
          }
          onLogFood={(mealTypeId) =>
            navigation.navigate('FoodSearch', {
              date,
              mealTypeId: mealTypeId ?? undefined,
            })
          }
        />
      </ScrollView>
    </View>
  );
};

export default DayMealsScreen;
