import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import PromptScreen from '../components/ui/PromptScreen';
import ShopComparison from '../components/ShopComparison';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { regionName } from '../constants/regions';
import { withList } from '../services/personalSetup';
import {
  applyVendor,
  compareList,
  comparisonQueryKey,
  listTotal,
} from '../services/online/prices';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * Where to buy a grocery list: a modal route on PromptScreen, like GoalEdit,
 * holding the ShopComparison. `add` is a list a meal plan just composed,
 * saved at the chosen store and then opened; `pick` changes the store of a
 * list being edited and hands the repriced list back to it.
 *
 * Opens at once on the cart's plan total; the stores are fetched and priced
 * behind it.
 */
export default function ShopComparisonScreen({
  navigation,
  route,
}: RootStackScreenProps<'ShopComparison'>) {
  const { t } = useTranslation();
  const { list, mode } = route.params;
  const setup = usePersonalSetup();
  const currency = list.currency ?? 'EUR';
  const comparison = useQuery({
    queryKey: comparisonQueryKey(list),
    queryFn: () => compareList(list),
    enabled: !!list.region,
    staleTime: 10 * 60 * 1000,
  });
  const quotes = comparison.data?.vendors;
  // The list's own store, else the one named in the questionnaire, matched
  // by code or name so answers saved before stores were live still count.
  const preferred = String(setup.state?.grocery.store ?? '').toLowerCase();
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const selected =
    picked !== undefined
      ? picked
      : (list.vendor ??
        quotes?.find(
          (quote) =>
            quote.code === preferred || quote.name.toLowerCase() === preferred
        )?.code ??
        null);
  const quote = quotes?.find((item) => item.code === selected) ?? null;
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const priced = applyVendor(list, quote);
    if (mode === 'pick') {
      navigation.popTo('GroceryList', { pickedList: priced }, { merge: true });
      return;
    }
    setSaving(true);
    try {
      await setup.save((state) => withList(state, priced));
      navigation.goBack();
      navigation.navigate('GroceryList', { listId: priced.id });
    } catch {
      Alert.alert(
        t('setup.saveError', {
          defaultValue:
            'Could not save. Your answers are still here. Please try again.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const itemCount = list.items.filter(
    (item) => typeof (item.basePrice ?? item.price) === 'number'
  ).length;

  return (
    <PromptScreen
      headerTitle={t('shopComparison.header', { defaultValue: 'Groceries' })}
      title={t('shopComparison.title', { defaultValue: 'Where to shop' })}
      description={
        list.region
          ? t('shopComparison.description', {
              defaultValue:
                'Your cart of {{count}} items at every store in {{region}}.',
              defaultValue_one:
                'Your cart of {{count}} item at every store in {{region}}.',
              count: list.items.length,
              region: regionName(t, list.region),
            })
          : undefined
      }
      footnote={
        comparison.data?.price_date
          ? t('shopComparison.footnote', {
              defaultValue:
                'Store averages from {{date}} (cijene.dev). Items a store does not list keep their typical price.',
              date: comparison.data.price_date,
            })
          : undefined
      }
      footerLabel={
        mode === 'pick'
          ? quote
            ? t('shopComparison.use', {
                defaultValue: 'Shop at {{store}}',
                store: quote.name,
              })
            : t('shopComparison.useTypical', {
                defaultValue: 'Use typical prices',
              })
          : t('weeklyPlans.addToList', { defaultValue: 'Add to grocery list' })
      }
      onFooterPress={() => void commit()}
      footerLoading={saving}
      // A store is preselected before its prices land; committing then
      // would quietly fall back to typical prices.
      footerDisabled={
        (mode === 'add' && !setup.state) || (selected !== null && !quote)
      }
      topAligned
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ShopComparison
          quotes={quotes}
          loading={comparison.isLoading}
          error={comparison.isError}
          onRetry={() => void comparison.refetch()}
          itemCount={itemCount}
          planTotal={listTotal(applyVendor(list, null))}
          currency={currency}
          selected={selected}
          onSelect={(next) => setPicked(next?.code ?? null)}
        />
      </ScrollView>
    </PromptScreen>
  );
}
