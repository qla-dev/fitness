import type { ReactNode } from 'react';
import {
  Pressable,
  useColorScheme,
  type AccessibilityRole,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import { withAlpha } from '../../utils/colors';

/**
 * Diameter of the circle. 44 is the platform touch minimum and what
 * `TabHeader` already reserves per button, so swapping the bare touchables
 * for this changes nothing in the bar's metrics.
 */
export const HEADER_CIRCLE_SIZE = 44;

/**
 * The header button off Liquid Glass: a 44 pt circle with a faint fill and a
 * hairline ring, pressed state as a slight dim and a 1 px sink. Same recipe as
 * the strip in Predah's StoryDetail, which stood in for the glass pill on
 * Android there; this one also has a light-theme reading so it sits on this
 * app's white chrome.
 *
 * On iOS 26 with Liquid Glass the native header draws its own material, so
 * neither `useScreenHeader` nor `TabHeader` reaches this on that path — it
 * only ever renders where the screen owns its header (Android, and iOS with
 * the toggle off), which is exactly where the bare icons floated in space.
 *
 * Deliberately not `LiquidGlassSurface`: that wraps `GlassView` for pills
 * and cards and already has callers relying on its fallback painting the
 * chrome colour flat. A header button wants a translucent tint over
 * whatever the header sits on, not an opaque chip.
 */
export default function HeaderCircleButton({
  children,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  hitSlop,
  style,
  testID,
  appearance,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  hitSlop?: Insets | number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * `dark`: the button sits on content that is black whatever the theme, so
   * it takes the dark recipe on a white base rather than reading the theme,
   * whose light-mode text colour is navy and disappears there.
   */
  appearance?: 'dark';
}) {
  const scheme = useColorScheme();
  const textPrimary = useCSSVariable('--color-text-primary') as string;
  // Tint from the foreground colour, not a fixed white: on the light theme a
  // white-on-white fill is invisible and the ring reads as a smudge. Dark
  // keeps Predah's exact numbers, light uses the same structure at a
  // strength that shows on the near-white chrome.
  const forcedDark = appearance === 'dark';
  const dark = forcedDark || scheme === 'dark';
  const base = forcedDark ? '#FFFFFF' : textPrimary;
  const fill = withAlpha(base, dark ? 0.08 : 0.05);
  const ring = withAlpha(base, dark ? 0.06 : 0.1);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop ?? 6}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        {
          width: HEADER_CIRCLE_SIZE,
          height: HEADER_CIRCLE_SIZE,
          borderRadius: HEADER_CIRCLE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fill,
          borderWidth: 1,
          borderColor: ring,
        },
        pressed && { opacity: 0.82, transform: [{ translateY: 1 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
