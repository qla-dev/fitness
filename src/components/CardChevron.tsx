import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';

/**
 * The drill-in affordance in a dashboard card's top-right corner.
 *
 * Deliberately the same object as the sync button on the Activity Rings card —
 * same 24pt box, same 18pt glyph, same muted tint — so a card that opens
 * somewhere and a card that refreshes something read as the same kind of
 * control rather than two unrelated buttons that happen to share a corner.
 */
export default function CardChevron({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const textMuted = useCSSVariable('--color-text-muted') as string;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={12}
      className="w-6 h-6 items-center justify-center"
    >
      <Icon name="chevron-forward" size={18} color={textMuted} />
    </Pressable>
  );
}
