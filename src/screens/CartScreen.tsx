import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
      {/* A new list is the screen's one action, pinned like every other
          screen's footer action. */}
      <FooterCTA
        absolute
        glass
        edgeEffect
        onHeightChange={setFooterHeight}
        label={t('groceries.newList', { defaultValue: 'New list' })}
        onPress={newList}
      />
    </View>
  );
}
