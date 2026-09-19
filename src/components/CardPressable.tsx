import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * A dashboard card whose whole surface opens what its chevron points at.
 *
 * The chevron is a 24pt target in a corner of a card several hundred points
 * wide, which made the obvious gesture — press the card — do nothing. It stays
 * on as the affordance that says the card leads somewhere (see `CardChevron`,
 * which is drawn flat once the card itself is the target), and this carries the
 * press.
 *
 * Without `onPress` it renders a plain `View`, so a card that leads nowhere
 * costs no pressable and gains no accidental feedback.
 */
export default function CardPressable({
  onPress,
  accessibilityLabel,
  className,
  children,
}: {
  onPress?: () => void;
  /** What the card opens, for screen readers. Required once it is pressable. */
  accessibilityLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!onPress) return <View className={className}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={className}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
    >
      {children}
    </Pressable>
  );
}
