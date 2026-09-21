import React, { useState } from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import LiquidGlassSurface from './LiquidGlassSurface';
import { canUseLiquidGlass } from '../utils/liquidGlass';

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
  testID?: string;
}

const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  isSearching = false,
  glass = false,
  testID,
}) => {
  const [accentColor, textMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];
  const [isFocused, setIsFocused] = useState(false);

  const usesGlass = glass && canUseLiquidGlass();

  const field = (
    <View
      className={`flex-row items-center rounded-lg px-3 py-2.5${
        usesGlass ? '' : ' bg-raised'
      }`}
      style={{
        borderWidth: 1,
        borderColor: isFocused ? accentColor : 'transparent',
      }}
    >
      <Icon name="search" size={18} color={textMuted} />
      <View className="flex-1 ml-2">
        <TextInput
          className="text-text-primary"
          style={{ fontSize: 16, padding: 0, includeFontPadding: false }}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID={testID}
        />
      </View>
      {isSearching ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : null}
    </View>
  );

  return (
    <View className="px-4 pb-3">
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
