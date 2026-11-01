import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputProps,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

interface StepperDraftOptions {
  /** Committed value, shown whenever the field is not mid-edit. */
  value: number;
  min: number;
  max: number;
  /** Amount the +/- buttons move by. Defaults to 1. */
  step?: number;
  onCommit: (value: number) => void;
  /** Called when an optional field is left empty. Required fields omit this. */
  onClear?: () => void;
}

interface StepperDraftProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

/**
 * Holds keystrokes for a bounded integer field in local state so a partial
 * entry ("2" on the way to "28") is never clamped or pushed to a caller that
 * rejects out-of-range values. In-range text commits as it is typed; anything
 * still out of range is clamped and committed on blur. Empty text restores a
 * required field or invokes the optional field's clear handler.
 */
export function useStepperDraft({
  value,
  min,
  max,
  step = 1,
  onCommit,
  onClear,
}: StepperDraftOptions): StepperDraftProps {
  const [draft, setDraft] = useState<string | null>(null);

  const handleChangeText = (text: string) => {
    if (text !== '' && !/^\d+$/.test(text)) return;
    setDraft(text);
    const parsed = parseInt(text, 10);
    if (
      !Number.isNaN(parsed) &&
      parsed >= min &&
      parsed <= max &&
      parsed !== value
    ) {
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    if (draft === null) return;
    setDraft(null);
    if (draft === '') {
      onClear?.();
      return;
    }
    const parsed = parseInt(draft, 10);
    const clamped = Math.max(min, Math.min(max, parsed));
    if (clamped !== value) onCommit(clamped);
  };

  const adjust = (delta: number) => {
    const parsed = draft === null ? NaN : parseInt(draft, 10);
    const base = Number.isNaN(parsed) ? value : parsed;
    setDraft(null);
    const next = Math.max(min, Math.min(max, base + delta));
    if (next !== value) onCommit(next);
  };

  return {
    value: draft ?? String(value),
    onChangeText: handleChangeText,
    onBlur: handleBlur,
    onIncrement: () => adjust(step),
    onDecrement: () => adjust(-step),
  };
}

interface StepperInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  keyboardType?: 'decimal-pad' | 'number-pad';
  placeholder?: string;
  selectTextOnFocus?: boolean;
  /** Override the TextInput component (e.g., BottomSheetTextInput) */
  InputComponent?: React.ComponentType<any>;
  /** Extra props forwarded to the text input */
  inputProps?: Partial<TextInputProps>;
  /** Ref forwarded to the underlying text input for imperative focus control */
  inputRef?: React.Ref<TextInput>;
  /** Accessibility labels for the decrement, input, and increment controls. */
  accessibilityLabels?: {
    decrement?: string;
    input?: string;
    increment?: string;
  };
  /** Compact size for inline use in set rows */
  compact?: boolean;
  /**
   * Exact control height, overriding the size the variant would pick. For a
   * row where the stepper has to match a button beside it — guessing from
   * padding is what leaves three controls at three heights.
   */
  height?: number;
  /** Width of the − and + segments; defaults to square (the height). */
  buttonWidth?: number;
  /** Width of the number field between them. */
  inputWidth?: number;
}

type TextInputFocusEvent = NativeSyntheticEvent<TextInputFocusEventData>;

function StepperInput({
  value,
  onChangeText,
  onBlur,
  onIncrement,
  onDecrement,
  keyboardType = 'decimal-pad',
  placeholder = '0',
  selectTextOnFocus = true,
  InputComponent = TextInput,
  inputProps,
  inputRef,
  accessibilityLabels,
  compact = false,
  height,
  buttonWidth,
  inputWidth: inputWidthProp,
}: StepperInputProps) {
  const [accentColor, fillColor, buttonColor, inkColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-background',
    '--color-raised',
    '--color-text-primary',
  ]) as [string, string, string, string];
  const [isFocused, setIsFocused] = useState(false);

  const size = height ?? (compact ? 32 : 40);
  const inputWidth = inputWidthProp ?? (compact ? 48 : 56);
  // The round buttons sit inside the pill with a 2pt rim all round.
  const rim = 2;
  const buttonSize = size - rim * 2;
  const segmentWidth = Math.max(buttonSize, (buttonWidth ?? size) - rim * 2);
  const iconSize = compact ? 16 : 18;
  const fontSize = compact ? 16 : 18;

  const {
    onFocus: externalOnFocus,
    onBlur: externalOnBlur,
    ...restInputProps
  } = inputProps ?? {};

  const step = (
    icon: 'add' | 'remove',
    onPress: () => void,
    label: string | undefined
  ) => (
    <Pressable
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: segmentWidth,
        height: buttonSize,
        borderRadius: buttonSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: buttonColor,
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Icon name={icon} size={iconSize} color={inkColor} />
    </Pressable>
  );

  // A pill with round − and + and the value between them: the same control
  // Hideya's rules use, so a stepper reads as one object rather than three
  // bordered boxes. The pill outlines in the accent only while typing.
  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        backgroundColor: fillColor,
        padding: rim,
        borderWidth: 1,
        borderColor: isFocused ? accentColor : 'transparent',
      }}
    >
      {step('remove', onDecrement, accessibilityLabels?.decrement)}
      <InputComponent
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={(e: TextInputFocusEvent) => {
          setIsFocused(true);
          externalOnFocus?.(e);
        }}
        onBlur={(e: TextInputFocusEvent) => {
          setIsFocused(false);
          onBlur?.();
          externalOnBlur?.(e);
        }}
        keyboardType={keyboardType}
        placeholder={placeholder}
        selectTextOnFocus={selectTextOnFocus}
        className="text-text-primary text-center"
        style={{
          width: inputWidth,
          height: buttonSize,
          fontSize,
          lineHeight: fontSize + 2,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          padding: 0,
        }}
        accessibilityLabel={accessibilityLabels?.input}
        {...restInputProps}
      />
      {step('add', onIncrement, accessibilityLabels?.increment)}
    </View>
  );
}

export default React.memo(StepperInput);
