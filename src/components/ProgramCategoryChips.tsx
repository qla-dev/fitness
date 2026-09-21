import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import LiquidGlassSurface from './LiquidGlassSurface';
import {
  PROGRAM_CATEGORIES,
  getProgramCategoryLabel,
} from '../constants/exercisePrograms';
import type { ProgramCategoryId } from '../types/exerciseProgram';

/** Pill height, matching the system's own filter chips. */
const CHIP_HEIGHT = 36;
const GUTTER = 16;

/**
 * The store's category filter, lifted out of {@link ProgramStore} so it can
 * live in the screen header beside the search field rather than scrolling
 * away with the shelves it filters.
 */
const ProgramCategoryChips: React.FC<{
  category: ProgramCategoryId | null;
  onChange: (category: ProgramCategoryId | null) => void;
}> = ({ category, onChange }) => {
  const { t } = useTranslation();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;

  /**
   * One category pill, as Liquid Glass.
   *
   * Selection is a tint on the material rather than a solid fill swapped in
   * behind it, so a chosen chip is still the same piece of glass as the ones
   * beside it. Off iOS 26 the tint becomes that flat fill, which is the look
   * these had everywhere before.
   */
  const chip = (id: ProgramCategoryId | null, label: string) => {
    const selected = category === id;
    return (
      <LiquidGlassSurface
        key={id ?? 'all'}
        isInteractive
        tintColor={selected ? accentPrimary : undefined}
        style={{
          height: CHIP_HEIGHT,
          borderRadius: CHIP_HEIGHT / 2,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => onChange(selected && id !== null ? null : id)}
          className="h-full px-4 items-center justify-center"
        >
          <Text
            className={`text-sm font-semibold ${
              selected ? 'text-accent-text' : 'text-text-primary'
            }`}
          >
            {label}
          </Text>
        </TouchableOpacity>
      </LiquidGlassSurface>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
      // Directly under the search field, which is what they filter: close
      // enough to read as one control, with no gap of their own on top.
      className="pb-3"
    >
      {chip(null, t('programs.allCategories', { defaultValue: 'All' }))}
      {PROGRAM_CATEGORIES.map((id) => chip(id, getProgramCategoryLabel(t, id)))}
    </ScrollView>
  );
};

export default ProgramCategoryChips;
