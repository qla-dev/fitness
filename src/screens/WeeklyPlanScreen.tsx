import { useState } from 'react';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';
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
import FooterCTA from '../components/ui/FooterCTA';
import StatusView from '../components/StatusView';
import ProductThumb from '../components/ProductThumb';
import FoodThumbnail from '../components/FoodThumbnail';
import MealLogCard from '../components/MealLogCard';
import MenuItem, { MenuItemDivider } from '../components/MenuItem';
import { CARD_GAP } from '../constants/layout';
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
export default function WeeklyPlanScreen(
  props: RootStackScreenProps<'WeeklyPlan'>
) {
  // Ties the scroll view to the footer, so with Liquid Glass the action sits
  // over the scroll edge effect instead of a filled band.
  return (
    <ScrollEdgeEffectProvider>
      <WeeklyPlanContent {...props} />
    </ScrollEdgeEffectProvider>
  );
}

function WeeklyPlanContent({
  navigation,
  route,
}: RootStackScreenProps<'WeeklyPlan'>) {
  const edgeEffectRef = useScrollEdgeEffectRef();
  const [footerHeight, setFooterHeight] = useState(88);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const client = useQueryClient();
  const [accent, green, muted, menuMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
    '--color-text-muted',
    '--color-menu-muted',
  ]) as string[];
  const { data: plans, isLoading } = useQuery({
    queryKey: weeklyPlansQueryKey,
    queryFn: listWeeklyPlans,
  });
  const plan = plans?.find((item) => item.id === route.params.planId);
  const header = useScreenHeader({
    variant: 'transparent',
    title: plan?.title ?? t('mealPlans.title', { defaultValue: 'Meal plans' }),
    left: { kind: 'back' },
  });

  const slotName = (slot: string) =>
    t(`weeklyPlans.slots.${slot}`, {
      defaultValue: slot.charAt(0).toUpperCase() + slot.slice(1),
    });

  const openList = (target: WeeklyPlan, days: PlanDay[], name: string) => {
    fireSelectionHaptic();
    // The comparison opens at once; store prices load behind it.
    navigation.navigate('ShopComparison', {
      mode: 'add',
      list: planGroceryList(
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
        ref={edgeEffectRef}
        contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: footerHeight + 12,
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
          <View key={day.weekday} style={{ gap: CARD_GAP }}>
            {/* The day's totals sit with its name; its grocery list is the
                row's one action, at the end. */}
            <View className="flex-row items-center gap-2 px-1">
              <View className="flex-row items-baseline gap-2 flex-1 min-w-0">
                <Text className="text-text-primary text-xl font-bold">
                  {weekdayName(t, day.weekday)}
                </Text>
                <Text
                  className="text-text-secondary flex-shrink"
                  numberOfLines={1}
                >
                  {t('weeklyPlans.dayTotals', {
                    defaultValue: '{{kcal}} kcal · {{cost}}',
                    kcal: formatLocalizedNumber(kcal(day)),
                    cost: planMoney(day.cost * plan.servings, plan.currency),
                  })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('weeklyPlans.addDay', {
                  defaultValue: 'Add day to grocery list',
                })}
                hitSlop={8}
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
                className="bg-accent-primary/10 rounded-full items-center justify-center"
                style={{ width: 36, height: 36 }}
              >
                <Icon name="cart" size={18} color={accent} />
              </Pressable>
            </View>
            {/* Each meal is laid out as the Tracker lays out a logged meal:
                its slot, calories in the pill, the dish under the name and
                its ingredients as food rows. */}
            {day.meals.map((meal, index) => (
              <MealLogCard
                key={index}
                icon={SLOT_ICON[meal.slot] ?? 'meal-snack'}
                label={slotName(meal.slot)}
                subtitle={meal.name}
                badge={`${formatLocalizedNumber(Math.round(meal.calories))} ${t(
                  'foodSummary.caloriesUnit',
                  { defaultValue: 'Cal' }
                )}`}
              >
                {meal.ingredients.map((ingredient, i) => (
                  <View key={i}>
                    <MenuItem
                      leading={
                        ingredient.ean ? (
                          <ProductThumb ean={ingredient.ean} size={39} />
                        ) : (
                          <FoodThumbnail
                            image={null}
                            getImageSource={() => null}
                            size={39}
                            menuStyle
                            showFallback
                          />
                        )
                      }
                      trailing={
                        ingredient.price ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: menuMuted,
                              textAlign: 'right',
                            }}
                          >
                            {planMoney(
                              ingredient.price * plan.servings,
                              plan.currency
                            )}
                          </Text>
                        ) : undefined
                      }
                    >
                      <Text
                        className="text-text-primary"
                        numberOfLines={1}
                        style={{ fontSize: 16, fontWeight: '400' }}
                      >
                        {ingredient.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          lineHeight: 15,
                          marginTop: 3,
                          color: menuMuted,
                        }}
                      >
                        {`${formatLocalizedNumber(
                          Math.round(ingredient.quantity * 10) / 10
                        )} ${t(`weeklyPlans.units.${ingredient.unit}`, {
                          defaultValue:
                            ingredient.unit === 'piece'
                              ? 'pcs'
                              : ingredient.unit,
                        })}`}
                      </Text>
                    </MenuItem>
                    {i < meal.ingredients.length - 1 ? (
                      <MenuItemDivider inset={64} />
                    ) : null}
                  </View>
                ))}
              </MealLogCard>
            ))}
          </View>
        ))}
      </ScrollView>
      {/* The week's grocery list is the screen's one action, pinned like
          every other screen's footer action. */}
      <FooterCTA
        absolute
        glass
        edgeEffect
        onHeightChange={setFooterHeight}
        label={t('weeklyPlans.addWeek', {
          defaultValue: 'Add week to grocery list',
        })}
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
      />
    </View>
  );
}
