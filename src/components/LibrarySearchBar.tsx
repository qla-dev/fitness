import React, { useState } from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import LiquidGlassSurface from './LiquidGlassSurface';
import { useLiquidGlassActive } from '../services/nativeTabBarPreference';

/**
 * The borderless search field's text box. iOS sizes a padding-free
 * single-line TextInput to the font's line box, which is shorter than the
 * glyphs' ascent plus descent, so the placeholder sat low and its descenders
 * were clipped. A fixed height lets UITextField centre the text in room it
 * actually fits in. Centred by the font's metrics, lowercase text still read
 * low beside the search glyph, so the bottom padding lifts it 1pt. Shared by
 * every search row that draws its own field.
 */
export const SEARCH_INPUT_STYLE = {
  fontSize: 16,
  height: 23,
  paddingTop: 0,
  paddingBottom: 2,
  paddingHorizontal: 0,
  includeFontPadding: false,
} as const;

interface LibrarySearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isSearching?: boolean;
  /**
   * Render the field as Liquid Glass rather than a filled row. For a search
   * box that floats in a transparent header: the material reacts to whatever
   * scrolls under it, and `isInteractive` gives it the bounce iOS 26 puts on
   * glass controls. Off iOS 26 this falls back to the filled row.
   */
  glass?: boolean;
  /** Fires on the keyboard's search key, for a field that opens results. */
  onSubmitEditing?: () => void;
  /** Fires when the field takes focus, for a screen that changes with it. */
  onFocus?: () => void;
  testID?: string;
  /**
   * A fixed-height, fully rounded field without the outer padding, for a row
   * of controls it has to line up with (the Food dashboard's bottom bar).
   */
  height?: number;
}

const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  isSearching = false,
  glass = false,
  onSubmitEditing,
  onFocus,
  testID,
  height,
}) => {
  const [accentColor, textMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];
  const [isFocused, setIsFocused] = useState(false);

  const glassActive = useLiquidGlassActive();
  const usesGlass = glass && glassActive;

  const field = (
    <View
      className={`flex-row items-center rounded-lg px-3 py-2${
        usesGlass ? '' : ' bg-raised'
      }`}
      style={{
        borderWidth: 1,
        borderColor: isFocused ? accentColor : 'transparent',
        ...(height
          ? {
              height,
              borderRadius: height / 2,
              paddingVertical: 0,
              paddingHorizontal: 18,
            }
          : null),
      }}
    >
      <Icon name="search" size={18} color={textMuted} />
      <View className="flex-1 ml-2">
        <TextInput
          className="text-text-primary"
          style={SEARCH_INPUT_STYLE}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
          testID={testID}
        />
      </View>
      {isSearching ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : null}
    </View>
  );

  return (
    <View className={height ? '' : 'px-4 pb-3'}>
      {usesGlass ? (
        <LiquidGlassSurface
          isInteractive
          style={{ borderRadius: 10, overflow: 'hidden' }}
        >
          {field}
        </LiquidGlassSurface>
      ) : (
        field
      )}
    </View>
  );
};

export default LibrarySearchBar;
