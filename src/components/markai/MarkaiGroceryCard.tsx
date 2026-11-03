import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import Button from '../ui/Button';
import type { GroceryProposal } from '../../services/online/markai';

/** How many items the card lists before it says how many more there are. */
const PREVIEW = 6;

/**
 * A shopping list MarkAI proposed, under its reply, in the goal card's shape:
 * what is on it at a glance and one button that saves it to My lists.
 */
export default function MarkaiGroceryCard({
  grocery,
  disabled,
  onSave,
}: {
  grocery: GroceryProposal;
  disabled: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const shown = grocery.items.slice(0, PREVIEW);
  const more = grocery.items.length - shown.length;
  return (
    <View className="bg-surface rounded-2xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Icon name="cart" size={24} color={accent} />
        <Text
          className="text-text-primary text-lg font-semibold flex-1"
          numberOfLines={1}
        >
          {grocery.name}
        </Text>
      </View>
      <View className="gap-1.5">
        {shown.map((item, index) => (
          <View key={`${item.name}-${index}`} className="flex-row gap-3">
            <Text className="text-text-primary flex-1" numberOfLines={1}>
              {item.name}
            </Text>
            {item.quantity ? (
              <Text className="text-text-secondary">{item.quantity}</Text>
            ) : null}
          </View>
        ))}
        {more > 0 ? (
          <Text className="text-text-secondary">
            {t('markai.groceryCard.more', {
              defaultValue: '+{{count}} more',
              count: more,
            })}
          </Text>
        ) : null}
      </View>
      <Button disabled={disabled} onPress={onSave}>
        {t('markai.groceryCard.save', {
          defaultValue: 'Save as grocery list',
        })}
      </Button>
    </View>
  );
}
