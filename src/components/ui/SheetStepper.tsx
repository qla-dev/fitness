import { Pressable, Text, View } from 'react-native';

import type { ReactNode } from 'react';

import Icon from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';
import { withAlpha } from '../../utils/colors';

/** The round mark above the number, and the gap it keeps from it. */
const BADGE_SIZE = 88;
const BADGE_GAP = 28;
const STEP_BUTTON_SIZE = 68;

/** One round stepper. Its own component so a re-render does not remount it. */
function StepButton({
  icon,
  label,
  tint,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  tint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    // Tinted glass, like the footer action and the tab bar: the fill is still
    // the control's colour, the material is what responds to the press. With
    // no Liquid Glass the surface falls back to that same flat fill.
    <LiquidGlassSurface
      isInteractive
      tintColor={tint}
      style={{
        width: STEP_BUTTON_SIZE,
        height: STEP_BUTTON_SIZE,
        borderRadius: STEP_BUTTON_SIZE / 2,
        overflow: 'hidden',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        className="flex-1 items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.7 : 1 })}
      >
        <Icon name={icon} size={30} color="#FFF" />
      </Pressable>
    </LiquidGlassSurface>
  );
}

/**
 * The control at the middle of a {@link NativePromptSheet}: down, the number,
 * up.
 *
 * Three columns, each centring its own contents, so the number and its unit
 * can grow to two lines without the buttons sliding up the sheet with them.
 *
 * The badge is positioned **out of flow**, above the row. Laid out in the
 * column it would be part of what gets centred, which pushed the number below
 * the middle of the sheet by half the badge's height — the number is the thing
 * the eye goes to, so the number is what has to sit in the middle.
 */
export default function SheetStepper({
  value,
  unit,
  badge,
  tint,
  decrementLabel,
  incrementLabel,
  decrementDisabled = false,
  incrementDisabled = false,
  onDecrement,
  onIncrement,
}: {
  /** Already formatted for the locale — this only renders it. */
  value: string;
  unit?: string;
  /**
   * Mark above the number, saying which sheet this is — the app's own drawn
   * glyph, the same one the Tracker's ring carries, not a system symbol. An
   * element rather than a component type: the water bottle takes a fill level
   * the macro glyphs have no use for.
   */
  badge?: ReactNode;
  tint: string;
  decrementLabel: string;
  incrementLabel: string;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View>
      {badge ? (
        <View
          pointerEvents="none"
          className="items-center"
          style={{ position: 'absolute', left: 0, right: 0, top: -BADGE_GAP }}
        >
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              marginTop: -BADGE_SIZE,
              backgroundColor: withAlpha(tint, 0.12),
            }}
          >
            {badge}
          </View>
        </View>
      ) : null}

      <View className="flex-row items-stretch justify-between">
        <View className="justify-center">
          <StepButton
            icon="remove"
            label={decrementLabel}
            tint={tint}
            disabled={decrementDisabled}
            onPress={onDecrement}
          />
        </View>
        <View className="flex-1 justify-center items-center px-2">
          <Text
            className="text-text-primary text-center"
            style={{ fontSize: 68, fontWeight: '300' }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          {unit ? (
            <Text className="text-text-secondary text-center text-base font-semibold mt-2 uppercase">
              {unit}
            </Text>
          ) : null}
        </View>
        <View className="justify-center">
          <StepButton
            icon="add"
            label={incrementLabel}
            tint={tint}
            disabled={incrementDisabled}
            onPress={onIncrement}
          />
        </View>
      </View>
    </View>
  );
}
