import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import Button from '../ui/Button';
import { formatLocalizedNumber } from '../../localization';
import type { GoalProposal } from '../../services/online/markai';

/**
 * A goal MarkAI worked out, under its reply: one goal (calories, protein,
 * carbs, fat) or the whole macro plan. Applying is the user's call: from the
 * questionnaire it applies there, elsewhere it opens the goal filled in.
 */
export default function MarkaiGoalCard({
  goal,
  disabled,
  onApply,
}: {
  goal: GoalProposal;
  disabled: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const number = (value: number) => formatLocalizedNumber(Math.round(value));
  const kcal = (value: number) =>
    t('markai.goalCard.value', {
      defaultValue: '{{value}} kcal',
      value: number(value),
    });
  const grams = (value: number) =>
    t('markai.goalCard.grams', {
      defaultValue: '{{value}} g',
      value: number(value),
    });

  const title =
    goal.key === 'macros'
      ? t('markai.goalCard.macros', { defaultValue: 'Daily macro goals' })
      : goal.key === 'protein'
        ? t('markai.goalCard.protein', { defaultValue: 'Daily protein goal' })
        : goal.key === 'carbs'
          ? t('markai.goalCard.carbs', { defaultValue: 'Daily carbs goal' })
          : goal.key === 'fat'
            ? t('markai.goalCard.fat', { defaultValue: 'Daily fat goal' })
            : t('markai.goalCard.calories', {
                defaultValue: 'Daily calorie goal',
              });

  return (
    <View className="bg-surface rounded-2xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Icon
          name={goal.key === 'calories' ? 'flame' : 'food'}
          size={24}
          color={accent}
        />
        <Text className="text-text-primary text-lg font-semibold">{title}</Text>
      </View>
      {goal.key === 'macros' ? (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {(
            [
              [
                t('nutrients.calories', { defaultValue: 'Calories' }),
                kcal(goal.values.calories),
              ],
              [
                t('nutrients.protein', { defaultValue: 'Protein' }),
                grams(goal.values.protein),
              ],
              [
                t('nutrients.carbs', { defaultValue: 'Carbs' }),
                grams(goal.values.carbs),
              ],
              [
                t('nutrients.fat', { defaultValue: 'Fat' }),
                grams(goal.values.fat),
              ],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={{ width: '48%' }}>
              <Text className="text-text-secondary text-sm">{label}</Text>
              <Text className="text-text-primary text-2xl font-bold">
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-text-primary text-3xl font-bold">
          {goal.key === 'calories' ? kcal(goal.value) : grams(goal.value)}
        </Text>
      )}
      <Text className="text-text-secondary">
        {t('markai.goalCard.hint', {
          defaultValue:
            'Worked out by MarkAI from your details. Check it fits you before you apply it.',
        })}
      </Text>
      <Button disabled={disabled} onPress={onApply}>
        {goal.key === 'macros'
          ? t('markai.goalCard.applyAll', {
              defaultValue: 'Apply to my goals',
            })
          : t('markai.goalCard.apply', { defaultValue: 'Apply to my goal' })}
      </Button>
    </View>
  );
}
