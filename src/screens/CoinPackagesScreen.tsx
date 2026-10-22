import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import PromptScreen from '../components/ui/PromptScreen';
import Icon, { type IconName } from '../components/Icon';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic, fireSuccessHaptic } from '../services/haptics';
import { COIN_PRODUCTS } from '../services/purchases/products';
import {
  buyCoins,
  PurchaseCancelledError,
  purchasesAvailable,
} from '../services/purchases/revenueCat';
import { priceLabel, useStorePrices } from '../hooks/usePurchases';
import { withAlpha } from '../utils/colors';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * MarkAI message bundles: a modal route on PromptScreen, like GoalEdit, laid
 * out like the putni-nalozi paywall — what MarkAI covers at a glance, the
 * bundles as radio cards, then what each message buys. One coin is one
 * reply, so the bundles are sold as messages. Buying goes through the store
 * and RevenueCat; the backend verifies it and adds the coins.
 */
export default function CoinPackagesScreen({
  navigation,
}: RootStackScreenProps<'CoinPackages'>) {
  const { t } = useTranslation();
  const prices = useStorePrices();
  const canSell = purchasesAvailable();
  const best = COIN_PRODUCTS[COIN_PRODUCTS.length - 1];
  const [selected, setSelected] = useState<string>(best.productId);
  const [buying, setBuying] = useState(false);
  const [accent, border] = useCSSVariable([
    '--color-accent-primary',
    '--color-border-subtle',
  ]) as string[];
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
    COIN_PRODUCTS.find((item) => item.productId === selected) ?? best;
  const titles = [
    t('coins.tierSmall', { defaultValue: 'START' }),
    t('coins.tierMedium', { defaultValue: 'PLUS' }),
    t('coins.tierLarge', { defaultValue: 'PRO' }),
  ];
  const divider = { height: StyleSheet.hairlineWidth, backgroundColor: border };
  return (
    <PromptScreen
      headerTitle={t('markai.title', { defaultValue: 'MarkAI' })}
      title={t('coins.title', { defaultValue: 'MarkAI, whenever you ask.' })}
      description={t('coins.description', {
        defaultValue:
          'Food logging, macro plans, training help and your daily metrics explained. One message for each MarkAI reply.',
      })}
      footnote={
        canSell
          ? t('coins.oneTime', {
              defaultValue:
                'One-time payment · No subscription · Buy again anytime',
            })
          : t('coins.unavailable', {
              defaultValue: 'Purchases are not available in this version yet.',
            })
      }
      footerLabel={
        canSell
          ? t('coins.buy', {
              defaultValue: 'Buy {{coins}} messages · {{price}}',
              coins: formatLocalizedNumber(pack.coins),
              price: priceLabel(prices, pack.productId, pack.listPrice),
            })
          : t('common.done', { defaultValue: 'Done' })
      }
      footerTint={accent}
      onFooterPress={canSell ? () => void buy() : () => navigation.goBack()}
      footerLoading={buying}
      dismissDisabled={buying}
      topAligned
    >
      <View className="gap-5 pb-5">
        <View style={divider} />
        <View className="flex-row items-center">
          <Capability
            label={t('coins.capFood', { defaultValue: 'FOOD' })}
            icon="food"
            value={t('coins.capFoodValue', { defaultValue: 'Log & macros' })}
            tint={accent}
          />
          <View
            style={[divider, { width: StyleSheet.hairlineWidth, height: 44 }]}
          />
          <Capability
            label={t('coins.capTraining', { defaultValue: 'TRAINING' })}
            icon="exercise-running"
            value={t('coins.capTrainingValue', { defaultValue: 'Moving help' })}
            tint={accent}
          />
          <View
            style={[divider, { width: StyleSheet.hairlineWidth, height: 44 }]}
          />
          <Capability
            label={t('coins.capMetrics', { defaultValue: 'METRICS' })}
            icon="chart-bar"
            value={t('coins.capMetricsValue', { defaultValue: 'Explained' })}
            tint={accent}
          />
        </View>
        <View style={divider} />

        <View>
          <SectionLabel>
            {t('coins.chooseBundle', { defaultValue: 'CHOOSE A BUNDLE' })}
          </SectionLabel>
          <Text className="text-text-muted text-xs mx-1 mb-3">
            {t('coins.bundleIntro', {
              defaultValue:
                'A one-time purchase, no subscription. Your 10 free messages a day are used first.',
            })}
          </Text>
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            {COIN_PRODUCTS.map((item, index) => (
              <BundleCard
                key={item.productId}
                title={titles[index] ?? titles[titles.length - 1]}
                badge={
                  item === best
                    ? t('coins.bestValue', { defaultValue: 'BEST VALUE' })
                    : undefined
                }
                price={priceLabel(prices, item.productId, item.listPrice)}
                messages={item.coins}
                selected={selected === item.productId}
                accent={accent}
                border={border}
                onPress={() => {
                  fireSelectionHaptic();
                  setSelected(item.productId);
                }}
              />
            ))}
          </View>
        </View>

        <View>
          <SectionLabel>
            {t('coins.whatYouGet', { defaultValue: 'WHAT YOU GET' })}
          </SectionLabel>
          <View className="bg-surface rounded-3xl px-4">
            <Feature
              icon="camera"
              tint={accent}
              title={t('coins.featurePhoto', {
                defaultValue: 'Log food from a photo',
              })}
              copy={t('coins.featurePhotoCopy', {
                defaultValue:
                  'Snap a meal and MarkAI estimates the calories and macros for you.',
              })}
            />
            <View style={[divider, { marginLeft: 55 }]} />
            <Feature
              icon="calculator"
              tint={accent}
              title={t('coins.featureMacros', {
                defaultValue: 'Calorie and macro plans',
              })}
              copy={t('coins.featureMacrosCopy', {
                defaultValue:
                  'Daily targets worked out from your body, goal and activity.',
              })}
            />
            <View style={[divider, { marginLeft: 55 }]} />
            <Feature
              icon="exercise-running"
              tint={accent}
              title={t('coins.featureTraining', {
                defaultValue: 'Training help',
              })}
              copy={t('coins.featureTrainingCopy', {
                defaultValue:
                  'Ideas for your next workout and how to move more each day.',
              })}
            />
            <View style={[divider, { marginLeft: 55 }]} />
            <Feature
              icon="chart-bar"
              tint={accent}
              title={t('coins.featureMetrics', {
                defaultValue: 'Your metrics explained',
              })}
              copy={t('coins.featureMetricsCopy', {
                defaultValue:
                  'Sleep, steps, heart rate and nutrition put into plain words.',
              })}
            />
          </View>
        </View>
      </View>
    </PromptScreen>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      className="text-text-muted text-xs font-extrabold mx-1 mb-2"
      style={{ letterSpacing: 0.8 }}
    >
      {children}
    </Text>
  );
}

function Capability({
  label,
  icon,
  value,
  tint,
}: {
  label: string;
  icon: IconName;
  value: string;
  tint: string;
}) {
  return (
    <View className="flex-1 items-center" style={{ gap: 4 }}>
      <Text
        className="text-text-muted font-extrabold"
        style={{ fontSize: 9, letterSpacing: 0.8 }}
      >
        {label}
      </Text>
      <Icon name={icon} size={18} color={tint} />
      <Text className="text-text-primary text-sm font-extrabold">{value}</Text>
    </View>
  );
}

function BundleCard({
  title,
  badge,
  price,
  messages,
  selected,
  accent,
  border,
  onPress,
}: {
  title: string;
  badge?: string;
  price: string;
  messages: number;
  selected: boolean;
  accent: string;
  border: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="flex-1 bg-surface rounded-3xl overflow-hidden"
      style={{
        padding: 12,
        gap: 5,
        borderWidth: 2,
        borderColor: selected ? accent : 'transparent',
      }}
    >
      {badge ? (
        <View
          className="absolute rounded-full"
          style={{
            top: 9,
            right: 8,
            paddingHorizontal: 6,
            paddingVertical: 3,
            backgroundColor: accent,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: '#FFFFFF',
              fontSize: 6.5,
              fontWeight: '900',
              letterSpacing: 0.35,
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 20,
          height: 20,
          borderWidth: 2,
          borderColor: selected ? accent : border,
          marginBottom: 6,
        }}
      >
        {selected ? (
          <View
            className="rounded-full"
            style={{ width: 8, height: 8, backgroundColor: accent }}
          />
        ) : null}
      </View>
      <Text
        className="text-text-primary font-black"
        style={{ fontSize: 11, letterSpacing: 1 }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="font-black"
        style={{ color: accent, fontSize: 20, letterSpacing: -0.5 }}
      >
        {price}
      </Text>
      <Text className="text-text-muted font-bold" style={{ fontSize: 9 }}>
        {t('coins.oneTimeShort', { defaultValue: 'one-time' })}
      </Text>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: border,
          marginVertical: 5,
        }}
      />
      {/* The count on a line of its own, the word under it: the same two
          lines in every card, so a short "50 messages" no longer sits on
          one line beside cards that wrapped. */}
      <View>
        <Text className="text-text-primary font-black" style={{ fontSize: 16 }}>
          {formatLocalizedNumber(messages)}
        </Text>
        <Text
          className="text-text-secondary font-bold"
          style={{ fontSize: 10 }}
        >
          {t('coins.messageUnit', {
            count: messages,
            defaultValue: 'messages',
            defaultValue_one: 'message',
            defaultValue_other: 'messages',
          })}
        </Text>
      </View>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: border,
          marginVertical: 5,
        }}
      />
      <BundleItem
        text={t('coins.neverExpire', { defaultValue: 'Never expire' })}
        accent={accent}
      />
    </Pressable>
  );
}

function BundleItem({ text, accent }: { text: string; accent: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      <Icon name="checkmark" size={11} color={accent} />
      <Text
        className="text-text-secondary font-bold flex-1"
        style={{ fontSize: 10, lineHeight: 13 }}
      >
        {text}
      </Text>
    </View>
  );
}

function Feature({
  icon,
  tint,
  title,
  copy,
}: {
  icon: IconName;
  tint: string;
  title: string;
  copy: string;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{ gap: 13, paddingVertical: 14 }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: withAlpha(tint, 0.1),
        }}
      >
        <Icon name={icon} size={20} color={tint} />
      </View>
      <View className="flex-1">
        <Text className="text-text-primary text-sm font-extrabold">
          {title}
        </Text>
        <Text
          className="text-text-muted mt-1"
          style={{ fontSize: 12, lineHeight: 16 }}
        >
          {copy}
        </Text>
      </View>
    </View>
  );
}
