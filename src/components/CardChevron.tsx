import { Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';

/**
 * The drill-in affordance in a dashboard card's top-right corner.
 *
 * Deliberately the same object as the sync button on the Activity Rings card —
 * same 24pt box, same 18pt glyph, same muted tint — so a card that opens
 * somewhere and a card that refreshes something read as the same kind of
 * control rather than two unrelated buttons that happen to share a corner.
 *
 * Without `onPress` it is drawn flat, for the usual case: the whole card is
 * the target (`CardPressable`) and the chevron is there to say so. Nesting a
 * second pressable inside that one would fire two haptics for one tap and give
 * the card a 24pt hole that behaves subtly differently from the rest of it.
 */
export default function CardChevron({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const textMuted = useCSSVariable('--color-text-muted') as string;
  const glyph = <Icon name="chevron-forward" size={18} color={textMuted} />;

  if (!onPress)
    return <View className="w-6 h-6 items-center justify-center">{glyph}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={12}
      className="w-6 h-6 items-center justify-center"
    >
      {glyph}
    </Pressable>
  );
}
