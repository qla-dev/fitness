import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { getLocales } from 'expo-localization';
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
} from '../services/setupWizardSession';
import {
  onlineRequest,
  refreshOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';
import type { MarkaiReply } from '../services/online/markai';
import { withList, type SetupAnswers } from '../services/personalSetup';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/ui/Button';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { blankGroceryList } from '../services/personalSetup';
import type {
  RootStackParamList,
  RootStackScreenProps,
} from '../types/navigation';
import { formatLocalizedNumber } from '../localization';
import { listTotal } from '../services/online/prices';
import { planMoney } from '../services/weeklyPlans';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';
import FooterCTA from '../components/ui/FooterCTA';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';

export default function CartScreen(props: RootStackScreenProps<'Cart'>) {
  // Ties the scroll view to the footer, so with Liquid Glass the action sits
  // over the scroll edge effect instead of a filled band.
  return (
    <ScrollEdgeEffectProvider>
      <CartContent {...props} />
    </ScrollEdgeEffectProvider>
  );
}

function CartContent({ route }: RootStackScreenProps<'Cart'>) {
  const edgeEffectRef = useScrollEdgeEffectRef();
  const [footerHeight, setFooterHeight] = useState(88);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const padding = useActiveWorkoutBarPadding('stack');
  const setup = usePersonalSetup();
  const [archived, setArchived] = useState(false);
  const state = setup.state;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Each list is its own pushed screen, so it slides in natively.
  const openList = (listId: string) =>
    navigation.navigate('GroceryList', { listId });
  const newList = () =>
    navigation.navigate('GroceryList', { draft: blankGroceryList() });

  // The AI list: the meal plan's food and kitchen questionnaire, then MarkAI
  // writes a week's shopping list straight from the answers. It is saved
  // and opened here, without a chat or a meal plan in between.
  const client = useQueryClient();
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
  const [generating, setGenerating] = useState(false);
  const answered = useRef<SetupAnswers | null>(null);
  const generate = async (answers: SetupAnswers) => {
    setGenerating(true);
    try {
      const response = await onlineRequest<{
        id: string;
        reply: MarkaiReply;
      }>('/markai/messages', {
        id: randomUUID(),
        conversation_id: randomUUID(),
        mode: 'macros',
        prompt: t('groceries.aiPrompt', {
          defaultValue:
            'Make me a grocery list for one week from my food and kitchen answers, and return it as a grocery list: {{answers}}',
          answers: JSON.stringify(answers),
        }).slice(0, 6000),
        label: t('groceries.aiNew', {
          defaultValue: 'New AI grocery list',
        }),
        language: (getLocales()[0]?.languageTag ?? 'en').slice(0, 12),
      });
      void refreshOnlineAccount();
      const grocery = response.reply.grocery;
      if (!grocery?.items.length) {
        Alert.alert(
          t('groceries.aiFailed', {
            defaultValue: 'MarkAI could not make a list this time.',
          }),
          response.reply.text
        );
        return;
      }
      await setup.save((current) =>
        withList(current, {
          ...blankGroceryList(),
          id: response.id,
          name: grocery.name,
          items: grocery.items.map((item, index) => ({
            id: `${response.id}-${index}`,
            name: item.name,
            quantity: item.quantity ?? '',
            checked: false,
          })),
        })
      );
      navigation.navigate('GroceryList', { listId: response.id });
    } catch (error) {
      Alert.alert(
        t('groceries.aiFailed', {
          defaultValue: 'MarkAI could not make a list this time.',
        }),
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setGenerating(false);
    }
  };
  const newAiList = () => {
    if (generating || !setup.state || isSetupWizardOpen()) return;
    if (!session) {
      navigation.navigate('OnlineAccount');
      return;
    }
    answered.current = null;
    openSetupWizardSession({
      steps: grocerySteps(t, vendorsFor),
      initial: setup.state.grocery,
      // Answers already given open on their review, ready to go.
      ...(setup.state.groceryDone
        ? {
            openOnReview: true,
            finishLabel: t('groceries.aiMake', {
              defaultValue: 'Make my list',
            }),
          }
        : null),
      onSave: async (answers, done) => {
        await setup.save((current) => ({
          ...current,
          grocery: answers,
          groceryDone: done,
        }));
        if (done) answered.current = answers;
      },
      onClose: () => {
        if (answered.current) void generate(answered.current);
      },
    });
    navigation.navigate('SetupWizard');
  };
  // The Food dashboard's card asks for a blank list: it lands on one, with
  // the list of lists behind it for Back.
  const openedBlank = useRef(false);
  useEffect(() => {
    if (!route.params?.newList || openedBlank.current) return;
    openedBlank.current = true;
    navigation.navigate('GroceryList', { draft: blankGroceryList() });
  }, [navigation, route.params?.newList]);
  const header = useScreenHeader({
    variant: 'transparent',
    title: t('cart.title', { defaultValue: 'Meals' }),
    left: { kind: 'back' },
    // A list written by hand; the footer makes one with MarkAI.
    right: {
      kind: 'icon',
      sfSymbol: 'plus',
      ionicon: 'add',
      accessibilityLabel: t('groceries.newList', { defaultValue: 'New list' }),
      onPress: newList,
    },
  });
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: native ? 0 : insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        ref={edgeEffectRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // No top padding: the header carries the gap above the content.
          paddingHorizontal: 20,
          paddingBottom: footerHeight + padding + 12,
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
            {/* On the screen itself, not in a card. */}
            <View className="mb-6">
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
              <Button
                variant="secondary"
                onPress={() => navigation.navigate('WeeklyPlans')}
              >
                {t('groceries.planMeals', {
                  defaultValue: 'Plan meals for the week',
                })}
              </Button>
            </View>
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
                    onPress={() => openList(list.id)}
                    className="bg-surface rounded-2xl p-5"
                    style={{ width: '47%' }}
                  >
                    <Text className="text-text-primary text-lg font-semibold mb-2">
                      {list.name}
                    </Text>
                    <Text className="text-text-secondary">{list.store}</Text>
                    {listTotal(list) !== null ? (
                      <Text className="text-text-primary font-semibold mt-1">
                        {planMoney(
                          listTotal(list) ?? 0,
                          list.currency ?? 'EUR'
                        )}
                      </Text>
                    ) : null}
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
          </>
        )}
      </NativeHeaderScrollView>
      {/* The AI list is the screen's main action; a blank list is the +. */}
      <FooterCTA
        absolute
        glass
        edgeEffect
        onHeightChange={setFooterHeight}
        label={t('groceries.aiNew', { defaultValue: 'New AI grocery list' })}
        loading={generating}
        disabled={generating}
        onPress={newAiList}
      />
    </View>
  );
}
