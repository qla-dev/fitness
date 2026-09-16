import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';

type PillInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  ref?: React.Ref<TextInput>;
  value: string;
  onChangeText: (value: string) => void;
  /** Suffix shown inside the pill, e.g. "kg". */
  unit?: string;
  /**
   * Validation message shown under the pill. Pass `reserveErrorSpace` where
   * the message can come and go while typing, so the line is always laid out
   * and the content below never jumps.
   */
  error?: string;
  reserveErrorSpace?: boolean;
};

const ERROR_LINE_HEIGHT = 20;

/**
 * Rounded single-value input used by the profile editor and the setup wizard:
 * surface pill, optional unit suffix, and a clear button while it has text.
 */
export default function PillInput({
  ref,
  value,
  onChangeText,
  unit,
  error,
  reserveErrorSpace = false,
  editable = true,
  style,
  ...inputProps
}: PillInputProps) {
  const { t } = useTranslation();
  const [textSecondary, danger] = useCSSVariable([
    '--color-text-secondary',
    '--color-icon-danger',
  ]) as [string, string];
  const inputRef = React.useRef<TextInput>(null);
  React.useImperativeHandle(ref, () => inputRef.current as TextInput);

  const pill = (
    <View
      className="bg-surface flex-row items-center"
      style={{
        height: 52,
        borderRadius: 26,
        paddingLeft: 18,
        paddingRight: 10,
        // Always bordered so flagging an error never changes the pill's size.
        borderWidth: 1,
        borderColor: error ? danger : 'transparent',
      }}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={textSecondary}
        editable={editable}
        className="flex-1 h-full text-text-primary"
        style={[{ fontSize: 17 }, style]}
        {...inputProps}
      />
      {unit ? (
        <Text className="text-text-secondary ml-2" style={{ fontSize: 15 }}>
          {unit}
        </Text>
      ) : null}
      {value.length > 0 && editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clear', { defaultValue: 'Clear' })}
          hitSlop={8}
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
          className="bg-raised rounded-full items-center justify-center ml-2"
          style={{ width: 22, height: 22 }}
        >
          <Icon name="close" size={13} color={textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );

  // One stable tree whether or not a message shows, so the TextInput is never
  // remounted (and never loses focus) when validation flips.
  return (
    <View>
      {pill}
      {(error || reserveErrorSpace) && (
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          numberOfLines={1}
          className="text-icon-danger text-sm"
          style={{
            height: ERROR_LINE_HEIGHT,
            lineHeight: ERROR_LINE_HEIGHT,
            marginTop: 6,
            paddingHorizontal: 18,
          }}
        >
          {error ?? ''}
        </Text>
      )}
    </View>
  );
}
