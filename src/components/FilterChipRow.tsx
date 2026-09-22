import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from './Icon';
import LiquidGlassSurface, { useGlassChipFill } from './LiquidGlassSurface';
import { fireSelectionHaptic } from '../services/haptics';

/** Pill height, matching the system's own filter chips. */
export const CHIP_HEIGHT = 36;
const GUTTER = 16;

export interface FilterChipOption {
  value: string;
  label: string;
  /** Optional glyph before the label, for a short fixed set of filters. */
  icon?: IconName;
}

/**
 * A horizontal filter row, for a header accessory that sits under the search
 * field it shares a header with.
 *
 * Liquid Glass, like the Store's category pills: selection is a tint ON the
 * material rather than a solid fill swapped in behind it, so a chosen chip is
 * still the same piece of glass as the ones beside it. Off iOS 26 the tint
 * becomes that flat fill.
 *
 * Tapping the selected chip clears it, except for the leading option, which is
 * the unfiltered state and so has nothing to clear.
 */
const FilterChipRow: React.FC<{
  value: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
  /** The option that means "no filter" — re-tapping it does nothing. */
  clearValue: string;
}> = ({ value, options, onChange, clearValue }) => {
  const chipFill = useGlassChipFill();
  const [accentPrimary, accentText, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-accent-text',
    '--color-text-primary',
  ]) as string[];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
      // Directly under the search field, which narrows the same list.
      className="pb-3"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <LiquidGlassSurface
            key={option.value}
            isInteractive
            tintColor={selected ? accentPrimary : undefined}
            style={{
              height: CHIP_HEIGHT,
              borderRadius: CHIP_HEIGHT / 2,
              ...chipFill(selected),
              overflow: 'hidden',
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                fireSelectionHaptic();
                onChange(
                  selected && option.value !== clearValue
                    ? clearValue
                    : option.value
                );
              }}
              className="h-full px-4 flex-row items-center justify-center gap-1.5"
            >
              {option.icon ? (
                <Icon
                  name={option.icon}
                  size={15}
                  color={selected ? accentText : textPrimary}
                />
              ) : null}
              <Text
                className={`text-sm font-semibold ${
                  selected ? 'text-accent-text' : 'text-text-primary'
                }`}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          </LiquidGlassSurface>
        );
      })}
    </ScrollView>
  );
};

/**
 * The same pills, but each one is its own switch rather than one choice out of
 * several. For settings that are independent of each other — trace a route,
 * read the watch — where a segmented control would wrongly imply picking one.
 */
export const ToggleChipRow: React.FC<{
  options: (FilterChipOption & { on: boolean; disabled?: boolean })[];
  onToggle: (value: string) => void;
}> = ({ options, onToggle }) => {
  const chipFill = useGlassChipFill();
  const [accentPrimary, accentText, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-accent-text',
    '--color-text-primary',
  ]) as string[];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
      className="pb-3"
    >
      {options.map((option) => (
        <LiquidGlassSurface
          key={option.value}
          isInteractive
          tintColor={option.on ? accentPrimary : undefined}
          style={{
            height: CHIP_HEIGHT,
            borderRadius: CHIP_HEIGHT / 2,
            ...chipFill(option.on),
            overflow: 'hidden',
            opacity: option.disabled ? 0.5 : 1,
          }}
        >
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{
              checked: option.on,
              disabled: option.disabled,
            }}
            disabled={option.disabled}
            onPress={() => {
              fireSelectionHaptic();
              onToggle(option.value);
            }}
            className="h-full px-4 flex-row items-center justify-center gap-1.5"
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={15}
                color={option.on ? accentText : textPrimary}
              />
            ) : null}
            <Text
              className={`text-sm font-semibold ${
                option.on ? 'text-accent-text' : 'text-text-primary'
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        </LiquidGlassSurface>
      ))}
    </ScrollView>
  );
};

export default FilterChipRow;
