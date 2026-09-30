import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import PromptScreen from '../components/ui/PromptScreen';
import Icon from '../components/Icon';
import { useOnlineAccount } from '../services/online/account';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic, fireSuccessHaptic } from '../services/haptics';
import { COIN_PRODUCTS } from '../services/purchases/products';
import {
  buyCoins,
  PurchaseCancelledError,
  purchasesAvailable,
} from '../services/purchases/revenueCat';
import { priceLabel, useStorePrices } from '../hooks/usePurchases';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * AI coin packages: a modal route on PromptScreen, like GoalEdit. Buying
 * goes through the store and RevenueCat; the backend verifies it and adds
 * the coins, and the balance above updates from its answer.
 */
export default function CoinPackagesScreen({
  navigation,
}: RootStackScreenProps<'CoinPackages'>) {
  const { t } = useTranslation();
  const balance = useOnlineAccount(
    (state) => state.session?.user.ai_coins ?? 0
  );
  const prices = useStorePrices();
  const canSell = purchasesAvailable();
  const [selected, setSelected] = useState<string>(
    COIN_PRODUCTS[COIN_PRODUCTS.length - 1].productId
  );
  const [buying, setBuying] = useState(false);
  const buy = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await buyCoins(selected);
      fireSuccessHaptic();
      navigation.goBack();
    } catch (error) {
      if (!(error instanceof PurchaseCancelledError))
        Alert.alert(
          t('coins.failedTitle', { defaultValue: 'Purchase not completed' }),
          error instanceof Error ? error.message : String(error)
        );
    } finally {
      setBuying(false);
    }
  };
  const pack =
    COIN_PRODUCTS.find((item) => item.productId === selected) ??
    COIN_PRODUCTS[0];
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <PromptScreen
      headerTitle={t('markai.title', { defaultValue: 'MarkAI' })}
      title={t('coins.title', { defaultValue: 'A little more room to ask.' })}
      description={t('coins.description', {
        defaultValue:
          'Food, daily metrics and training help. One coin for each MarkAI reply.',
      })}
      footnote={
        canSell
          ? t('coins.oneTime', {
              defaultValue:
                'A one-time purchase. Coins stay on your account and never expire.',
            })
          : t('coins.unavailable', {
              defaultValue: 'Purchases are not available in this version yet.',
            })
      }
      footerLabel={
        canSell
          ? t('coins.buy', {
              defaultValue: 'Buy {{coins}} coins · {{price}}',
              coins: formatLocalizedNumber(pack.coins),
              price: priceLabel(prices, pack.productId, pack.listPrice),
            })
          : t('common.done', { defaultValue: 'Done' })
      }
      onFooterPress={canSell ? () => void buy() : () => navigation.goBack()}
      footerLoading={buying}
      dismissDisabled={buying}
      topAligned
    >
      <View className="flex-1 pb-5">
        {/* The balance takes the room above the packages, centred in it. */}
        <View className="flex-1 items-center justify-center gap-2">
          <Icon name="sparkles" size={36} color={accent} />
          <Text className="text-text-primary text-xl font-semibold">
            {t('online.balance', {
              defaultValue: '{{amount}} AI coins',
              amount: formatLocalizedNumber(balance),
            })}
          </Text>
          <Text className="text-text-secondary text-sm">
            {t('coins.currentBalance', {
              defaultValue: 'Your current balance',
            })}
          </Text>
        </View>
        <View className="flex-row gap-3" accessibilityRole="radiogroup">
          {COIN_PRODUCTS.map((pack) => {
            const active = selected === pack.productId;
            return (
              <Pressable
                key={pack.productId}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  fireSelectionHaptic();
                  setSelected(pack.productId);
                }}
                className="flex-1 bg-surface rounded-3xl p-4 gap-3"
                style={{
                  borderWidth: 2,
                  borderColor: active ? accent : 'transparent',
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Icon name="sparkles" size={22} color={accent} />
                  <Icon
                    name={
                      active ? 'checkmark-circle-filled' : 'checkmark-circle'
                    }
                    size={22}
                    color={active ? accent : undefined}
                  />
                </View>
                <Text className="text-text-primary text-3xl font-bold">
                  {formatLocalizedNumber(pack.coins)}
                </Text>
                <Text className="text-text-secondary text-sm">
                  {t('coins.unit', { defaultValue: 'AI coins' })}
                </Text>
                <Text className="text-text-primary text-xl font-semibold">
                  {priceLabel(prices, pack.productId, pack.listPrice)}
                </Text>
                <Text className="text-text-secondary text-xs">
                  {pack.coins === 500
                    ? t('coins.bestValue', { defaultValue: 'Best value' })
                    : t('coins.starter', { defaultValue: 'A small top-up' })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </PromptScreen>
  );
}
