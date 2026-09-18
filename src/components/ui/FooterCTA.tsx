import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Button from './Button';
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
  /** Reports the footer's height, for callers that pad a scroll view by it. */
  onHeightChange?: (height: number) => void;
}) {
  const bottomInset = useOptionalBottomInset();

  const bar = (
    <View
      className="px-5 pt-3 bg-background border-t border-border"
      style={{ paddingBottom: footerCtaRestingPadding(bottomInset) }}
      onLayout={
        onHeightChange
          ? (event) => onHeightChange(event.nativeEvent.layout.height)
          : undefined
      }
    >
      <Button
        loading={loading}
        disabled={disabled}
        onPress={() => {
          fireSelectionHaptic();
          onPress();
        }}
      >
        {label}
      </Button>
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
