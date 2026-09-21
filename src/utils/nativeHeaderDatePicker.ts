import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { formatDateLabel } from './dateUtils';
import { createNativeHeaderIconButtonItem } from './nativeHeaderItems';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * The native header items are OS-drawn buttons, so nothing fires feedback for
 * them unless the handler does. Wrapping here keeps them level with the
 * fallback `TabHeader`, whose buttons buzz on press.
 */
function withHaptic(onPress: () => void): () => void {
  return () => {
    fireSelectionHaptic();
    onPress();
  };
}

/**
 * The iOS-native half of the shared tab header. It mirrors `TabHeader` on the
 * fallback path: the day sits on the LEFT, the native header centers the
 * title, and the trailing actions — the profile button every tab carries, plus
 * anything screen-specific — sit on the right.
 *
 * There are no previous/next day chevrons here, matching the fallback bar:
 * the day moves by swiping the content or through the picker this button
 * opens.
 */
export type NativeHeaderAction = {
  sfSymbol: string;
  onPress: () => void;
  accessibilityLabel: string;
  identifier: string;
};

export type NativeHeaderDatePickerOptions = {
  selectedDate: string;
  onDatePress: () => void;
  tintColor: string;
  accessibilityLabel: string;
  dateLabel?: string;
  t: import('i18next').TFunction;
  locale: string;
  /** Right-hand buttons, in order. The profile button belongs last. */
  trailingActions?: NativeHeaderAction[];
};

export type NativeHeaderDatePickerNavigation = {
  setOptions: (options: {
    unstable_headerLeftItems: () => NativeStackHeaderItem[];
    unstable_headerRightItems?: () => NativeStackHeaderItem[];
  }) => void;
};

export function setNativeHeaderDatePickerOptions(
  navigation: NativeHeaderDatePickerNavigation,
  options: NativeHeaderDatePickerOptions
) {
  const trailingActions = options.trailingActions ?? [];

  navigation.setOptions({
    unstable_headerLeftItems: () => createNativeHeaderDatePickerItems(options),
    unstable_headerRightItems:
      trailingActions.length > 0
        ? () =>
            trailingActions.map((action) =>
              createNativeHeaderIconButtonItem({
                sfSymbol: action.sfSymbol,
                onPress: withHaptic(action.onPress),
                tintColor: options.tintColor,
                accessibilityLabel: action.accessibilityLabel,
                identifier: action.identifier,
                separated: true,
              })
            )
        : undefined,
  });
}

export function createNativeHeaderDatePickerItems({
  selectedDate,
  onDatePress,
  tintColor,
  accessibilityLabel,
  dateLabel,
  t,
  locale,
}: NativeHeaderDatePickerOptions): NativeStackHeaderItem[] {
  return [
    {
      type: 'button',
      label: dateLabel ?? `${formatDateLabel(selectedDate, t, locale)} ▾`,
      onPress: withHaptic(onDatePress),
      tintColor,
      labelStyle: { fontSize: 15, fontWeight: '600', color: tintColor },
      accessibilityLabel,
      identifier: 'date-picker',
      sharesBackground: true,
    },
  ];
}

/**
 * Trailing-only variant for a tab with no date of its own (Library). Screens
 * call this rather than writing header items themselves, so the native header
 * wiring stays in one place.
 */
export type NativeTabHeaderNavigation = {
  setOptions: (options: {
    unstable_headerRightItems: () => NativeStackHeaderItem[];
  }) => void;
};

export function setNativeTabHeaderActions(
  navigation: NativeTabHeaderNavigation,
  actions: NativeHeaderAction[],
  tintColor: string
) {
  navigation.setOptions({
    unstable_headerRightItems: () =>
      actions.map((action) =>
        createNativeHeaderIconButtonItem({
          sfSymbol: action.sfSymbol,
          onPress: withHaptic(action.onPress),
          tintColor,
          accessibilityLabel: action.accessibilityLabel,
          identifier: action.identifier,
          // Each tab-header button gets its own Liquid Glass capsule; iOS 26
          // would otherwise merge the workouts and profile buttons into one
          // joined pill.
          separated: true,
        })
      ),
  });
}

/**
 * The workouts list, shared by every tab's native header. It sits immediately
 * before the profile button, so profile keeps the corner position it holds on
 * every tab. Food logging moved to the tab bar's centre button, so this slot
 * carries the other half of the day: what the user trained.
 */
export function createNativeWorkoutsAction(
  onPress: () => void,
  accessibilityLabel: string
): NativeHeaderAction {
  return {
    sfSymbol: 'figure.run',
    onPress,
    accessibilityLabel,
    identifier: 'tab-header-workouts',
  };
}

/** The profile button shared by every tab's native header. */
export function createNativeProfileAction(
  onPress: () => void,
  accessibilityLabel: string
): NativeHeaderAction {
  return {
    sfSymbol: 'person.crop.circle',
    onPress,
    accessibilityLabel,
    identifier: 'tab-header-profile',
  };
}
