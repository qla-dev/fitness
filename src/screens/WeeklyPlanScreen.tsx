import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';
import Icon from '../components/Icon';
import Button from '../components/ui/Button';
import StatusView from '../components/StatusView';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { regionName } from '../constants/regions';
import {
  listWeeklyPlans,
  planGroceryList,
  planMoney,
  setActiveWeeklyPlan,
  weekdayName,
  weeklyPlansQueryKey,
  type PlanDay,
  type WeeklyPlan,
} from '../services/weeklyPlans';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackScreenProps } from '../types/navigation';

const SLOT_ICON = {
  breakfast: 'meal-breakfast',
  lunch: 'meal-lunch',
  dinner: 'meal-dinner',
  snack: 'meal-snack',
} as const;

/**
 * One weekly plan, Monday to Sunday. Each day lists its meals with calories
 * and what the day costs, and can go to a grocery list on its own; the whole
 * week can too, with the same ingredients added up across days.
 */
export default function WeeklyPlanScreen({
  navigation,
  route,
}: RootStackScreenProps<'WeeklyPlan'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const client = useQueryClient();
  const [accent, green, muted] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
    '--color-text-muted',
  ]) as string[];
  const { data: plans, isLoading } = useQuery({
    queryKey: weeklyPlansQueryKey,
    queryFn: listWeeklyPlans,
  });
  const plan = plans?.find((item) => item.id === route.params.planId);
  const header = useScreenHeader({
    title: plan?.title ?? t('mealPlans.title', { defaultValue: 'Meal plans' }),
    left: { kind: 'back' },
  });

  const slotName = (slot: string) =>
    t(`weeklyPlans.slots.${slot}`, {
      defaultValue: slot.charAt(0).toUpperCase() + slot.slice(1),
    });

  const openList = (target: WeeklyPlan, days: PlanDay[], name: string) => {
    fireSelectionHaptic();
    navigation.navigate('Cart', {
      planList: planGroceryList(
        target,
        days,
        name,
        target.prices === 'cijene'
          ? t('weeklyPlans.listNoteLive', {
              defaultValue:
                'From {{plan}}. Prices are Croatian store averages from {{date}}.',
              plan: target.title,
              date: target.price_date ?? '',
            })
          : t('weeklyPlans.listNoteEstimate', {
              defaultValue: 'From {{plan}}. Prices are estimates.',
              plan: target.title,
            })
      ),
    });
  };

  if (isLoading)
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  if (!plan)
    return (
      <View className="flex-1 bg-background">
        {header}
        <StatusView
          title={t('weeklyPlans.missing', {
            defaultValue: 'This meal plan was deleted.',
          })}
        />
      </View>
    );

  const kcal = (day: PlanDay) =>
    Math.round(day.meals.reduce((sum, meal) => sum + meal.calories, 0));

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: nativeHeader ? 0 : insets.top }}
    >
      {header}
      <ScrollView
        contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View className="bg-surface rounded-2xl p-5 gap-2">
          <Text className="text-text-primary text-3xl font-bold">
            {planMoney(plan.weekly_cost, plan.currency)}
            <Text className="text-text-secondary text-base font-normal">
              {' '}
              {t('weeklyPlans.forServings', {
                defaultValue: '/ week for {{count}} people',
                defaultValue_one: '/ week for {{count}} person',
                count: plan.servings,
              })}
            </Text>
          </Text>
          {plan.summary ? (
            <Text className="text-text-secondary">{plan.summary}</Text>
          ) : null}
          <Text
            className="text-sm"
            style={{ color: plan.prices === 'cijene' ? green : muted }}
          >
            {plan.prices === 'cijene'
              ? t('weeklyPlans.livePriceNote', {
                  defaultValue:
                    'Priced from {{region}} store prices on {{date}} (cijene.dev).',
                  region: regionName(t, plan.region),
                  date: plan.price_date ?? '',
                })
              : t('weeklyPlans.estimateNote', {
                  defaultValue: 'Estimated prices for {{region}}.',
                  region: regionName(t, plan.region),
                })}
          </Text>
          <View className="flex-row gap-3 mt-2">
            <View className="flex-1">
              <Button
                onPress={() =>
                  openList(
                    plan,
                    plan.days,
                    t('weeklyPlans.weekList', {
                      defaultValue: '{{plan}} · whole week',
                      plan: plan.title,
                    })
                  )
                }
              >
                {t('weeklyPlans.addWeek', {
                  defaultValue: 'Add week to grocery list',
                })}
              </Button>
            </View>
          </View>
          {!plan.is_active ? (
            <Button
              variant="ghost"
              onPress={() => {
                fireSelectionHaptic();
                void setActiveWeeklyPlan(plan.id).then(() =>
                  client.invalidateQueries({ queryKey: weeklyPlansQueryKey })
                );
              }}
            >
              {t('weeklyPlans.makeActive', { defaultValue: 'Make active' })}
            </Button>
          ) : null}
        </View>

        {plan.days.map((day) => (
          <View key={day.weekday} className="bg-surface rounded-2xl p-4 gap-3">
            <View className="flex-row items-center">
              <Text className="text-text-primary text-lg font-bold flex-1">
                {weekdayName(t, day.weekday)}
              </Text>
              <Text className="text-text-secondary">
                {t('weeklyPlans.dayTotals', {
                  defaultValue: '{{kcal}} kcal · {{cost}}',
                  kcal: formatLocalizedNumber(kcal(day)),
                  cost: planMoney(day.cost * plan.servings, plan.currency),
                })}
              </Text>
            </View>
            {day.meals.map((meal, index) => (
              <View key={index} className="flex-row items-start gap-3">
                <Icon
                  name={SLOT_ICON[meal.slot] ?? 'food'}
                  size={20}
                  color={accent}
                />
                <View className="flex-1">
                  <Text className="text-text-muted text-xs font-semibold uppercase">
                    {slotName(meal.slot)}
                  </Text>
                  <Text className="text-text-primary text-base">
                    {meal.name}
                  </Text>
                  <Text className="text-text-secondary text-xs">
                    {t('weeklyPlans.macros', {
                      defaultValue:
                        '{{kcal}} kcal · P {{protein}} g · C {{carbs}} g · F {{fat}} g',
                      kcal: Math.round(meal.calories),
                      protein: Math.round(meal.protein),
                      carbs: Math.round(meal.carbs),
                      fat: Math.round(meal.fat),
                    })}
                  </Text>
                </View>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                openList(
                  plan,
                  [day],
                  t('weeklyPlans.dayList', {
                    defaultValue: '{{plan}} · {{day}}',
                    plan: plan.title,
                    day: weekdayName(t, day.weekday),
                  })
                )
              }
              className="flex-row items-center gap-2 self-start"
            >
              <Icon name="cart" size={16} color={accent} />
              <Text style={{ color: accent }} className="font-semibold">
                {t('weeklyPlans.addDay', {
                  defaultValue: 'Add day to grocery list',
                })}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
