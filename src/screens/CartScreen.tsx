import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useQueries, useQueryClient } from '@tanstack/react-query';
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
import { useOnlineAccount } from '../services/online/account';
import type { SetupAnswers } from '../services/personalSetup';
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
  const state = setup.state;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Each list is its own pushed screen, so it slides in natively.
  const openList = (listId: string) =>
    navigation.navigate('GroceryList', { listId });
  const newList = () =>
    navigation.navigate('GroceryList', { draft: blankGroceryList() });

  // The AI list: the meal plan's food and kitchen questionnaire, then MarkAI
  // writes a week's shopping list from the answers in a chat, the way a meal
  // plan is made; the list card there saves it to My lists.
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
  const answered = useRef<SetupAnswers | null>(null);
  const listInChat = (answers: SetupAnswers) =>
    navigation.navigate('MarkAI', {
      preset: {
        prompt: t('groceries.aiPrompt', {
          defaultValue:
            'Make me a grocery list for one week from my food and kitchen answers, and return it as a grocery list: {{answers}}',
          answers: JSON.stringify(answers),
        }).slice(0, 6000),
        label: t('groceries.aiNew', { defaultValue: 'New AI grocery list' }),
        mode: 'macros',
      },
    });
  const newAiList = () => {
    if (!setup.state || isSetupWizardOpen()) return;
    if (!session) {
      navigation.navigate('OnlineAccount');
      return;
    }
    answered.current = null;
    openSetupWizardSession({
      steps: grocerySteps(t, vendorsFor),
      initial: setup.state.grocery,
      // Always from the first question, with the earlier answers filled in:
      // jumping straight to the review skipped every question the user had
      // come to look at.
      ...(setup.state.groceryDone
        ? {
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
        if (answered.current) listInChat(answered.current);
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
              <Text className="text-text-secondary">
                {t('groceries.heroHint', {
                  defaultValue:
                    'Build a sample meal plan around your kitchen, budget and tastes. Or start with a simple list.',
                })}
              </Text>
            </View>
            {/* Every list, archived ones included: there is no archive view
                any more, so hiding them would lose them. */}
            <View className="flex-row flex-wrap gap-3">
              {state?.lists.map((list) => (
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
                      {planMoney(listTotal(list) ?? 0, list.currency ?? 'EUR')}
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
                  <Text numberOfLines={3} className="text-text-secondary mt-2">
                    {list.note}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!state?.lists.length && (
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
        onPress={newAiList}
      />
    </View>
  );
}
