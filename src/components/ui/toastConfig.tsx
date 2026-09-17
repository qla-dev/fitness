import { View, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { ToastConfig } from 'react-native-toast-message';
import Icon, { type IconName } from '../Icon';
import MenuItem from '../MenuItem';
import MenuItemIcon from '../MenuItemIcon';

type ToastVariant = 'success' | 'error' | 'info';

// Tap actions ride in via Toast.show({ props: { onPress } }); the library's
// own onPress option defaults to a noop, so an action passed there can't be
// told apart from no action.
interface ToastTapProps {
  onPress?: () => void;
}

/**
 * A toast is built from the same row as a settings menu item: an icon tile, a
 * title and a subtitle on one 66pt row. Toasts used to carry their own padding
 * and type scale, which read as a different design language from every list in
 * the app for the two seconds they were on screen.
 *
 * Only the icon and its tile carry the variant; the card itself stays the
 * surface colour so a success and an error are the same object with a
 * different badge, the way a row with a red icon is still a row.
 */
const variantTokens: Record<
  ToastVariant,
  { icon: IconName; tint: string; tile: string }
> = {
  success: {
    icon: 'checkmark-circle-filled',
    // i18n-audit-ignore-next-line hardcoded-ui-text -- CSS variable identifier, not user-visible text.
    tint: '--color-text-success',
    tile: '--color-bg-success',
  },
  error: {
    icon: 'alert-circle',
    // i18n-audit-ignore-next-line hardcoded-ui-text -- CSS variable identifier, not user-visible text.
    tint: '--color-text-danger',
    tile: '--color-bg-danger',
  },
  info: {
    icon: 'info-circle',
    // i18n-audit-ignore-next-line hardcoded-ui-text -- CSS variable identifier, not user-visible text.
    tint: '--color-accent-primary',
    tile: '--color-menu-icon-bg',
  },
};

function ToastContent({
  variant,
  text1,
  text2,
  onPress,
}: {
  variant: ToastVariant;
  text1?: string;
  text2?: string;
  onPress?: () => void;
}) {
  const tokens = variantTokens[variant];
  const [surface, tint, tile] = useCSSVariable([
    '--color-surface',
    tokens.tint,
    tokens.tile,
  ]) as [string, string, string];

  const body = (
    <View
      style={{
        backgroundColor: surface,
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <MenuItem
        leading={
          <MenuItemIcon backgroundColor={tile}>
            <Icon name={tokens.icon} size={20} color={tint} />
          </MenuItemIcon>
        }
      >
        {text1 ? (
          <Text
            className="text-text-primary text-base font-semibold"
            numberOfLines={1}
          >
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text className="text-text-secondary text-sm" numberOfLines={2}>
            {text2}
          </Text>
        ) : null}
      </MenuItem>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {body}
    </TouchableOpacity>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, props }) => (
    <ToastContent
      variant="success"
      text1={text1}
      text2={text2}
      onPress={(props as ToastTapProps | undefined)?.onPress}
    />
  ),
  error: ({ text1, text2, props }) => (
    <ToastContent
      variant="error"
      text1={text1}
      text2={text2}
      onPress={(props as ToastTapProps | undefined)?.onPress}
    />
  ),
  info: ({ text1, text2, props }) => (
    <ToastContent
      variant="info"
      text1={text1}
      text2={text2}
      onPress={(props as ToastTapProps | undefined)?.onPress}
    />
  ),
};
