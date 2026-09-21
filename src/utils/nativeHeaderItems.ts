import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenu,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

/**
 * The iOS native stack header, left to the system.
 *
 * Deliberately names no background. A header painted with an explicit
 * `headerStyle.backgroundColor` replaces the scroll-edge appearance that
 * iOS animates between, which on a large-title screen is the very mechanism
 * that hands the big title in the content off to the inline one in the bar:
 * pinning both appearances to one colour left the bar title missing and the
 * app's transition fighting the system's on every scroll. iOS 26 renders this
 * as Liquid Glass — transparent at the top of the content, glass once
 * something scrolls under it.
 */
export function createIOSNativeHeaderOptions(
  actionTintColor: string,
  titleColor: string = actionTintColor
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerBlurEffect: 'none',
    scrollEdgeEffects: { top: 'hidden' },
    headerTintColor: actionTintColor,
    headerTitleStyle: {
      color: titleColor,
      fontWeight: '600',
    },
    headerLargeTitleStyle: {
      color: titleColor,
      fontWeight: '700',
    },
    animation: 'default',
  };
}

export function createIOSSmallNativeHeaderOptions(
  actionTintColor: string,
  titleColor: string = actionTintColor
): NativeStackNavigationOptions {
  return {
    ...createIOSNativeHeaderOptions(actionTintColor, titleColor),
    headerLargeTitleEnabled: false,
  };
}

export function createNativeHeaderTextButtonItem({
  label,
  onPress,
  tintColor,
  identifier,
  disabled = false,
  fontWeight = '500',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tintColor: string;
  identifier: string;
  disabled?: boolean;
  fontWeight?: '400' | '500' | '600' | '700';
  accessibilityLabel?: string;
}): NativeStackHeaderItem {
  return {
    type: 'button',
    label,
    onPress,
    tintColor,
    labelStyle: { fontSize: 17, fontWeight, color: tintColor },
    accessibilityLabel: accessibilityLabel ?? label,
    identifier,
    sharesBackground: true,
    disabled,
  };
}

/**
 * The screens bridge only exposes UIBarButtonItemBadge's string variant (no
 * .indicator), so a bullet with foreground matched to the background renders
 * as a plain accent dot; the badge capsule sizes with the font, so a small
 * fontSize keeps the dot compact.
 */
export function createNativeHeaderAccentBadge(
  accentColor: string,
  value = '•'
): NativeStackHeaderItemMenu['badge'] {
  return {
    value,
    style: {
      backgroundColor: accentColor,
      color: accentColor,
      fontSize: 9,
    },
  };
}

export function createNativeHeaderMenuButtonItem({
  sfSymbol,
  menuItems,
  tintColor,
  identifier,
  accessibilityLabel,
  badge,
}: {
  sfSymbol: string;
  menuItems: NativeStackHeaderItemMenu['menu']['items'];
  tintColor: string;
  identifier: string;
  accessibilityLabel: string;
  /** iOS 26+ system badge (UIBarButtonItemBadge); ignored on earlier versions. */
  badge?: NativeStackHeaderItemMenu['badge'];
}): NativeStackHeaderItem {
  return {
    type: 'menu',
    label: '',
    icon: { type: 'sfSymbol', name: sfSymbol as never },
    tintColor,
    accessibilityLabel,
    identifier,
    sharesBackground: true,
    // Keep the raw badge field for the native runtime, while mirroring it
    // as `badge` in the test/runtime descriptor expected by our header
    // contract helpers.
    badge,
    menu: { items: menuItems },
  };
}

export function createNativeHeaderIconButtonItem({
  sfSymbol,
  onPress,
  tintColor,
  identifier,
  accessibilityLabel,
  disabled = false,
  separated = false,
}: {
  sfSymbol: string;
  onPress: () => void;
  tintColor: string;
  identifier: string;
  accessibilityLabel: string;
  disabled?: boolean;
  /**
   * iOS 26 draws neighbouring bar items inside ONE shared Liquid Glass
   * capsule, so two icons side by side read as a single joined control.
   * `separated` opts the item out of that SHARING only — it still gets a
   * glass background, just its own, so a row of buttons reads as distinct
   * buttons. (Do not reach for `hidesSharedBackground` here: that removes the
   * background altogether and leaves a bare glyph with no capsule at all.)
   */
  separated?: boolean;
}): NativeStackHeaderItem {
  return {
    type: 'button',
    label: '',
    icon: { type: 'sfSymbol', name: sfSymbol as never },
    onPress,
    tintColor,
    accessibilityLabel,
    identifier,
    sharesBackground: !separated,
    disabled,
  };
}
