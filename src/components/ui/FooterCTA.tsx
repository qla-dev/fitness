import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import Button from './Button';
import LiquidGlassSurface from '../LiquidGlassSurface';
import { canUseLiquidGlass } from '../../utils/liquidGlass';
import { fireSelectionHaptic } from '../../services/haptics';

/** The gap under the button once the keyboard has taken the space below it. */
const KEYBOARD_UP_PADDING = 12;

/**
 * A little air under the button when nothing is pressing up against it.
 *
 * At rest only: with the keyboard up the gap is already as tight as it should
 * be, and the trim below gives this back, so raising the keyboard does not
 * leave the button floating.
 */
const RESTING_EXTRA = 5;

/** Bottom padding with no keyboard: the home indicator, plus that air. */
const footerCtaRestingPadding = (bottomInset: number): number =>
  Math.max(bottomInset, KEYBOARD_UP_PADDING) + RESTING_EXTRA;

/**
 * How much bottom padding the footer gives back when the keyboard is up.
 *
 * Exported because a scrolling caller needs the same number to keep a focused
 * field the right distance above the (now shorter) footer.
 */
export const footerCtaKeyboardTrim = (bottomInset: number): number =>
  footerCtaRestingPadding(bottomInset) - KEYBOARD_UP_PADDING;

/**
 * The bottom inset, or zero where there is no provider to ask.
 *
 * `useSafeAreaInsets` throws without one, and a bottom sheet is exactly that
 * case on iOS: it is portaled into its own host outside the app's
 * `SafeAreaProvider`. Zero is the right answer there anyway — the sheet
 * already holds itself clear of the home indicator.
 */
function useOptionalBottomInset(): number {
  return useContext(SafeAreaInsetsContext)?.bottom ?? 0;
}

/**
 * The single action at the foot of a form, riding the keyboard.
 *
 * Closed, it pads for the home indicator. Opened, the offset trims that
 * padding to 12 so the button sits 12 above the keyboard, matching the 12
 * above it. Getting that pair right is fiddly enough that having it written
 * twice guarantees the two drift — which is exactly what happened before this
 * existed, leaving a band of dead space under one of them.
 */
export default function FooterCTA({
  label,
  onPress,
  disabled,
  loading,
  absolute = false,
  sticky = true,
  glass = false,
  onHeightChange,
}: {
  label: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Lifts the footer out of the flow, for a screen whose content scrolls
   * underneath it. A flex column that already ends with this leaves it off.
   */
  absolute?: boolean;
  /**
   * Whether the footer rides the keyboard itself. False inside a bottom sheet:
   * the sheet already lifts for the keyboard, and a sticky view lifting again
   * on top of that threw the footer to the top of the sheet.
   */
  sticky?: boolean;
  /**
   * Renders the action as an interactive glass capsule rather than a filled
   * button — the same material and press response as the tab bar. Ignored
   * where Liquid Glass is unavailable, which keeps Android and older iOS on
   * the filled button instead of a flat grey imitation of glass.
   */
  glass?: boolean;
  /** Reports the footer's height, for callers that pad a scroll view by it. */
  onHeightChange?: (height: number) => void;
}) {
  const bottomInset = useOptionalBottomInset();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const usesGlass = glass && canUseLiquidGlass();

  const press = () => {
    fireSelectionHaptic();
    onPress();
  };

  const action = usesGlass ? (
    // Tinted rather than clear: the action keeps its accent fill and white
    // label, and the glass only adds the material and the press response.
    <LiquidGlassSurface
      isInteractive
      tintColor={accent}
      style={{ borderRadius: 999, overflow: 'hidden' }}
    >
      <Button
        variant="ghost"
        className="rounded-full"
        textClassName="text-white"
        loading={loading}
        disabled={disabled}
        onPress={press}
      >
        {label}
      </Button>
    </LiquidGlassSurface>
  ) : (
    <Button loading={loading} disabled={disabled} onPress={press}>
      {label}
    </Button>
  );

  const bar = (
    <View
      // The glass capsule separates itself from the content by its own
      // material, so the rule above it is one line too many.
      className={`px-5 pt-3 bg-background ${usesGlass ? '' : 'border-t border-border'}`}
      style={{ paddingBottom: footerCtaRestingPadding(bottomInset) }}
      onLayout={
        onHeightChange
          ? (event) => onHeightChange(event.nativeEvent.layout.height)
          : undefined
      }
    >
      {action}
    </View>
  );

  if (!sticky) return bar;

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: footerCtaKeyboardTrim(bottomInset) }}
      style={
        absolute
          ? { position: 'absolute', bottom: 0, left: 0, right: 0 }
          : undefined
      }
    >
      {bar}
    </KeyboardStickyView>
  );
}
