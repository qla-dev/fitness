import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * A line of copy with a link at the end of it, introducing what follows.
 *
 * The Tracker carries two of these — one under the title for the macros, one
 * further down for the body measurements — and they have to read as the same
 * kind of thing, because they are: a sentence saying what the next block is
 * for, and one way further in.
 *
 * The subtitle stays on one line and truncates. Its height is part of the
 * screen's chrome, and chrome that grows a line on a long translation pushes
 * everything below it down on that language alone.
 */
export default function SectionIntro({
  subtitle,
  actionLabel,
  onPress,
  className = '',
  testID,
}: {
  subtitle: string;
  /** Omit both to make the line say what the block is for and nothing more. */
  actionLabel?: string;
  onPress?: () => void;
  /**
   * Spacing is the caller's, because the screens space their children
   * differently: the Tracker's scroll view already puts a gap between every
   * child, so a margin here would double it, while Activities has none and
   * needs one.
   */
  className?: string;
  testID?: string;
}) {
  const accentColor = useCSSVariable('--color-accent-primary') as string;

  return (
    <View className={`flex-row items-center ${className}`} testID={testID}>
      <Text
        className="flex-1 text-sm text-text-secondary"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {subtitle}
      </Text>
      {actionLabel && onPress ? (
        <Pressable
          onPress={() => {
            fireSelectionHaptic();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={12}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm font-semibold text-accent-primary">
            {actionLabel}
          </Text>
          <Icon name="chevron-forward" size={12} color={accentColor} />
        </Pressable>
      ) : null}
    </View>
  );
}
