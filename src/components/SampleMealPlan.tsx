import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { randomUUID } from 'expo-crypto';

import Button from './ui/Button';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import {
  makeSamplePlan,
  planIngredients,
  recipeCost,
  type SampleRecipe,
} from '../services/groceryPlanner';
import type { GroceryList } from '../services/personalSetup';
import { formatLocalizedNumber } from '../localization';

/**
 * A week of main meals proposed from the kitchen, budget and tastes the setup
 * wizard collected, with a shopping list at the end of it.
 *
 * It belongs with the meal plans rather than with the grocery lists: it is a
 * plan, and a list is what it produces. Shuffling and swapping are local —
 * nothing is written until the list is created, which is the caller's to do
 * because the list has to land on the screen that owns lists.
 *
 * Renders nothing until the wizard's grocery section has been answered; with
 * no kitchen, budget or tastes on file there is nothing to propose.
 */
export default function SampleMealPlan({
  onCreateList,
}: {
  onCreateList: (list: GroceryList) => void;
}) {
  const { t } = useTranslation();
  const setup = usePersonalSetup();
  const state = setup.state;
  const [offset, setOffset] = useState(0);
  const [swaps, setSwaps] = useState<Record<number, string>>({});

  const plan = makeSamplePlan(state?.grocery ?? {}, offset);
  const meals = plan.meals.map(
    (meal, index) => plan.eligible.find((r) => r.id === swaps[index]) ?? meal
  );
  const cost = meals.reduce(
    (sum, meal) => sum + recipeCost(meal, plan.servings, plan.currency),
    0
  );
  const money = (amount: number) =>
    formatLocalizedNumber(amount, {
      style: 'currency',
      currency: plan.currency,
    });

  const openPlanList = () => {
    const list: GroceryList = {
      id: randomUUID(),
      name: t('groceries.weekList', { defaultValue: 'This week’s meals' }),
      note: t('groceries.sampleNote', {
        defaultValue:
          'Sample meal plan. Prices are illustrative estimates; check labels and store prices.',
      }),
      store: String(
        state?.grocery.customStore ||
          (state?.grocery.store === 'any' ? '' : state?.grocery.store) ||
          ''
      ),
      archived: false,
      createdAt: new Date().toISOString(),
      items: planIngredients(meals, plan.servings, plan.currency).map((i) => ({
        id: randomUUID(),
        name: i.name,
        quantity: `${formatLocalizedNumber(i.amount, { maximumFractionDigits: 1 })} ${i.unit}`,
        checked: false,
        price: i.cost,
      })),
    };
    onCreateList(list);
  };

  const swap = (index: number, current: SampleRecipe) => {
    const next =
      plan.eligible[
        (plan.eligible.findIndex((r) => r.id === current.id) + 1) %
          plan.eligible.length
      ];
    if (next) setSwaps((s) => ({ ...s, [index]: next.id }));
  };

  if (!state?.groceryDone) return null;

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-text-primary text-xl font-bold">
          {t('groceries.samplePlan', {
            defaultValue: 'Your sample meal plan',
          })}
        </Text>
        <Button
          variant="ghost"
          onPress={() => {
            setOffset((n) => n + 1);
            setSwaps({});
          }}
        >
          {t('groceries.shuffle', { defaultValue: 'Shuffle' })}
        </Button>
      </View>
      <Text className="text-text-secondary mb-3">
        {t('groceries.planScope', {
          defaultValue:
            'One main meal per day · {{servings}} servings · sample prices',
          servings: formatLocalizedNumber(plan.servings),
        })}
      </Text>
      {!Array.isArray(state.grocery.allergies) ||
      state.grocery.allergies.length === 0 ? (
        <Text className="text-text-secondary mb-3">
          {t('groceries.allergiesUnknown', {
            defaultValue:
              'Allergies are unspecified. Review ingredients before using this plan.',
          })}
        </Text>
      ) : null}
      {meals.length ? (
        <>
          {meals.map((meal, index) => (
            <View
              key={`${index}-${meal.id}`}
              className="bg-surface rounded-2xl p-4 mb-3"
            >
              <Text className="text-accent-primary text-sm mb-1">
                {t('groceries.day', {
                  defaultValue: 'Day {{day}}',
                  day: formatLocalizedNumber(index + 1),
                })}
              </Text>
              <Text className="text-text-primary text-lg font-semibold">
                {meal.name}
              </Text>
              <Text className="text-text-secondary mt-1">
                {t('groceries.mealMeta', {
                  defaultValue: '{{minutes}} min · {{price}} estimated',
                  minutes: formatLocalizedNumber(meal.minutes),
                  price: money(recipeCost(meal, plan.servings, plan.currency)),
                })}
              </Text>
              <Text className="text-text-secondary mt-3">
                {meal.instructions}
              </Text>
              <Button
                variant="ghost"
                disabled={plan.eligible.length < 2}
                onPress={() => swap(index, meal)}
              >
                {t('groceries.swap', { defaultValue: 'Swap meal' })}
              </Button>
            </View>
          ))}
          <Text className="text-text-primary font-semibold mb-3">
            {t('groceries.total', {
              defaultValue: 'Estimated main-meal total: {{price}}',
              price: money(cost),
            })}
          </Text>
          <Button onPress={openPlanList}>
            {t('groceries.createFromPlan', {
              defaultValue: 'Create shopping list',
            })}
          </Button>
        </>
      ) : (
        <View className="bg-surface rounded-2xl p-5">
          <Text className="text-text-primary">
            {t('groceries.noMatches', {
              defaultValue:
                'No sample plan matches all your preferences and budget. Custom allergies need a manual ingredient review. Edit preferences or create a blank list.',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
