import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import PromptScreen from '../components/ui/PromptScreen';
import Icon, { type IconName } from '../components/Icon';
import {
  refreshOnlineAccount,
  useOnlineAccount,
} from '../services/online/account';
import { formatLocalizedNumber } from '../localization';
import { COIN_PRODUCTS } from '../services/purchases/products';
import type { RootStackScreenProps } from '../types/navigation';

/** Matches fitness.markai_free_daily, for a session saved before the backend sent it. */
const DEFAULT_FREE_DAILY = 5;

/**
 * MarkAI usage, opened from the history header: today's free messages and the
 * paid credits behind them, each as a bar. A modal route on PromptScreen, like
 * GoalEdit; Buy credits opens the CoinPackages paywall.
 */
export default function MarkaiUsageScreen({
  navigation,
}: RootStackScreenProps<'MarkaiUsage'>) {
  const { t } = useTranslation();
  const user = useOnlineAccount((state) => state.session?.user);
  const [accent, coin] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-amber',
  ]) as string[];

  // The stored session can be a day old; ask for today's numbers on open.
  useEffect(() => {
    void refreshOnlineAccount();
  }, []);

  const limit = user?.free_messages?.limit ?? DEFAULT_FREE_DAILY;
  const freeLeft = Math.max(0, limit - (user?.free_messages?.used ?? 0));
  const credits = user?.ai_coins ?? 0;
  // Credits have no ceiling; the bar reads against the largest bundle.
  const creditScale = Math.max(
    credits,
    COIN_PRODUCTS[COIN_PRODUCTS.length - 1].coins
  );

  return (
    <PromptScreen
      headerTitle={t('markai.title', { defaultValue: 'MarkAI' })}
      title={t('markaiUsage.title', { defaultValue: 'Usage' })}
      description={t('markaiUsage.description', {
        defaultValue:
          'Free messages are used first each day. After that, each MarkAI reply uses one credit.',
      })}
      footerLabel={t('markaiUsage.buy', { defaultValue: 'Buy credits' })}
      footerTint={accent}
      onFooterPress={() => navigation.navigate('CoinPackages')}
      topAligned
    >
      <View className="gap-3">
        <UsageCard
          icon="sparkles"
          tint={accent}
          title={t('markaiUsage.freeTitle', {
            defaultValue: 'Free messages today',
          })}
          value={t('markaiUsage.freeValue', {
            defaultValue: '{{left}} of {{limit}} left',
            left: formatLocalizedNumber(freeLeft),
            limit: formatLocalizedNumber(limit),
          })}
          note={t('markaiUsage.freeNote', {
            defaultValue: 'Resets every day.',
          })}
          progress={limit ? freeLeft / limit : 0}
        />
        <UsageCard
          icon="ai-coin"
          tint={coin}
          title={t('markaiUsage.paidTitle', { defaultValue: 'Paid credits' })}
          value={t('markaiUsage.paidValue', {
            count: credits,
            defaultValue: '{{count}} credits',
            defaultValue_one: '{{count}} credit',
            defaultValue_other: '{{count}} credits',
          })}
          note={t('markaiUsage.paidNote', {
            defaultValue: 'Never expire. A full macro plan uses 10.',
          })}
          progress={creditScale ? credits / creditScale : 0}
        />
      </View>
    </PromptScreen>
  );
}

function UsageCard({
  icon,
  tint,
  title,
  value,
  note,
  progress,
}: {
  icon: IconName;
  tint: string;
  title: string;
  value: string;
  note: string;
  progress: number;
}) {
  const track = useCSSVariable('--color-border-subtle') as string;
  return (
    <View className="bg-surface rounded-3xl p-4 gap-3">
      <View className="flex-row items-center gap-3">
        <Icon name={icon} size={20} color={tint} />
        <Text className="text-text-primary text-base font-semibold flex-1">
          {title}
        </Text>
        <Text className="text-text-primary text-base font-bold">{value}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(progress * 100),
        }}
        className="rounded-full overflow-hidden"
        style={{ height: 8, backgroundColor: track }}
      >
        <View
          className="rounded-full"
          style={{
            height: 8,
            width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
            backgroundColor: tint,
          }}
        />
      </View>
      <Text className="text-text-secondary text-sm">{note}</Text>
    </View>
  );
}
