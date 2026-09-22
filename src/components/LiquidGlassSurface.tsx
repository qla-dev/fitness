import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { GlassView, type GlassViewProps } from 'expo-glass-effect';
import { useCSSVariable } from 'uniwind';

import { withAlpha } from '../utils/colors';
import { canUseLiquidGlass } from '../utils/liquidGlass';

export const LIQUID_GLASS_HORIZONTAL_MARGIN = 20;
export const LIQUID_GLASS_VERTICAL_GAP = 6;

/**
 * The fill a chip needs where there is no glass to be its surface.
 *
 * `LiquidGlassSurface`'s own untinted fallback is `--color-chrome`, which is
 * what a bar floating over content wants — and on the true-black dark theme
 * that is black at 90%, so a chip painted with it vanished into the page and
 * only the selected one, which has the accent tint, still read as a control.
 * A chip is not chrome: it sits ON the page and has to lift off it, which is
 * `--color-raised` — the same fill `LibrarySearchBar` drops back to.
 *
 * The hook returns the per-chip function, so a row can call it once and
 * apply it inside its own map. It gives back nothing on the glass path (a
 * background there would cover the material) and nothing for a selected
 * chip, whose tint is already its fill.
 */
export function useGlassChipFill(): (selected: boolean) => ViewStyle | null {
  const raised = useCSSVariable('--color-raised') as string;
  const glass = canUseLiquidGlass();
  return React.useCallback(
    (selected: boolean) =>
      selected || glass ? null : { backgroundColor: raised },
    [glass, raised]
  );
}

export function createLiquidGlassPillStyle(
  chromeBorder: string,
  overrides: ViewStyle = {}
): ViewStyle {
  return {
    marginHorizontal: LIQUID_GLASS_HORIZONTAL_MARGIN,
    marginBottom: LIQUID_GLASS_VERTICAL_GAP,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(chromeBorder, 0.45),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    ...overrides,
  };
}

type LiquidGlassSurfaceProps = ViewProps & {
  colorScheme?: GlassViewProps['colorScheme'];
  glassEffectStyle?: GlassViewProps['glassEffectStyle'];
  isInteractive?: GlassViewProps['isInteractive'];
  /**
   * Colours the glass — how a selected pill is marked without losing the
   * material. Where there is no glass it becomes the flat fill, so the same
   * prop expresses "this one is chosen" on both paths.
   */
  tintColor?: GlassViewProps['tintColor'];
};

const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  colorScheme = 'auto',
  glassEffectStyle = 'regular',
  isInteractive = false,
  tintColor,
  style,
  ...props
}) => {
  const fallbackBackground = useCSSVariable('--color-chrome') as string;

  if (!canUseLiquidGlass()) {
    // Without the material, a forced scheme has to be painted by hand: a
    // surface pinned to `dark` sits over artwork and carries white text, so
    // the theme's chrome (near-white in light mode) rendered that text
    // invisible on Android. A translucent dark scrim keeps the contrast the
    // caller designed for; `light` mirrors it; `auto` keeps following the
    // theme as before.
    const forcedBackground =
      colorScheme === 'dark'
        ? 'rgba(0, 0, 0, 0.55)'
        : colorScheme === 'light'
          ? 'rgba(255, 255, 255, 0.85)'
          : fallbackBackground;
    return (
      <View
        {...props}
        style={[{ backgroundColor: tintColor ?? forcedBackground }, style]}
      />
    );
  }

  return (
    <GlassView
      {...props}
      style={style}
      colorScheme={colorScheme}
      glassEffectStyle={glassEffectStyle}
      isInteractive={isInteractive}
      tintColor={tintColor}
    />
  );
};

export default LiquidGlassSurface;
