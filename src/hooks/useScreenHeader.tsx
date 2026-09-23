import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useCSSVariable } from 'uniwind';
import { useNavigation } from '@react-navigation/native';
import { useAnimatedHeaderHeight } from '@react-navigation/native-stack';
import { createDuplicatePressGuard } from '../utils/duplicatePress';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ParamListBase } from '@react-navigation/native';
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenu,
  NativeStackNavigationOptions,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import Icon, { IconName } from '../components/Icon';
import HeaderCircleButton from '../components/ui/HeaderCircleButton';
import FadeView from '../components/FadeView';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import AnchoredMenu, {
  measureAnchoredMenuTrigger,
} from '../components/AnchoredMenu';
import type { AnchoredMenuItem, AnchorRect } from '../components/AnchoredMenu';
import { useHeaderActionColors } from './useHeaderActionColors';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  createNativeHeaderAccentBadge,
  createNativeHeaderIconButtonItem,
  createNativeHeaderMenuButtonItem,
  createNativeHeaderTextButtonItem,
} from '../utils/nativeHeaderItems';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * Canonical English fallback label for every form/create/edit save action. The
 * screen title already names the object ("Create Meal", "Edit Preset"), so the
 * button is just "Save" (or "Saving…" while busy). Localized callers pass their
 * own label; screens that omit a `kind:'primary'` label fall back to the
 * localized `common.save` / `common.saving` values.
 */
/** Height of the iOS small native header an accessory has to clear. */
export const IOS_NATIVE_HEADER_HEIGHT = 44;

/**
 * The gap between a transparent header — bar plus accessory — and the first
 * row of content below it. A screen that offsets by hand adds this to
 * {@link useNativeHeaderOffset} and its accessory's measured height; sharing
 * one value is what makes two screens built the same way line up.
 */
export const HEADER_CONTENT_GAP = 12;

/**
 * The air under the screen-owned bar's hairline, which the bar carries itself
 * so no screen has to remember it. Deliberately small: most screens already
 * pad their content by 16, and this is added to that — it exists for the ones
 * that pad by nothing and had their first row sitting on the line.
 */
const HEADER_BAR_BOTTOM_GAP = 8;

export const SAVE_LABEL = 'Save';
export const SAVING_LABEL = 'Saving…';

export type HeaderRole = 'primary' | 'secondary';

/**
 * `native-only` items are mirrored into the native header but omitted from the
 * custom bar — used by footer-save forms whose sticky-footer Button is the
 * custom-path primary, so the header does not show a second Save control.
 */
export type HeaderPlacement = 'both' | 'native-only';

export type HeaderMenuAction = {
  label: string;
  /** SF Symbol shown on the native iOS menu row. */
  sfSymbol?: string;
  /** Semantic Icon name shown on the custom-path (AnchoredMenu) row. */
  icon?: IconName;
  /** Single-choice option row: checkmark when active, on both paths. */
  selected?: boolean;
  onPress: () => void;
};

/**
 * A titled group of single-select options. Rendered as an uppercase group
 * label on the custom path, and as an inline single-selection submenu on the
 * native path — a titled section with a leading checkmark on the active
 * option (the Mail-app pattern).
 */
export type HeaderMenuSection = {
  label: string;
  items: HeaderMenuAction[];
};

export type HeaderMenuEntry = HeaderMenuAction | HeaderMenuSection;

function isMenuSection(entry: HeaderMenuEntry): entry is HeaderMenuSection {
  return 'items' in entry;
}

export type HeaderItem =
  | {
      kind: 'back';
      onPress?: () => void;
      disabled?: boolean;
      identifier?: string;
    }
  | {
      kind: 'dismiss';
      onPress: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
      identifier?: string;
    }
  | {
      kind: 'text';
      label: string;
      onPress: () => void;
      role?: HeaderRole;
      placement?: HeaderPlacement;
      disabled?: boolean;
      busy?: boolean;
      busyLabel?: string;
      accessibilityLabel?: string;
      identifier?: string;
    }
  | {
      kind: 'icon';
      sfSymbol: string;
      ionicon: string;
      onPress: () => void;
      role?: HeaderRole;
      placement?: HeaderPlacement;
      disabled?: boolean;
      busy?: boolean;
      useIoniconOnIOS?: boolean;
      accessibilityLabel: string;
      identifier?: string;
      /**
       * Give this button its own iOS 26 Liquid Glass capsule instead of the
       * one it would otherwise share with the item next to it. Set it on every
       * icon in a slot that holds more than one, or they render as a single
       * joined control.
       */
      separated?: boolean;
    }
  | {
      // Sugar for `text` + role:'primary' + weight 600. When `label` is
      // omitted the localized `common.save` label is used.
      kind: 'primary';
      label?: string;
      onPress: () => void;
      placement?: HeaderPlacement;
      disabled?: boolean;
      busy?: boolean;
      busyLabel?: string;
      accessibilityLabel?: string;
      identifier?: string;
    }
  | {
      // Overflow/filter menu: the system UIMenu on the native path, an
      // AnchoredMenu dropped under the trigger on the custom path.
      kind: 'menu';
      /** Trigger glyphs; default to the ellipsis pair. */
      sfSymbol?: string;
      ionicon?: string;
      items: HeaderMenuEntry[];
      /** Accent dot on the trigger marking a non-default selection. */
      showsBadge?: boolean;
      badgeValue?: string;
      accessibilityLabel: string;
      /** Optional custom-bar label when native and custom paths need different context. */
      customAccessibilityLabel?: string;
      /** Optional native label when native and custom paths need different context. */
      nativeAccessibilityLabel?: string;
      identifier?: string;
    };

type MenuHeaderItem = Extract<HeaderItem, { kind: 'menu' }>;

/**
 * How a screen's native iOS bar behaves. Two shapes, both verified on device.
 *
 * - `system` (default): the bar iOS gives us, untouched — large title where
 *   the navigator asks for one, the system's own blur once content scrolls
 *   under it. This is what the tab screens run, and what every screen that
 *   names no variant keeps.
 * - `transparent`: no large title and nothing painted behind the bar, so the
 *   content shows through with the system blur over it. This is the Profile
 *   screen's shape. A screen on this variant MUST give its scroll view
 *   `contentInsetAdjustmentBehavior={usesNativeHeader ? 'automatic' : 'never'}`,
 *   because a transparent bar reserves no space and iOS measures the offset
 *   itself. Pair it with `nativeTitle: scrolled ? title : ''` when the screen
 *   carries its own big title in the content.
 *
 * Neither variant applies off the native path: Android and iOS below 26 render
 * the screen-owned bar this hook returns, which is unaffected.
 */
export type ScreenHeaderVariant = 'system' | 'transparent';

/** The `transparent` variant's native options, in one place. */
const TRANSPARENT_HEADER_OPTIONS: Partial<NativeStackNavigationOptions> = {
  headerLargeTitleEnabled: false,
  headerLargeTitleShadowVisible: false,
  headerTransparent: true,
  headerShadowVisible: false,
};

/**
 * The live height of the native bar above this screen, safe area included.
 *
 * Only valid on the native header path and inside a native stack screen, which
 * is why it lives behind {@link NativeHeaderAccessory} rather than being called
 * from the hook itself. A screen on the `transparent` variant uses it to start
 * its content below a bar that reserves no space — the number differs between a
 * pushed screen and a modal, so it must be measured rather than assumed.
 */
/**
 * The measured native bar height, for a screen on the `transparent` variant
 * that has to pad its content by hand — a `KeyboardAwareScrollView`, say,
 * which ignores `contentInsetAdjustmentBehavior`.
 *
 * Only valid inside a native stack screen. The first value is read straight
 * off the animated node so the content does not start at zero and jump once
 * the listener fires.
 */
export function useNativeHeaderOffset(): number {
  // `useAnimatedHeaderHeight` throws outside a native stack screen. A screen
  // rendered on its own — a test, a preview, a sheet — has no bar to clear, so
  // the answer there is zero rather than a crash. The call itself is
  // unconditional; only its failure is handled.
  let animated: ReturnType<typeof useAnimatedHeaderHeight> | null = null;
  try {
    // The call runs on every render — only its failure is caught — so hook
    // order is unchanged. The rule cannot see that through the try.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    animated = useAnimatedHeaderHeight();
  } catch {
    animated = null;
  }
  const [height, setHeight] = useState(() => {
    const node = animated as unknown as { __getValue?: () => number } | null;
    return typeof node?.__getValue === 'function' ? node.__getValue() : 0;
  });
  useEffect(() => {
    if (!animated) return;
    const id = animated.addListener(({ value }) => setHeight(value));
    return () => animated.removeListener(id);
  }, [animated]);
  return height;
}

function NativeHeaderAccessory({
  children,
  variant,
  onHeight,
}: {
  children: React.ReactNode;
  variant: ScreenHeaderVariant;
  onHeight?: (height: number) => void;
}) {
  // Same guard as useNativeHeaderOffset: outside a native stack screen there
  // is no bar to clear, so the accessory sits at the top rather than throwing.
  let headerHeight: ReturnType<typeof useAnimatedHeaderHeight> | number = 0;
  try {
    // The call runs on every render — only its failure is caught — so hook
    // order is unchanged. The rule cannot see that through the try.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    headerHeight = useAnimatedHeaderHeight();
  } catch {
    headerHeight = 0;
  }
  if (variant === 'system')
    return (
      <View
        onLayout={({ nativeEvent }) => onHeight?.(nativeEvent.layout.height)}
      >
        {children}
      </View>
    );
  return (
    <RNAnimated.View
      pointerEvents="box-none"
      onLayout={({ nativeEvent }) => onHeight?.(nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        // A system bar laid itself out, so the screen's content already starts
        // below it. A transparent one reserved nothing, so the accessory clears
        // the measured bar — as a translation, because the native animated
        // module does not drive `top`.
        transform:
          variant === 'transparent'
            ? [{ translateY: headerHeight }]
            : undefined,
        zIndex: 10,
      }}
    >
      {children}
    </RNAnimated.View>
  );
}

export interface ScreenHeaderConfig {
  /** See {@link ScreenHeaderVariant}. Defaults to `system`. */
  variant?: ScreenHeaderVariant;
  /**
   * The iOS large title: big under the bar at rest, collapsing into the bar as
   * content scrolls up. Only on the `system` variant — a transparent bar has
   * no scroll-edge appearance for the system to animate the handoff against.
   *
   * The screen must render its scroll view as the header's sibling, not inside
   * another `View`: the collapse is driven by the scroll view iOS finds
   * directly under the screen, and a wrapper hides it. Pair it with
   * `contentInsetAdjustmentBehavior={usesNativeHeader ? 'automatic' : 'never'}`,
   * which is what reserves the space the big title sits in.
   */
  largeTitle?: boolean;
  /**
   * Fixed content belonging to the header rather than to the screen: a
   * progress bar, a segmented control, a search field. It sits under the
   * title, spans both variants, and is the hook's job because only the hook
   * knows whether the bar above it reserved any space — on `transparent` it
   * did not, so the accessory clears the bar itself.
   *
   * It is laid over the screen rather than stacked above it, so the scroll
   * view underneath keeps its full height and keeps blurring under the bar.
   * The screen makes room for it with `paddingTop` on its
   * `contentContainerStyle` — the accessory's own height, on top of whatever
   * the inset already gives it.
   *
   * Whatever it holds — a progress hairline, a search field, a row of chips,
   * or both — the screen never hard-codes its height: pass
   * {@link ScreenHeaderConfig.onAccessoryHeight} and add the reported height
   * to {@link useNativeHeaderOffset} to know where content should start.
   *
   * Content that scrolls away is not an accessory; that belongs in the
   * screen's own scroll view.
   *
   * A screen with an accessory sets `contentInsetAdjustmentBehavior="never"`
   * on its scroll view even on `transparent`: the accessory is in the flow and
   * has already cleared the bar, so an automatic inset would count it twice.
   */
  accessory?: React.ReactNode;
  /**
   * The accessory's measured height, reported on layout and on every change,
   * so a screen can offset its content by it without knowing what is inside.
   */
  onAccessoryHeight?: (height: number) => void;
  /** Centered title for the custom bar. */
  title?: string;
  /** Also drive `setOptions({ title })` — used for view/edit mode swaps. */
  nativeTitle?: string;
  left?: HeaderItem | null;
  right?: HeaderItem | HeaderItem[] | null;
  /** Escape hatch for a custom-bar middle (simple, ref-less content). */
  center?: React.ReactNode;
  /** Drop the custom bar's bottom hairline (large-title detail screens). */
  borderless?: boolean;
  /** gestureEnabled / headerBackVisible etc. for edit-mode swaps. */
  nativeOptions?: Partial<NativeStackNavigationOptions>;
  /** Cross-fade the custom bar when this key changes (view/edit swaps). */
  animateKey?: string;
  /**
   * `dark`: the content under the bar is forced dark whatever the theme (the
   * recorder). The custom bar then draws its items in white and gives the
   * circles the dark recipe — the theme's text colour is navy on the light
   * theme and vanished on black, chevron and ring both. The native path is
   * left alone: the system bar paints its own material behind its items.
   */
  appearance?: 'dark';
}

interface HeaderColors {
  defaultColor: string;
  saveColor: string;
}

function isPrimaryItem(item: HeaderItem): boolean {
  return item.kind === 'primary' || ('role' in item && item.role === 'primary');
}

function itemColor(item: HeaderItem, colors: HeaderColors): string {
  return isPrimaryItem(item) ? colors.saveColor : colors.defaultColor;
}

function itemIsBusy(item: HeaderItem): boolean {
  return 'busy' in item && !!item.busy;
}

function itemPlacement(item: HeaderItem): HeaderPlacement {
  return 'placement' in item ? (item.placement ?? 'both') : 'both';
}

/**
 * Every header button answers a press with the selection haptic, so a bar of
 * icons feels the same as the rest of the app on both paths.
 *
 * `back` is the exception: the iOS native back button is drawn by the OS and
 * exposes no JS press handler, so back feedback hangs off the pop transition
 * instead (`fireBackNavigationHaptic`). Firing here as well would buzz twice
 * for one press on the custom path, where both would run.
 */
function resolvePress(
  item: Exclude<HeaderItem, MenuHeaderItem>,
  goBack: () => void
): () => void {
  if (item.kind === 'back') return item.onPress ?? goBack;
  const press = item.onPress;
  return () => {
    fireSelectionHaptic();
    press();
  };
}

function itemIsDisabled(item: HeaderItem): boolean {
  return ('disabled' in item && !!item.disabled) || itemIsBusy(item);
}

function itemAccessibilityLabel(
  item: HeaderItem,
  t: TFunction
): string | undefined {
  switch (item.kind) {
    case 'back':
      return t('common.back', 'Back');
    case 'dismiss':
      return item.accessibilityLabel ?? t('common.close', 'Close');
    case 'icon':
      return item.accessibilityLabel;
    case 'menu':
      return item.customAccessibilityLabel ?? item.accessibilityLabel;
    case 'text':
    case 'primary':
      // Explicit caller accessibilityLabel wins; otherwise mirror the visible
      // label of the custom path (busy only disables the button there — it
      // never swaps the text), so the a11y label always matches the UI text
      // instead of hard-coded English.
      return item.accessibilityLabel ?? resolveItemLabel(item, t);
  }
}

/**
 * Resolves the visible label for a header item. `kind:'primary'` items without
 * an explicit label, or whose label is the canonical English SAVE_LABEL marker,
 * fall back to the localized `common.save` value with an explicit English
 * fallback; every other item uses its required label.
 */
function resolveItemLabel(item: HeaderItem, t: TFunction): string | undefined {
  switch (item.kind) {
    case 'primary':
      return item.label === undefined || item.label === SAVE_LABEL
        ? t('common.save', 'Save')
        : item.label;
    case 'text':
      // A role:'primary' text item with the canonical SAVE_LABEL marker is also
      // localized (e.g. caller reuses SAVE_LABEL for a primary text action).
      if (
        'role' in item &&
        item.role === 'primary' &&
        item.label === SAVE_LABEL
      ) {
        return t('common.save', 'Save');
      }
      return item.label;
    case 'back':
    case 'dismiss':
    case 'icon':
      return undefined;
  }
}

/**
 * Resolves the busy label for a header item. Primary items without an explicit
 * busy label, or whose busy label is the canonical SAVING_LABEL marker, fall
 * back to the localized `common.saving` value with an explicit English fallback.
 */
function resolveItemBusyLabel(
  item: HeaderItem,
  t: TFunction
): string | undefined {
  const primaryBusy = (kind: 'primary' | 'text') =>
    kind === 'primary'
      ? item.kind === 'primary' &&
        (item.busyLabel === undefined || item.busyLabel === SAVING_LABEL)
      : item.kind === 'text' &&
        'role' in item &&
        item.role === 'primary' &&
        item.busyLabel === SAVING_LABEL;

  if (item.kind === 'primary') {
    return primaryBusy('primary')
      ? t('common.saving', 'Saving…')
      : item.busyLabel;
  }

  if (item.kind === 'text') {
    return primaryBusy('text') ? t('common.saving', 'Saving…') : item.busyLabel;
  }

  return undefined;
}

/**
 * Per-menu-entry handler key inside the hook's ref map: `<item id>~<section
 * index>[.<action index>]`. Refreshed every render like the item-level keys so
 * native menu actions never invoke stale closures.
 */
function collectMenuHandlers(
  item: HeaderItem,
  id: string,
  handlers: Record<string, () => void>
): void {
  if (item.kind !== 'menu') return;
  item.items.forEach((entry, i) => {
    if (isMenuSection(entry)) {
      entry.items.forEach((action, j) => {
        handlers[`${id}~${i}.${j}`] = action.onPress;
      });
    } else {
      handlers[`${id}~${i}`] = entry.onPress;
    }
  });
}

function toAnchoredMenuItems(
  entries: HeaderMenuEntry[],
  idPrefix: string
): AnchoredMenuItem[] {
  const out: AnchoredMenuItem[] = [];
  entries.forEach((entry, i) => {
    if (isMenuSection(entry)) {
      out.push({
        key: `${idPrefix}~${i}`,
        label: entry.label,
        isGroupLabel: true,
      });
      entry.items.forEach((action, j) => {
        out.push({
          key: `${idPrefix}~${i}.${j}`,
          label: action.label,
          icon: action.icon,
          selected: action.selected,
          onPress: action.onPress,
        });
      });
    } else {
      out.push({
        key: `${idPrefix}~${i}`,
        label: entry.label,
        icon: entry.icon,
        selected: entry.selected,
        onPress: entry.onPress,
      });
    }
  });
  return out;
}

function toNativeMenuAction(
  action: HeaderMenuAction,
  onPress: () => void
): NativeStackHeaderItemMenu['menu']['items'][number] {
  return {
    type: 'action',
    label: action.label,
    ...(action.sfSymbol
      ? { icon: { type: 'sfSymbol' as const, name: action.sfSymbol as never } }
      : {}),
    ...(action.selected !== undefined
      ? { state: action.selected ? ('on' as const) : ('off' as const) }
      : {}),
    onPress,
  };
}

function buildNativeMenuItem(
  item: MenuHeaderItem,
  identifier: string,
  colors: HeaderColors,
  accentColor: string,
  pressFor: (handlerKey: string) => () => void
): NativeStackHeaderItem {
  const menuItems: NativeStackHeaderItemMenu['menu']['items'] = item.items.map(
    (entry, i) =>
      isMenuSection(entry)
        ? {
            type: 'submenu',
            label: entry.label,
            inline: true,
            multiselectable: false,
            items: entry.items.map((action, j) =>
              toNativeMenuAction(action, pressFor(`${identifier}~${i}.${j}`))
            ),
          }
        : toNativeMenuAction(entry, pressFor(`${identifier}~${i}`))
  );
  return createNativeHeaderMenuButtonItem({
    // Bare glyph: Liquid Glass draws its own circular button background, so
    // circled variants would double up the ring.
    sfSymbol: item.sfSymbol ?? 'ellipsis',
    identifier,
    tintColor: colors.defaultColor,
    accessibilityLabel:
      item.nativeAccessibilityLabel ?? item.accessibilityLabel,
    badge: item.showsBadge
      ? createNativeHeaderAccentBadge(accentColor, item.badgeValue ?? '•')
      : undefined,
    menuItems,
  });
}

/** Raw platform icon for the generic `icon` kind on the custom bar. */
function RawHeaderIcon({
  sf,
  ion,
  color,
  size = 24,
  useIoniconOnIOS = false,
}: {
  sf: string;
  ion: string;
  color: string;
  size?: number;
  useIoniconOnIOS?: boolean;
}) {
  if (Platform.OS === 'ios' && !useIoniconOnIOS) {
    return <SymbolView name={sf as never} tintColor={color} size={size} />;
  }
  return (
    <Ionicons
      name={ion as keyof typeof Ionicons.glyphMap}
      color={color}
      size={size}
    />
  );
}

/**
 * Custom-bar button. Owned by this abstraction (not `Button`) so its color is
 * driven by `useHeaderActionColors()` in lockstep with the native tint, and the
 * one-accent rule is enforced in a single place.
 */
function HeaderBarButton({
  item,
  color,
  badgeColor,
  appearance,
  onPress,
}: {
  item: HeaderItem;
  color: string;
  badgeColor?: string;
  appearance?: 'dark';
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const disabled = itemIsDisabled(item);
  const busy = itemIsBusy(item);

  const label = resolveItemLabel(item, t);
  let content: React.ReactNode;
  if (busy) {
    content = <ActivityIndicator size="small" color={color} />;
  } else if (item.kind === 'back') {
    content = <Icon name="chevron-back" size={22} color={color} />;
  } else if (item.kind === 'dismiss') {
    content = <Icon name="close" size={22} color={color} />;
  } else if (item.kind === 'icon') {
    content = (
      <RawHeaderIcon
        sf={item.sfSymbol}
        ion={item.ionicon}
        color={color}
        useIoniconOnIOS={item.useIoniconOnIOS}
      />
    );
  } else if (item.kind === 'menu') {
    content = (
      <View>
        <RawHeaderIcon
          sf={item.sfSymbol ?? 'ellipsis'}
          ion={item.ionicon ?? 'ellipsis-horizontal'}
          color={color}
        />
        {item.showsBadge && (
          <View
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: badgeColor }}
          />
        )}
      </View>
    );
  } else {
    content = (
      <Text
        style={{
          color,
          fontSize: 17,
          fontWeight: isPrimaryItem(item) ? '600' : '500',
        }}
      >
        {label}
      </Text>
    );
  }

  // Glyph buttons sit in a circle (see HeaderCircleButton); text buttons —
  // Done, Save, Cancel — stay bare, a word in a 44 pt circle reads as a chip.
  const isGlyph =
    item.kind === 'back' ||
    item.kind === 'dismiss' ||
    item.kind === 'icon' ||
    item.kind === 'menu';
  if (isGlyph) {
    return (
      <HeaderCircleButton
        onPress={onPress}
        disabled={disabled}
        appearance={appearance}
        accessibilityLabel={itemAccessibilityLabel(item, t)}
      >
        {content}
      </HeaderCircleButton>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={itemAccessibilityLabel(item, t)}
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      {content}
    </Pressable>
  );
}

function toRightArray(right: ScreenHeaderConfig['right']): HeaderItem[] {
  if (!right) return [];
  return Array.isArray(right) ? right : [right];
}

function resolveIdentifier(item: HeaderItem, fallback: string): string {
  return item.identifier ?? fallback;
}

function buildNativeItem(
  item: Exclude<HeaderItem, MenuHeaderItem>,
  identifier: string,
  colors: HeaderColors,
  press: () => void,
  t: TFunction
): NativeStackHeaderItem | null {
  const color = itemColor(item, colors);
  switch (item.kind) {
    case 'back':
      // System back button owns the native left slot.
      return null;
    case 'dismiss':
      return createNativeHeaderIconButtonItem({
        sfSymbol: 'xmark',
        identifier,
        tintColor: colors.defaultColor,
        accessibilityLabel:
          item.accessibilityLabel ?? t('common.close', 'Close'),
        onPress: press,
        disabled: !!item.disabled,
      });
    case 'icon':
      return createNativeHeaderIconButtonItem({
        sfSymbol: item.sfSymbol,
        identifier,
        tintColor: color,
        accessibilityLabel: item.accessibilityLabel,
        onPress: press,
        disabled: itemIsDisabled(item),
        separated: item.separated,
      });
    case 'text':
    case 'primary': {
      const resolvedLabel = resolveItemLabel(item, t);
      const resolvedBusyLabel = resolveItemBusyLabel(item, t);
      const visibleLabel =
        itemIsBusy(item) && resolvedBusyLabel
          ? resolvedBusyLabel
          : (resolvedLabel ?? t('common.save', 'Save'));
      return createNativeHeaderTextButtonItem({
        label: visibleLabel,
        identifier,
        tintColor: color,
        onPress: press,
        disabled: itemIsDisabled(item),
        fontWeight: isPrimaryItem(item) ? '600' : '500',
        accessibilityLabel: item.accessibilityLabel ?? visibleLabel,
      });
    }
  }
}

/**
 * Single declarative header per screen, rendered correctly on both paths:
 * - Native path (iOS 26 glass on, or iOS < 26 classic headers): mirrors the
 *   descriptor into `unstable_header{Left,Right}Items` via a layout effect and
 *   returns `null` (the native stack header owns the chrome).
 * - Custom path (Android always, iOS 26 glass off): returns the custom bar
 *   element for the screen to render at the top of its view.
 *
 * The one-accent rule (exactly one primary/save action tinted accent, all
 * navigation/secondary actions neutral) is enforced here for both paths.
 */
export function useScreenHeader(config: ScreenHeaderConfig): React.ReactNode {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const { defaultColor, saveColor } = useHeaderActionColors();
  const colors: HeaderColors = { defaultColor, saveColor };
  // The menu badge dot always takes the real accent, even on the Liquid Glass
  // path where saveColor is coerced to the monochrome text color.
  const accentColor =
    (useCSSVariable('--color-accent-primary') as string) || '#0A84FF';
  const titleColor = (useCSSVariable('--color-text-primary') as string) || '';

  // Custom-path menu presentation: which menu item is open, anchored where.
  const [openMenu, setOpenMenu] = useState<{
    id: string;
    anchor: AnchorRect;
  } | null>(null);
  const menuTriggerRefs = useRef<Record<string, View | null>>({});

  const {
    variant = 'system',
    largeTitle = false,
    accessory,
    onAccessoryHeight,
    title,
    nativeTitle,
    left,
    right,
    center,
    borderless,
    nativeOptions,
    animateKey,
    appearance,
  } = config;
  const rightItems = toRightArray(right);
  // Only the screen-owned bar takes the forced-dark colours; the native
  // items keep the theme tint the system bar was built around.
  const customColors: HeaderColors =
    appearance === 'dark'
      ? { defaultColor: '#FFFFFF', saveColor: '#FFFFFF' }
      : colors;

  // One-accent invariant: count both `kind:'primary'` and `role:'primary'`.
  if (__DEV__) {
    const primaryCount = [left, ...rightItems].filter(
      (item): item is HeaderItem => !!item && isPrimaryItem(item)
    ).length;
    if (primaryCount > 1) {
      throw new Error(
        `useScreenHeader: ${primaryCount} primary header actions declared; exactly one accent action is allowed per screen.`
      );
    }
  }

  // Stable id → latest onPress map, refreshed every render so native header
  // buttons (rebuilt only when their visible state changes) always invoke the
  // current closure — replaces the per-screen handler-ref dance.
  const handlersRef = useRef<Record<string, () => void>>({});
  const nextHandlers: Record<string, () => void> = {};

  // `kind: 'primary'` is the Save sugar, and most screens expose their only
  // Save through it. Those presses dispatch straight through `handlersRef` with
  // no synchronous guard, so a burst of taps replayed off a blocked JS thread
  // ran the handler once per tap — screen-local isPending checks do not help,
  // because every queued press sees the previous render's closure (#2191).
  //
  // Same guard the footer Save bar uses, and scoped to the RIGHT-slot primary:
  // that is the accent write action, the only one where a repeated press
  // writes twice. The left slot is navigation, and at least one screen uses
  // the primary sugar for a wizard Back (CycleOnboardingScreen) where rapid
  // repeated presses are exactly what the user means.
  const allowPress = useRef(createDuplicatePressGuard()).current;

  const goBack = () => navigation.goBack();
  // A menu item's own press only exists on the custom path: measure the
  // trigger and open the AnchoredMenu under it. (Natively the system presents
  // the UIMenu itself; only the per-entry handlers fire from JS.)
  const openAnchoredMenu = (id: string) => () => {
    // Opening the menu IS the button press, so it earns the same feedback the
    // plain buttons give. The native path never reaches here — iOS presents
    // that UIMenu itself and supplies its own feedback.
    fireSelectionHaptic();
    measureAnchoredMenuTrigger(menuTriggerRefs.current[id] ?? null, (anchor) =>
      setOpenMenu({ id, anchor })
    );
  };
  const registerHandlers = (
    item: HeaderItem,
    id: string,
    slot: 'left' | 'right'
  ) => {
    const press =
      item.kind === 'menu' ? openAnchoredMenu(id) : resolvePress(item, goBack);
    nextHandlers[id] =
      item.kind === 'primary' && slot === 'right'
        ? () => {
            if (!allowPress(id)) return;
            press();
          }
        : press;
    collectMenuHandlers(item, id, nextHandlers);
  };
  const leftId = left ? resolveIdentifier(left, 'header-left') : 'header-left';
  if (left) {
    registerHandlers(left, leftId, 'left');
  }
  const rightMeta = rightItems.map((item, index) => {
    const id = resolveIdentifier(item, `header-right-${index}`);
    registerHandlers(item, id, 'right');
    return { item, id };
  });
  handlersRef.current = nextHandlers;

  // Every visible facet of a menu item, so filter selections, badge state, and
  // relabeled entries rebuild the native button.
  const menuSignature = (item: HeaderItem) =>
    item.kind === 'menu'
      ? {
          sfSymbol: item.sfSymbol,
          showsBadge: !!item.showsBadge,
          badgeValue: item.kind === 'menu' ? item.badgeValue : undefined,
          accessibilityLabel: item.accessibilityLabel,
          customAccessibilityLabel: item.customAccessibilityLabel,
          nativeAccessibilityLabel: item.nativeAccessibilityLabel,
          entries: item.items.map((entry) =>
            isMenuSection(entry)
              ? {
                  label: entry.label,
                  items: entry.items.map((a) => ({
                    label: a.label,
                    selected: a.selected ?? null,
                    sfSymbol: a.sfSymbol,
                  })),
                }
              : {
                  label: entry.label,
                  selected: entry.selected ?? null,
                  sfSymbol: entry.sfSymbol,
                }
          ),
        }
      : undefined;

  // Native path: mirror the descriptor into stack options. Re-runs only when the
  // visible signature changes; onPress is dispatched through `handlersRef`.
  const signature = JSON.stringify({
    usesNativeHeader,
    variant,
    largeTitle,
    defaultColor,
    saveColor,
    accentColor,
    titleColor,
    nativeTitle: nativeTitle ?? null,
    left: left
      ? {
          id: leftId,
          kind: left.kind,
          label: resolveItemLabel(left, t),
          busyLabel: resolveItemBusyLabel(left, t),
          disabled: itemIsDisabled(left),
          busy: itemIsBusy(left),
          menu: menuSignature(left),
        }
      : null,
    right: rightMeta.map(({ item, id }) => ({
      id,
      kind: item.kind,
      label: resolveItemLabel(item, t),
      busyLabel: resolveItemBusyLabel(item, t),
      sfSymbol: item.kind === 'icon' ? item.sfSymbol : undefined,
      separated: item.kind === 'icon' ? !!item.separated : undefined,
      role: 'role' in item ? item.role : undefined,
      disabled: itemIsDisabled(item),
      busy: itemIsBusy(item),
      menu: menuSignature(item),
    })),
    nativeOptions: nativeOptions ?? null,
  });

  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') return;

    const options: Partial<NativeStackNavigationOptions> = {
      headerTintColor: defaultColor,
      ...(variant === 'transparent' ? TRANSPARENT_HEADER_OPTIONS : null),
      ...(variant === 'system' && largeTitle
        ? {
            headerLargeTitleEnabled: true,
            headerLargeTitleShadowVisible: false,
          }
        : null),
      // A screen's own nativeOptions still win, so edit-mode swaps keep
      // overriding whatever the variant set.
      ...nativeOptions,
    };

    if (usesNativeHeader) {
      if (nativeTitle !== undefined) options.title = nativeTitle;

      // The system animates its own title handoff on the large-title path —
      // the inline title slides up from the bottom of the bar. The transparent
      // variant has no large title to hand off from, so a screen swapping
      // nativeTitle in on scroll would otherwise pop it in. Rendering the title
      // ourselves reproduces that slide; the key remounts it, which is what
      // runs the entering animation.
      if (variant === 'transparent' && nativeTitle !== undefined) {
        const shownTitle = nativeTitle;
        options.headerTitle = () =>
          shownTitle ? (
            <Animated.View
              key={shownTitle}
              entering={FadeInDown.duration(220)}
              exiting={FadeOutDown.duration(160)}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 17, fontWeight: '600', color: titleColor }}
              >
                {shownTitle}
              </Text>
            </Animated.View>
          ) : null;
      }

      const buildItem = (
        item: HeaderItem,
        id: string
      ): NativeStackHeaderItem | null =>
        item.kind === 'menu'
          ? buildNativeMenuItem(
              item,
              id,
              colors,
              accentColor,
              (handlerKey) => () => {
                fireSelectionHaptic();
                handlersRef.current[handlerKey]?.();
              }
            )
          : buildNativeItem(
              item,
              id,
              colors,
              () => handlersRef.current[id]?.(),
              t
            );

      if (!left || left.kind === 'back') {
        options.unstable_headerLeftItems = undefined;
      } else {
        const leftNative = buildItem(left, leftId);
        options.unstable_headerLeftItems = leftNative
          ? () => [leftNative]
          : undefined;
        // A dismiss/text left item replaces the system back button.
        if (
          left.kind === 'dismiss' &&
          options.headerBackVisible === undefined
        ) {
          options.headerBackVisible = false;
        }
      }

      const rightNative = rightMeta
        .map(({ item, id }) => buildItem(item, id))
        .filter((entry): entry is NativeStackHeaderItem => entry !== null);
      options.unstable_headerRightItems = rightNative.length
        ? () => rightNative
        : undefined;
    }

    navigation.setOptions(options);
    // `signature` captures every value that affects the native header output;
    // handlers dispatch through a ref so stale closures are impossible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, signature]);

  if (usesNativeHeader)
    return accessory ? (
      <NativeHeaderAccessory variant={variant} onHeight={onAccessoryHeight}>
        {accessory}
      </NativeHeaderAccessory>
    ) : null;

  // Menu triggers are wrapped in a measurable View so the press handler can
  // anchor the AnchoredMenu under the button it came from.
  const renderButton = (item: HeaderItem, id: string) => {
    const button = (
      <HeaderBarButton
        key={id}
        item={item}
        color={itemColor(item, customColors)}
        badgeColor={accentColor}
        appearance={appearance}
        onPress={() => handlersRef.current[id]?.()}
      />
    );
    if (item.kind !== 'menu') return button;
    return (
      <View
        key={id}
        ref={(node) => {
          menuTriggerRefs.current[id] = node;
        }}
        collapsable={false}
      >
        {button}
      </View>
    );
  };

  const leftCustom =
    left && itemPlacement(left) !== 'native-only'
      ? renderButton(left, leftId)
      : null;

  const rightCustom = rightMeta
    .filter(({ item }) => itemPlacement(item) !== 'native-only')
    .map(({ item, id }) => renderButton(item, id));

  const openMenuItem = (() => {
    if (!openMenu) return null;
    const candidates = [
      ...(left ? [{ item: left, id: leftId }] : []),
      ...rightMeta,
    ];
    const match = candidates.find(({ id }) => id === openMenu.id)?.item;
    return match && match.kind === 'menu' ? match : null;
  })();

  const menuOverlay = (
    <AnchoredMenu
      visible={!!openMenuItem}
      anchor={openMenu?.anchor ?? null}
      items={
        openMenu && openMenuItem
          ? toAnchoredMenuItems(openMenuItem.items, openMenu.id)
          : []
      }
      onClose={() => setOpenMenu(null)}
    />
  );

  const bar = (
    <View
      className={`px-4 py-3 ${borderless ? '' : 'border-b border-border-subtle'}`}
      style={{
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // See HEADER_BAR_BOTTOM_GAP: the air under the hairline belongs to
        // the bar rather than to each of the 85 screens that render it.
        marginBottom: HEADER_BAR_BOTTOM_GAP,
      }}
    >
      {/* The title is a separate, absolutely-positioned layer centered on the
          bar's full width, independent of the side cells' own flex layout —
          the same technique native iOS/Android headers use. Centering the
          title by giving the side cells equal flex-grow instead (so an empty
          side matched the populated one) is what let a long title squeeze
          both side cells to zero width in the first place: under CSS/Yoga's
          shrink algorithm, a `flexBasis: 0%` sibling always computes a scaled
          shrink factor of 0, so once the title overflowed the row it claimed
          100% of the space and the side cells rendered at 0 width (confirmed
          via on-device onLayout measurement). Decoupling the title from that
          layout means it can never compete with the side cells for space, so
          it can never squeeze them — and it still lands on the bar's true
          center regardless of how the left/right content widths differ.
          pointerEvents="box-none" keeps the title layer itself untouchable so
          it can never sit "on top of" a button for hit-testing purposes. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {center ?? (
          <Text
            numberOfLines={1}
            className="text-center text-text-primary text-lg font-semibold"
          >
            {title ?? ''}
          </Text>
        )}
      </View>
      {/* flexShrink: 0 (content-sized) rather than flex-1: these cells can
          never be squeezed by the title, at the cost of no longer truncating
          if their own content ever got wide enough to overflow — a non-issue
          for the icon/short-text buttons this bar renders. */}
      <View className="flex-row items-center gap-2" style={{ flexShrink: 0 }}>
        {leftCustom}
      </View>
      <View
        className="flex-row items-center justify-end gap-2"
        style={{ flexShrink: 0 }}
      >
        {rightCustom}
      </View>
    </View>
  );

  return (
    <>
      {animateKey !== undefined ? (
        <FadeView key={animateKey}>{bar}</FadeView>
      ) : (
        bar
      )}
      {/* Wrapped, unlike the native path where the accessory is positioned
          absolutely: here it is a flex child of the screen's column, and RN
          gives every ScrollView `flexGrow: 1` in its base style — so a chip
          row handed over bare claimed a share of the free space and left a
          band of nothing between the chips and the list under them. A plain
          View does not grow, and inside it the row has no free space left to
          take. */}
      {accessory ? (
        <View
          onLayout={({ nativeEvent }) =>
            onAccessoryHeight?.(nativeEvent.layout.height)
          }
        >
          {accessory}
        </View>
      ) : null}
      {menuOverlay}
    </>
  );
}
