import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';
import { MenuView } from '@expo/ui/community/menu';
import Icon from '../components/Icon';
import Button from '../components/ui/Button';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { grocerySteps } from '../constants/setupSteps';
import { LIVE_PRICE_REGIONS } from '../constants/regions';
import {
  fetchVendors,
  vendorsQueryKey,
  type Vendor,
} from '../services/online/prices';
import {
  isSetupWizardOpen,
  openSetupWizardSession,
  type SetupStep,
} from '../services/setupWizardSession';
import {
  deleteWeeklyPlan,
  listWeeklyPlans,
  mealPlanRequest,
  setActiveWeeklyPlan,
  weeklyPlansQueryKey,
  type WeeklyPlan,
} from '../services/weeklyPlans';
import WeeklyPlanCard from '../components/WeeklyPlanCard';
import { useOnlineAccount } from '../services/online/account';
import { fireSelectionHaptic } from '../services/haptics';
import type { SetupAnswers } from '../services/personalSetup';
import { useMealPlans } from '../hooks/useMealPlans';
import type { MealPlanTemplate } from '../types/mealPlans';
import type { RootStackScreenProps } from '../types/navigation';

/** Matches `meal_plan_coins` in the backend config. */
export const MEAL_PLAN_COINS = 10;
/** The questionnaire's closing question on a new plan. */
const PLAN_WEEK = 'planWeek';

/**
 * The user's weekly meal plans: a card per plan with the active one marked,
 * and a new plan that starts from the food and kitchen questionnaire.
 */
export default function WeeklyPlansScreen({
  navigation,
}: RootStackScreenProps<'WeeklyPlans'>) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const client = useQueryClient();
  // The questionnaire's store question lists these; fetched with the screen
  // so they are in hand by the time it is reached.
  useQueries({
    queries: LIVE_PRICE_REGIONS.map((region) => ({
      queryKey: vendorsQueryKey(region),
      queryFn: () => fetchVendors(region),
      staleTime: 6 * 60 * 60 * 1000,
    })),
  });
  const vendorsFor = (region: string) =>
    client.getQueryData<Vendor[]>(vendorsQueryKey(region)) ?? [];
  const session = useOnlineAccount((s) => s.session);
  const setup = usePersonalSetup();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const { data: plans = [], isLoading } = useQuery({
    queryKey: weeklyPlansQueryKey,
    queryFn: listWeeklyPlans,
  });
  // Hand-built plans: library foods and meals set per weekday in the form.
  const { mealPlans: manualPlans } = useMealPlans();
  const header = useScreenHeader({
    variant: 'transparent',
    title: t('mealPlans.title', { defaultValue: 'Meal plans' }),
    left: { kind: 'back' },
    right: {
      kind: 'icon',
      sfSymbol: 'plus',
      ionicon: 'add',
      accessibilityLabel: t('weeklyPlans.addManual', {
        defaultValue: 'Build a meal plan yourself',
      }),
      onPress: () => navigation.navigate('MealPlanForm'),
    },
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: weeklyPlansQueryKey });

  // A new plan ends the questionnaire on this question: Yes plans the week
  // in a new MarkAI conversation, where the plan arrives as its card.
  const planStep: SetupStep = {
    id: PLAN_WEEK,
    heading: t('weeklyPlans.plan', { defaultValue: 'Plan my week' }),
    hint: t('weeklyPlans.planHint', {
      defaultValue:
        'MarkAI plans 7 days of meals from your answers, in a new chat. Uses {{coins}} AI coins.',
      coins: MEAL_PLAN_COINS,
    }),
    fields: [
      {
        id: PLAN_WEEK,
        label: t('weeklyPlans.plan', { defaultValue: 'Plan my week' }),
        options: [
          {
            value: 'yes',
            label: t('weeklyPlans.planYes', {
              defaultValue: 'Yes, plan my week',
            }),
            icon: 'sparkles',
          },
          {
            value: 'no',
            label: t('weeklyPlans.planNo', { defaultValue: 'Not now' }),
          },
        ],
      },
    ],
  };
  const planInChat = (answers: SetupAnswers) =>
    navigation.navigate('MarkAI', {
      preset: {
        prompt: t('weeklyPlans.planPrompt', {
          defaultValue:
            'Plan my week of meals from my food and kitchen answers.',
        }),
        label: t('weeklyPlans.plan', { defaultValue: 'Plan my week' }),
        mode: 'macros',
        task: 'meal_plan',
        mealPlan: {
          ...mealPlanRequest(answers, i18n.language),
          servings: Math.max(1, Number(answers.servings) || 1),
        },
      },
    });

  // The answers saved by the wizard this time round, if any, and whether
  // its last question asked to plan; acted on once it closes, the only
  // moment it is clearly finished.
  const saved = useRef<SetupAnswers | null>(null);
  const plan = useRef(false);
  const openQuestionnaire = (create: boolean) => {
    if (!setup.state || isSetupWizardOpen()) return;
    if (create && !session) {
      navigation.navigate('OnlineAccount');
      return;
    }
    saved.current = null;
    plan.current = false;
    openSetupWizardSession({
      steps: [...grocerySteps(t, vendorsFor), ...(create ? [planStep] : [])],
      initial: setup.state.grocery,
      onSave: async (answers, done) => {
        // The plan question is this visit's, not a food preference.
        const { [PLAN_WEEK]: planWeek, ...grocery } = answers;
        plan.current = planWeek === 'yes';
        await setup.save((s) => ({
          ...s,
          grocery,
          groceryDone: done,
        }));
        saved.current = grocery;
      },
      onClose: () => {
        const answers = saved.current ?? setup.state?.grocery;
        if (create && plan.current && answers) planInChat(answers);
      },
    });
    navigation.navigate('SetupWizard');
  };

  const [columnWidth, setColumnWidth] = useState<number | null>(null);
  const planCard = (plan: WeeklyPlan) => (
    <MenuView
      key={plan.id}
      shouldOpenOnLongPress
      // A MenuView is a native host that sizes itself to its content, so the
      // card took the summary's unwrapped width and ran off the screen. It is
      // handed the measured column width instead, as WaterTile does.
      style={{ width: columnWidth ?? '100%' }}
      actions={[
        ...(plan.is_active
          ? []
          : [
              {
                id: 'active',
                title: t('weeklyPlans.makeActive', {
                  defaultValue: 'Make active',
                }),
                image: 'checkmark.circle' as const,
              },
            ]),
        {
          id: 'delete',
          title: t('common.delete', { defaultValue: 'Delete' }),
          image: 'trash' as const,
          attributes: { destructive: true },
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        fireSelectionHaptic();
        if (nativeEvent.event === 'active')
          void setActiveWeeklyPlan(plan.id).then(refresh);
        if (nativeEvent.event === 'delete')
          void deleteWeeklyPlan(plan.id).then(refresh);
      }}
    >
      <WeeklyPlanCard
        plan={plan}
        active={plan.is_active}
        width={columnWidth ?? '100%'}
        onPress={() => navigation.navigate('WeeklyPlan', { planId: plan.id })}
      />
    </MenuView>
  );

  const manualCard = (plan: MealPlanTemplate) => (
    <Pressable
      key={plan.id}
      accessibilityRole="button"
      onPress={() => {
        fireSelectionHaptic();
        navigation.navigate('MealPlanForm', { template: plan });
      }}
      className="bg-surface rounded-2xl p-4 gap-1"
    >
      <View className="flex-row items-center gap-2">
        <Text
          className="text-text-primary text-lg font-semibold flex-1"
          numberOfLines={1}
        >
          {plan.plan_name}
        </Text>
        {plan.is_active ? (
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: accent }}
          >
            <Text className="text-white text-xs font-bold">
              {t('mealPlans.active', { defaultValue: 'Active' })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-text-secondary text-sm">
        {t('weeklyPlans.manualSummary', {
          defaultValue: 'Built by you · {{count}} items',
          defaultValue_one: 'Built by you · {{count}} item',
          defaultValue_other: 'Built by you · {{count}} items',
          count: plan.assignments.length,
        })}
      </Text>
    </Pressable>
  );

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
        <View className="bg-surface rounded-2xl p-5 gap-3">
          <View className="flex-row items-center gap-3">
            <Icon name="sparkles" size={26} color={accent} />
            <Text className="text-text-primary text-xl font-bold flex-1">
              {t('weeklyPlans.heroTitle', {
                defaultValue: 'Plan a week of meals',
              })}
            </Text>
          </View>
          <Text className="text-text-secondary">
            {t('weeklyPlans.heroBody', {
              defaultValue:
                'Answer a few questions about your kitchen, budget and tastes. MarkAI plans 7 days you can shop for in one go. In Croatia it uses real store prices, updated daily.',
            })}
          </Text>
          <Button onPress={() => openQuestionnaire(true)}>
            {session
              ? t('weeklyPlans.create', {
                  defaultValue: 'Create meal plan · {{coins}} coins',
                  coins: MEAL_PLAN_COINS,
                })
              : t('weeklyPlans.signIn', {
                  defaultValue: 'Sign in to plan with MarkAI',
                })}
          </Button>
        </View>

        <SettingsRowGroup>
          <SettingsRow
            icon="food"
            title={t('groceries.preferences', {
              defaultValue: 'My food & kitchen preferences',
            })}
            subtitle={t('weeklyPlans.preferencesHint', {
              defaultValue: 'Diet, allergies, budget, region and appliances',
            })}
            onPress={() => openQuestionnaire(false)}
          />
        </SettingsRowGroup>

        {isLoading ? <ActivityIndicator /> : null}
        {manualPlans.length > 0 ? (
          <View className="gap-3">
            <Text className="text-text-primary text-xl font-bold">
              {t('weeklyPlans.manualPlans', { defaultValue: 'Built by you' })}
            </Text>
            {manualPlans.map(manualCard)}
          </View>
        ) : null}
        {plans.length > 0 ? (
          <View
            className="gap-3"
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setColumnWidth((current) =>
                current === width ? current : width
              );
            }}
          >
            <Text className="text-text-primary text-xl font-bold">
              {t('weeklyPlans.yourPlans', { defaultValue: 'Your plans' })}
            </Text>
            {plans.map(planCard)}
            <Text className="text-text-muted text-xs text-center">
              {t('weeklyPlans.longPressHint', {
                defaultValue:
                  'Touch and hold a plan to make it active or delete it.',
              })}
            </Text>
          </View>
        ) : !isLoading ? (
          <Text className="text-text-secondary text-center">
            {t('weeklyPlans.empty', {
              defaultValue: 'Your meal plans will appear here.',
            })}
          </Text>
        ) : null}
        {plans.some((plan) => plan.prices === 'cijene') ? (
          <Text className="text-text-muted text-xs text-center">
            {t('weeklyPlans.attribution', {
              defaultValue: 'Croatian prices: cijene.dev, updated daily.',
            })}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
