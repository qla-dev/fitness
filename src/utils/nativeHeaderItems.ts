import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenu,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

export function createIOSNativeHeaderOptions(
  actionTintColor: string,
  titleColor: string = actionTintColor,
  /**
   * Opaque header fill. iOS 26 renders a native header as Liquid Glass by
   * default, so it takes a tint from whatever scrolls beneath it and shifts
   * colour as the user moves — on a themed app that reads as the header being
   * the wrong colour. Naming a background (and clearing the blur) keeps it the
   * app's own surface. Omit it to get the system default back.
   */
  backgroundColor?: string
): NativeStackNavigationOptions {
  return {
    headerShown: true,
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerTintColor: actionTintColor,
    ...(backgroundColor
      ? {
          headerTransparent: false,
          headerBlurEffect: undefined,
          headerShadowVisible: false,
          headerStyle: { backgroundColor },
          headerLargeStyle: { backgroundColor },
        }
      : {}),
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
  titleColor: string = actionTintColor,
  backgroundColor?: string
): NativeStackNavigationOptions {
  return {
    ...createIOSNativeHeaderOptions(actionTintColor, titleColor, backgroundColor),
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
