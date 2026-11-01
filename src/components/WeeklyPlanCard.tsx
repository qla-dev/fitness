import { Pressable, Text, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { regionName } from '../constants/regions';
import { fireSelectionHaptic } from '../services/haptics';
import { planMoney, type PlannedWeek } from '../services/weeklyPlans';

/**
 * A MarkAI week as the Meal plans list shows it: title, summary, weekly cost,
 * region and whether it was priced from store prices. MarkAI's reply that
 * planned the week embeds the same card.
 */
export default function WeeklyPlanCard({
  plan,
  active,
  width,
  disabled,
  onPress,
}: {
  plan: PlannedWeek;
  active?: boolean;
  /** A MenuView host sizes itself to its content; the list hands it its column width. */
  width?: DimensionValue;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [accent, green, muted] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
    '--color-text-muted',
  ]) as string[];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      className="bg-surface rounded-2xl p-4 gap-2"
      style={[
        width === undefined ? null : { width },
        active ? { borderWidth: 2, borderColor: accent } : null,
      ]}
    >
      <View className="flex-row items-center gap-2">
        <Text
          className="text-text-primary text-lg font-semibold flex-1"
          numberOfLines={1}
        >
          {plan.title}
        </Text>
        {active ? (
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
      {plan.summary ? (
        <Text className="text-text-secondary" numberOfLines={2}>
          {plan.summary}
        </Text>
      ) : null}
      <View className="flex-row items-center gap-2 flex-wrap">
        <Text className="text-text-primary font-semibold">
          {t('weeklyPlans.perWeek', {
            defaultValue: '{{amount}} / week',
            amount: planMoney(plan.weekly_cost, plan.currency),
          })}
        </Text>
        <Text style={{ color: muted }}>·</Text>
        <Text className="text-text-secondary text-sm">
          {regionName(t, plan.region)}
        </Text>
        <Text style={{ color: muted }}>·</Text>
        <Text
          className="text-sm"
          style={{ color: plan.prices === 'cijene' ? green : muted }}
        >
          {plan.prices === 'cijene'
            ? t('weeklyPlans.livePrices', { defaultValue: 'Store prices' })
            : t('weeklyPlans.estimated', { defaultValue: 'Estimated' })}
        </Text>
      </View>
    </Pressable>
  );
}
