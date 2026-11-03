import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

const SIZE = 26;

/**
 * A grocery item's tick: a selection haptic, the circle popping and filling,
 * and the check mark growing in. Unticking shrinks the mark away again.
 */
export default function GroceryCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  const fill = useSharedValue(checked ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, { duration: 180 });
    if (checked)
      pop.value = withSequence(
        withTiming(0.82, { duration: 80 }),
        withSpring(1, { damping: 9, stiffness: 320 })
      );
  }, [checked, fill, pop]);

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: fill.value > 0.01 ? accent : 'transparent',
    opacity: 1,
  }));
  const mark = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.4 + fill.value * 0.6 }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={10}
      onPress={() => {
        fireSelectionHaptic();
        onToggle();
      }}
    >
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderWidth: 2,
            borderColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
          },
          circle,
        ]}
      >
        <Animated.View style={mark}>
          <Icon name="checkmark" size={15} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
