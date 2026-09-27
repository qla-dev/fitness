import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import NativePromptSheet from './ui/NativePromptSheet';
import Icon from './Icon';
import { useOnlineAccount } from '../services/online/account';
import { useAppLocale, formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';

const PACKAGES = [
  { coins: 100, price: 2.99 },
  { coins: 500, price: 9.99 },
] as const;

export default function CoinPackagesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const balance = useOnlineAccount(
    (state) => state.session?.user.ai_coins ?? 0
  );
  const [selected, setSelected] = useState(500);
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <NativePromptSheet
      open={open}
      onClose={onClose}
      category={t('markai.title', { defaultValue: 'MarkAI' })}
      title={t('coins.title', { defaultValue: 'A little more room to ask.' })}
      description={t('coins.description', {
        defaultValue:
          'Food, daily metrics and training help. One coin for each MarkAI reply.',
      })}
      footnote={t('coins.preview', {
        defaultValue:
          'Preview packages and sample prices. Purchases are not available yet.',
      })}
      footerLabel={t('common.done', { defaultValue: 'Done' })}
      onFooterPress={onClose}
    >
      <View className="gap-5">
        <View className="items-center gap-2">
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
          {PACKAGES.map((pack) => {
            const active = selected === pack.coins;
            return (
              <Pressable
                key={pack.coins}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  fireSelectionHaptic();
                  setSelected(pack.coins);
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
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(pack.price)}
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
    </NativePromptSheet>
  );
}
