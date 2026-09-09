import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import type { FoodEntry } from '../types/foodEntries';
import type { DailyGoals } from '../types/goals';
import type { MealType } from '../types/mealTypes';
import { MEAL_CONFIG } from '../constants/meals';
import MealLogCard from './MealLogCard';
import SwipeableFoodRow from './SwipeableFoodRow';
import {
  calculateEntryNutrition,
  calculateMealNutrition,
  getMealGroupLabel,
  groupFoodEntriesByMealType,
  getMealPercentage,
  type MealGroup,
} from '../utils/mealNutrition';

interface FoodSummaryProps {
  foodEntries: FoodEntry[];
  mealTypes: MealType[];
  goals?: DailyGoals;
  calorieGoal?: number;
  onAddFood?: () => void;
  onAdjustServing?: (entry: FoodEntry) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
  /** Adds food straight to one meal, from that meal's own Log button. */
  onLogFood?: (mealTypeId: string | null, mealTypeName: string) => void;
}

interface MealSectionProps {
  group: MealGroup;
  goals?: DailyGoals;
  calorieGoal?: number;
  onAdjustServing?: (entry: FoodEntry) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
  onLogFood?: (mealTypeId: string | null, mealTypeName: string) => void;
}

const EmptyState: React.FC<{ onAddFood?: () => void }> = ({ onAddFood }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onAddFood}
      accessibilityRole="button"
      accessibilityLabel={t('foodSummary.tapToAddFood', {
        defaultValue: 'Tap to add food',
      })}
      className="bg-surface rounded-xl p-4 mb-2 items-center py-6"
    >
      <Text className="text-text-muted text-base">
        {t('foodSummary.tapToAddFood', { defaultValue: 'Tap to add food' })}
      </Text>
    </Pressable>
  );
};

const MealSection: React.FC<MealSectionProps> = ({
  group,
  goals,
  calorieGoal,
  onAdjustServing,
  onPressMealType,
  onLogFood,
}) => {
  const { t } = useTranslation();

  const label = getMealGroupLabel(group, t);
  // Single canonical MEAL_CONFIG lookup (read once, reuse both fields). A
  // custom category named "breakfast" still gets the neutral icon, never the
  // system one — ownership is decided by isSystem, not by the name.
  const systemConfig = group.isSystem
    ? MEAL_CONFIG[group.name.toLowerCase()]
    : undefined;
  const icon = systemConfig?.icon ?? 'meal-snack';

  const totalCalories = calculateMealNutrition(group.entries).values.calories;
  const targetCalories = React.useMemo(() => {
    // Target-calorie percentages are only meaningful for SYSTEM meal types: a
    // custom type named "breakfast" (or a historical group) must never inherit
    // the system Breakfast target calories.
    if (!group.isSystem || !goals || !calorieGoal) return 0;
    const percentage = getMealPercentage(group.name, goals);
    return Math.round((calorieGoal * percentage) / 100);
  }, [group.isSystem, group.name, goals, calorieGoal]);

  const badge =
    totalCalories > 0 || targetCalories > 0
      ? `${totalCalories}${targetCalories > 0 ? ` / ${targetCalories}` : ''} ${t(
          'foodSummary.caloriesUnit',
          { defaultValue: 'Cal' }
        )}`
      : undefined;

  return (
    <MealLogCard
      icon={icon}
      label={label}
      badge={badge}
      onOpen={
        onPressMealType
          ? () => onPressMealType(group.mealTypeId, group.name, group.entries)
          : undefined
      }
      onLog={
        onLogFood ? () => onLogFood(group.mealTypeId, group.name) : undefined
      }
    >
      {group.entries.length > 0
        ? group.entries.map((entry, index) => {
            const nutrition = calculateEntryNutrition(entry);
            return (
              <SwipeableFoodRow
                key={entry.id || index}
                compact
                showDivider={index < group.entries.length - 1}
                entry={entry}
                nutrition={nutrition}
                onAdjustServing={onAdjustServing}
              />
            );
          })
        : null}
    </MealLogCard>
  );
};

const FoodSummary: React.FC<FoodSummaryProps> = ({
  foodEntries,
  mealTypes,
  goals,
  calorieGoal,
  onAddFood,
  onAdjustServing,
  onPressMealType,
  onLogFood,
}) => {
  // Every visible meal keeps its card whether or not anything is logged, so an
  // untouched day still offers Breakfast/Lunch/Dinner/Snacks to log into.
  const groups = groupFoodEntriesByMealType(foodEntries, mealTypes, {
    includeEmpty: true,
  });

  // Only reachable before the meal types land (or for an account with none):
  // with any meal type at all there is a card to log into.
  if (groups.length === 0) {
    return <EmptyState onAddFood={onAddFood} />;
  }

  return (
    <View className="gap-2 mb-2">
      {groups.map((group) => (
        <MealSection
          key={
            group.mealTypeId
              ? `meal:${group.mealTypeId}`
              : `historical:${group.name.toLowerCase()}`
          }
          group={group}
          goals={goals}
          calorieGoal={calorieGoal}
          onAdjustServing={onAdjustServing}
          onPressMealType={onPressMealType}
          onLogFood={onLogFood}
        />
      ))}
    </View>
  );
};

export default FoodSummary;
