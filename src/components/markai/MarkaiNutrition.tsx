import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import Icon, { type IconName } from '../Icon';
import type { FoodProposal } from '../../services/online/markai';

/**
 * A food card's calories and macros as four icon chips, each tinted with the
 * colour the tracker uses for that nutrient so the card reads like the rest of
 * the app rather than a line of abbreviations.
 */
export default function MarkaiNutrition({ food }: { food: FoodProposal }) {
  const { t } = useTranslation();
  const [calories, protein, carbs, fat] = useCSSVariable([
    '--color-calories',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
  ]) as [string, string, string, string];
  const items: {
    key: string;
    icon: IconName;
    color: string;
    value: string;
    label: string;
  }[] = [
    {
      key: 'calories',
      icon: 'flame',
      color: calories,
      value: t('markai.kcal', {
        defaultValue: '{{value}} kcal',
        value: food.calories,
      }),
      label: t('markai.caloriesLabel', { defaultValue: 'Calories' }),
    },
    {
      key: 'protein',
      icon: 'fish',
      color: protein,
      value: t('markai.grams', { defaultValue: '{{value}} g', value: food.protein }),
      label: t('markai.proteinLabel', { defaultValue: 'Protein' }),
    },
    {
      key: 'carbs',
      icon: 'leaf',
      color: carbs,
      value: t('markai.grams', { defaultValue: '{{value}} g', value: food.carbs }),
      label: t('markai.carbsLabel', { defaultValue: 'Carbs' }),
    },
    {
      key: 'fat',
      icon: 'hydration',
      color: fat,
      value: t('markai.grams', { defaultValue: '{{value}} g', value: food.fat }),
      label: t('markai.fatLabel', { defaultValue: 'Fat' }),
    },
  ];
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {items.map((item) => (
        <View
          key={item.key}
          accessible
          accessibilityLabel={`${item.label} ${item.value}`}
          className="flex-1 bg-raised rounded-xl items-center"
          style={{ paddingVertical: 10, gap: 4 }}
        >
          <Icon name={item.icon} size={18} color={item.color} />
          <Text
            className="text-text-primary font-semibold"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 15 }}
          >
            {item.value}
          </Text>
          <Text className="text-text-muted" style={{ fontSize: 11 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
