import { Text, TouchableOpacity, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import {
  INPUT_FILL_CLASS,
  INPUT_FONT_SIZE,
  INPUT_HEIGHT,
  INPUT_PADDING_LEFT,
  INPUT_RADIUS,
} from './inputStyle';

/**
 * A dropdown trigger drawn as a text field: the same borderless raised pill,
 * height, padding and type as FormInput, with a chevron at the end. Used as a
 * picker's `renderTrigger`, so a unit or type choice beside a number field
 * reads as one more field rather than a bordered box of its own.
 */
export default function SelectField({
  label,
  placeholder = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  /** The current value, or the placeholder text when nothing is picked. */
  label: string;
  /** Draw `label` in the placeholder colour. */
  placeholder?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const textMuted = useCSSVariable('--color-text-muted') as string;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className={`${INPUT_FILL_CLASS} flex-row items-center`}
      style={{
        minHeight: INPUT_HEIGHT,
        borderRadius: INPUT_RADIUS,
        paddingLeft: INPUT_PADDING_LEFT,
        paddingRight: INPUT_PADDING_LEFT,
      }}
    >
      <View className="flex-1 pr-2">
        <Text
          className={placeholder ? 'text-text-muted' : 'text-text-primary'}
          style={{ fontSize: INPUT_FONT_SIZE }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Icon name="chevron-down" size={12} color={textMuted} weight="medium" />
    </TouchableOpacity>
  );
}
