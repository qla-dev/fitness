import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import Button from '../components/ui/Button';
import GroceryListEditor from '../components/GroceryListEditor';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { grocerySteps } from '../constants/setupSteps';
import {
  makeSamplePlan,
  planIngredients,
  recipeCost,
  type SampleRecipe,
} from '../services/groceryPlanner';
import type { GroceryList } from '../services/personalSetup';
import {
  isSetupWizardOpen,
  openSetupWizardSession,
} from '../services/setupWizardSession';
import type { RootStackParamList } from '../types/navigation';
import { formatLocalizedNumber } from '../localization';

export default function CartScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const padding = useActiveWorkoutBarPadding('stack');
  const setup = usePersonalSetup();
  const [wizard, setWizard] = useState(false);
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [swaps, setSwaps] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState<GroceryList | null>(null);
  const state = setup.state;
  const focused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showWizard =
    focused && !!state && (wizard || !state.groceryDone) && !draft;
  // The wizard is a root-stack route so it gets a real native header.
  useEffect(() => {
    if (!showWizard || !state || isSetupWizardOpen()) return;
    openSetupWizardSession({
      steps: grocerySteps(t),
      initial: state.grocery,
      onClose: () => setWizard(false),
      onSave: async (answers, done) => {
        await setup.save((s) => ({
          ...s,
          grocery: answers,
          groceryDone: done,
        }));
        setSwaps({});
        setOffset(0);
      },
    });
    navigation.navigate('SetupWizard');
  });
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
  const blank = (): GroceryList => ({
    id: randomUUID(),
    name: '',
    note: '',
    store: '',
    archived: false,
    items: [],
    createdAt: new Date().toISOString(),
  });
  const header = useScreenHeader({
    variant: 'transparent',
    title: t('cart.title', { defaultValue: 'Meals' }),
    left: { kind: 'back' },
    right: {
      kind: 'primary',
      label: t('groceries.newList', { defaultValue: 'New list' }),
      onPress: () => setDraft(blank()),
    },
  });
  const openPlanList = () => {
    const list = blank();
    list.name = t('groceries.weekList', { defaultValue: 'This week’s meals' });
    list.store = String(
      state?.grocery.customStore ||
        (state?.grocery.store === 'any' ? '' : state?.grocery.store) ||
        ''
    );
    list.note = t('groceries.sampleNote', {
      defaultValue:
        'Sample meal plan. Prices are illustrative estimates; check labels and store prices.',
    });
    list.items = planIngredients(meals, plan.servings, plan.currency).map(
      (i) => ({
        id: randomUUID(),
        name: i.name,
        quantity: `${formatLocalizedNumber(i.amount, { maximumFractionDigits: 1 })} ${i.unit}`,
        checked: false,
        price: i.cost,
      })
    );
    setDraft(list);
  };
  const swap = (index: number, current: SampleRecipe) => {
    const next =
      plan.eligible[
        (plan.eligible.findIndex((r) => r.id === current.id) + 1) %
          plan.eligible.length
      ];
    if (next) setSwaps((s) => ({ ...s, [index]: next.id }));
  };
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: native ? 0 : insets.top }}
    >
      {header}
      <ScrollView
        contentInsetAdjustmentBehavior={native ? 'automatic' : 'never'}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + padding + 30,
        }}
      >
        {setup.isLoading ? (
          <ActivityIndicator />
        ) : setup.isError ? (
          <Button onPress={() => void setup.refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        ) : (
          <>
            <View className="bg-surface rounded-3xl p-6 mb-6">
              <Text className="text-accent-primary font-semibold mb-2">
                {t('groceries.eyebrow', {
                  defaultValue: 'YOUR KITCHEN, YOUR WEEK',
                })}
              </Text>
              <Text className="text-text-primary text-3xl font-bold mb-3">
                {t('groceries.hero', {
                  defaultValue: 'Good food. A little less planning.',
                })}
              </Text>
              <Text className="text-text-secondary mb-5">
                {t('groceries.heroHint', {
                  defaultValue:
                    'Build a sample meal plan around your kitchen, budget and tastes. Or start with a simple list.',
                })}
              </Text>
              <Button variant="secondary" onPress={() => setWizard(true)}>
                {t('groceries.preferences', {
                  defaultValue: 'My food & kitchen preferences',
                })}
              </Button>
            </View>
            {state?.groceryDone && (
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
                            defaultValue:
                              '{{minutes}} min · {{price}} estimated',
                            minutes: formatLocalizedNumber(meal.minutes),
                            price: money(
                              recipeCost(meal, plan.servings, plan.currency)
                            ),
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
            )}
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-text-primary text-xl font-bold">
                {t('groceries.yourLists', { defaultValue: 'Your lists' })}
              </Text>
              <Button variant="ghost" onPress={() => setArchived((v) => !v)}>
                {archived
                  ? t('groceries.showActive', { defaultValue: 'Show active' })
                  : t('groceries.showArchived', {
                      defaultValue: 'Show archived',
                    })}
              </Button>
            </View>
            <View className="flex-row flex-wrap gap-3">
              {state?.lists
                .filter((l) => l.archived === archived)
                .map((list) => (
                  <Pressable
                    key={list.id}
                    accessibilityRole="button"
                    onPress={() => setDraft(list)}
                    className="bg-surface rounded-2xl p-5"
                    style={{ width: '47%' }}
                  >
                    <Text className="text-text-primary text-lg font-semibold mb-2">
                      {list.name}
                    </Text>
                    <Text className="text-text-secondary">{list.store}</Text>
                    <Text className="text-accent-primary mt-3">
                      {t('groceries.checked', {
                        defaultValue: '{{done}} / {{total}} checked',
                        done: formatLocalizedNumber(
                          list.items.filter((i) => i.checked).length
                        ),
                        total: formatLocalizedNumber(list.items.length),
                      })}
                    </Text>
                    <Text
                      numberOfLines={3}
                      className="text-text-secondary mt-2"
                    >
                      {list.note}
                    </Text>
                  </Pressable>
                ))}
            </View>
            {!state?.lists.some((l) => l.archived === archived) && (
              <Text className="text-text-secondary py-5">
                {t('groceries.noLists', {
                  defaultValue:
                    'A fresh page for your next shop. Create a list to get started.',
                })}
              </Text>
            )}
            <Button
              variant="outline"
              className="mt-4"
              onPress={() => setDraft(blank())}
            >
              {t('groceries.blankList', {
                defaultValue: 'Create a blank list',
              })}
            </Button>
          </>
        )}
      </ScrollView>
      {draft && (
        <GroceryListEditor
          initial={draft}
          existing={!!state?.lists.some((l) => l.id === draft.id)}
          onClose={() => setDraft(null)}
          onSave={async (list) => {
            await setup.save((s) => ({
              ...s,
              lists: s.lists.some((l) => l.id === list.id)
                ? s.lists.map((l) => (l.id === list.id ? list : l))
                : [list, ...s.lists],
            }));
          }}
          onDelete={async () => {
            await setup.save((s) => ({
              ...s,
              lists: s.lists.filter((l) => l.id !== draft.id),
            }));
          }}
        />
      )}
    </View>
  );
}
