import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import Button from './ui/Button';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';
import { planMoney } from '../services/weeklyPlans';
import type { VendorQuote } from '../services/online/prices';

/**
 * What one cart costs at every store of its region, to pick where to buy
 * it. The stores and their totals arrive after the screen opens, so it
 * shows the cart at plan prices first and the comparison as it lands.
 * `selected` null is the plan's own typical prices, before any store.
 */
export default function ShopComparison({
  quotes,
  loading,
  error,
  onRetry,
  itemCount,
  planTotal,
  currency,
  selected,
  onSelect,
}: {
  quotes: VendorQuote[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Items in the cart that carry a plan price. */
  itemCount: number;
  planTotal: number | null;
  currency: string;
  selected: string | null;
  onSelect: (quote: VendorQuote | null) => void;
}) {
  const { t } = useTranslation();
  const [accent, green, muted] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
    '--color-text-muted',
  ]) as string[];
  const cheapest = quotes?.[0]?.code;
  const money = (amount: number | null) =>
    amount === null ? '—' : planMoney(amount, currency);
  const radio = (on: boolean) => (
    <Icon
      name={on ? 'radio-button-on' : 'radio-button-off'}
      size={22}
      color={on ? accent : muted}
    />
  );
  const trailing = (total: string, on: boolean) => (
    <View className="flex-row items-center gap-3">
      <Text className="text-text-primary text-base font-semibold">{total}</Text>
      {radio(on)}
    </View>
  );

  return (
    <View className="gap-4">
      <SettingsRowGroup>
        <SettingsRow
          title={t('shopComparison.planPrices', {
            defaultValue: 'Typical prices',
          })}
          subtitle={t('shopComparison.planPricesHint', {
            defaultValue: 'What the meal plan was priced at, before a store.',
          })}
          subtitleNumberOfLines={0}
          onPress={() => onSelect(null)}
          rightAccessory={trailing(money(planTotal), selected === null)}
          accessibilityLabel={`${t('shopComparison.planPrices', {
            defaultValue: 'Typical prices',
          })}, ${money(planTotal)}`}
        />
      </SettingsRowGroup>

      {loading ? (
        <View className="flex-row items-center gap-3 px-1">
          <ActivityIndicator />
          <Text className="text-text-secondary">
            {t('shopComparison.loading', {
              defaultValue: 'Comparing stores…',
            })}
          </Text>
        </View>
      ) : error ? (
        <View className="gap-3">
          <Text accessibilityRole="alert" className="text-text-secondary">
            {t('shopComparison.error', {
              defaultValue: 'Store prices could not be loaded.',
            })}
          </Text>
          <Button variant="secondary" onPress={onRetry}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </View>
      ) : !quotes?.length ? (
        <Text className="text-text-secondary px-1">
          {t('shopComparison.none', {
            defaultValue:
              'Store prices are not published for this region, so the list keeps its typical prices.',
          })}
        </Text>
      ) : (
        <SettingsRowGroup
          title={t('shopComparison.stores', { defaultValue: 'Stores' })}
        >
          {quotes.map((quote) => {
            const on = selected === quote.code;
            const coverage = t('shopComparison.matched', {
              defaultValue: '{{matched}} of {{total}} items at store prices',
              matched: quote.matched,
              total: itemCount,
            });
            return (
              <SettingsRow
                key={quote.code}
                title={quote.name}
                subtitle={
                  <View className="flex-row items-center gap-2">
                    {quote.code === cheapest ? (
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: green }}
                      >
                        {t('shopComparison.cheapest', {
                          defaultValue: 'Cheapest',
                        })}
                      </Text>
                    ) : null}
                    <Text
                      className="text-sm text-text-secondary flex-shrink"
                      numberOfLines={1}
                    >
                      {coverage}
                    </Text>
                  </View>
                }
                onPress={() => onSelect(quote)}
                rightAccessory={trailing(money(quote.total), on)}
                accessibilityLabel={`${quote.name}, ${money(quote.total)}, ${coverage}`}
                accessibilityHint={
                  on
                    ? t('shopComparison.selected', {
                        defaultValue: 'Selected',
                      })
                    : undefined
                }
              />
            );
          })}
        </SettingsRowGroup>
      )}
    </View>
  );
}
