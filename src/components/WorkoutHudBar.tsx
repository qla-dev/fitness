import { type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useCSSVariable } from 'uniwind';

import LiquidGlassSurface, {
  createLiquidGlassPillStyle,
} from './LiquidGlassSurface';
import { withAlpha } from '../utils/colors';

export const WORKOUT_HUD_BAR_HEIGHT = 60;
const PROGRESS_BAR_BOTTOM_OFFSET = 1;

type WorkoutHudBarProps = {
  /** 0–1. The inset bar under the content row. */
  progress: number;
  leftButton: ReactNode;
  rightButton: ReactNode;
  onCenterPress?: () => void;
  centerAccessibilityLabel?: string;
  topStatusLine: string | null;
  primaryLine: string;
  secondaryLine: string;
  /** Tabular figures beside the right control: the rest countdown, a clock. */
  trailingLabel: string | null;
  /**
   * `dark` pins the glass and the text to dark whatever the theme, for a bar
   * floating over a map or a camera rather than over the app's own surfaces.
   */
  colorScheme?: 'auto' | 'dark';
  style?: ViewStyle;
};

/**
 * The compact workout pill: a control either side, stacked status lines in
 * the middle, an optional trailing clock and a progress bar inset along the
 * bottom. Liquid Glass on iOS 26+, the flat chrome fallback elsewhere.
 *
 * Presentational — the caller builds the buttons and the lines, so the
 * strength HUD and the run/ride recorder share the shape without sharing
 * their state.
 */
export default function WorkoutHudBar({
  progress,
  leftButton,
  rightButton,
  onCenterPress,
  centerAccessibilityLabel,
  topStatusLine,
  primaryLine,
  secondaryLine,
  trailingLabel,
  colorScheme = 'auto',
  style,
}: WorkoutHudBarProps) {
  const [accentPrimary, chromeBorder, progressTrack] = useCSSVariable([
    '--color-accent-primary',
    '--color-chrome-border',
    '--color-progress-track',
  ]) as [string, string, string];
  const dark = colorScheme === 'dark';
  // The theme's text tokens follow the app theme, which is wrong on a surface
  // forced dark: near-black text on dark glass in the light theme.
  const primaryText = dark ? { color: '#FFF' } : null;
  const secondaryText = dark ? { color: 'rgba(255,255,255,0.6)' } : null;

  return (
    <LiquidGlassSurface
      style={createLiquidGlassPillStyle(chromeBorder, {
        height: WORKOUT_HUD_BAR_HEIGHT,
        position: 'relative',
        ...style,
      })}
      colorScheme={colorScheme}
      glassEffectStyle="regular"
      isInteractive
    >
      <View className="flex-row items-center px-2" style={{ flex: 1 }}>
        <View className="w-10 items-center">{leftButton}</View>

        <Pressable
          onPress={onCenterPress}
          disabled={!onCenterPress}
          className="px-1"
          style={{
            alignItems: 'center',
            flex: 1,
            height: '100%',
            justifyContent: 'center',
          }}
          accessibilityRole={onCenterPress ? 'button' : undefined}
          accessibilityLabel={centerAccessibilityLabel}
        >
          {topStatusLine != null && (
            <Text
              numberOfLines={1}
              className="text-center text-sm font-semibold text-text-primary"
              style={[{ lineHeight: 16 }, primaryText]}
            >
              {topStatusLine}
            </Text>
          )}
          <Text
            numberOfLines={1}
            className={
              topStatusLine != null
                ? 'text-center text-xs text-text-primary'
                : 'text-center text-sm font-semibold text-text-primary'
            }
            style={[
              { lineHeight: topStatusLine != null ? 14 : 16 },
              primaryText,
            ]}
          >
            {primaryLine}
          </Text>
          {secondaryLine.length > 0 && (
            <Text
              numberOfLines={1}
              className="text-center text-xs text-text-secondary"
              style={[{ lineHeight: 14 }, secondaryText]}
            >
              {secondaryLine}
            </Text>
          )}
        </Pressable>

        {trailingLabel != null && (
          <Text
            className="px-2 text-lg font-bold text-text-primary"
            style={[{ fontVariant: ['tabular-nums'] }, primaryText]}
          >
            {trailingLabel}
          </Text>
        )}

        <View className="w-10 items-center">{rightButton}</View>
      </View>

      {/* Inset into the glass surface. Width is the only dynamic value; the
          colours still track the active theme. */}
      <View
        pointerEvents="none"
        className="absolute inset-x-4 h-[3px] overflow-hidden rounded-full"
        style={{
          bottom: PROGRESS_BAR_BOTTOM_OFFSET,
          backgroundColor: withAlpha(progressTrack, 0.78),
        }}
      >
        <View
          className="h-[3px]"
          style={{
            width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
            backgroundColor: withAlpha(accentPrimary, 0.92),
          }}
        />
      </View>
    </LiquidGlassSurface>
  );
}
