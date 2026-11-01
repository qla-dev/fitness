import { forwardRef, useEffect, useRef } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  type TextInputInstance,
} from 'react-native';
import { useCSSVariable } from 'uniwind';

import { scheduleAndroidImeShowRetry } from '../utils/keyboardFocus';
import {
  INPUT_FILL_CLASS,
  INPUT_FONT_SIZE,
  INPUT_HEIGHT,
  INPUT_MULTILINE_RADIUS,
  INPUT_PADDING_LEFT,
  INPUT_RADIUS,
} from './ui/inputStyle';

/**
 * Ellipsized overlay that echoes a single-line input's value while it is
 * unfocused. An unfocused iOS TextInput wraps overflowing text instead of
 * clipping it (facebook/react-native#29068), so a long value breaks after
 * "https://" and the single-line height hides the rest. Render this as a
 * sibling over the input, make the input's own text transparent while
 * unfocused, and match the input's text padding via `style`.
 */
export const UnfocusedInputEcho = ({
  focused,
  value,
  style,
}: {
  focused: boolean;
  value: string;
  style?: StyleProp<ViewStyle>;
}) => {
  if (focused || !value) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 justify-center"
      style={style}
    >
      <Text
        className="text-text-primary"
        style={{ fontSize: INPUT_FONT_SIZE, lineHeight: 22 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

type FormInputProps = Omit<TextInputProps, 'placeholderTextColor'> & {
  placeholderTextColor?: string;
};

/**
 * Themed TextInput with explicit padding to fix iOS text alignment.
 * Drop-in replacement for TextInput — accepts all TextInput props.
 */
const FormInput = forwardRef<TextInputInstance, FormInputProps>(
  (
    { className = '', style, placeholderTextColor, onFocus, onBlur, ...props },
    ref
  ) => {
    const textMuted = useCSSVariable('--color-text-muted') as string;

    const innerRef = useRef<TextInputInstance>(null);
    const { autoFocus } = props;

    // autoFocus takes focus natively as the view attaches, which on Android
    // can leave the keyboard behind (see scheduleAndroidImeShowRetry) — back
    // it up the same way the tap-to-edit activation effects do.
    useEffect(() => {
      if (!autoFocus) return;
      return scheduleAndroidImeShowRetry(innerRef);
    }, [autoFocus]);

    return (
      <TextInput
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        // The shared field look (see inputStyle): a borderless pill.
        className={`${INPUT_FILL_CLASS} text-text-primary ${className}`}
        placeholderTextColor={placeholderTextColor ?? textMuted}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[
          {
            minHeight: INPUT_HEIGHT,
            borderRadius: props.multiline
              ? INPUT_MULTILINE_RADIUS
              : INPUT_RADIUS,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: INPUT_PADDING_LEFT,
            paddingRight: INPUT_PADDING_LEFT,
            fontSize: INPUT_FONT_SIZE,
            lineHeight: 22,
          },
          style,
        ]}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
