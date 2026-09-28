import { View, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { fireSelectionHaptic } from '../../services/haptics';
import Icon, { type IconName } from '../Icon';
import MenuItem from '../MenuItem';
import MenuItemIcon from '../MenuItemIcon';
import ToastSpinner from './ToastSpinner';

type ToastVariant = 'success' | 'error' | 'info' | 'syncing';

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
  // Same tile and tint as info: a sync in progress is information, and the
  // only thing that differs is that the badge turns. `icon` is unused on this
  // variant but kept so the token table stays one shape.
  syncing: {
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
          variant === 'syncing' ? (
            <ToastSpinner color={tint} backgroundColor={tile} />
          ) : (
            <MenuItemIcon backgroundColor={tile}>
              <Icon name={tokens.icon} size={20} color={tint} />
            </MenuItemIcon>
          )
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

  const content = onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
  return <SwipeToDismiss>{content}</SwipeToDismiss>;
}

const dismiss = () => {
  fireSelectionHaptic();
  Toast.hide();
};

/**
 * Swipe up to put a toast away. Whatever it reports carries on: a dismissed
 * "Syncing…" leaves the sync running, and its result still shows when it
 * finishes. Driven by Gesture Handler rather than the library's PanResponder,
 * which never received the swipe inside the iOS FullWindowOverlay.
 */
function SwipeToDismiss({ children }: { children: React.ReactNode }) {
  const offset = useSharedValue(0);
  const pan = Gesture.Pan()
    // Vertical only, and only after a real drag, so taps still reach onPress.
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      // Follows the finger up; a downward pull only gives a little.
      offset.value =
        event.translationY < 0 ? event.translationY : event.translationY / 6;
    })
    .onEnd((event) => {
      if (event.translationY < -24 || event.velocityY < -600) {
        runOnJS(dismiss)();
      } else {
        offset.value = withSpring(0);
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
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
  syncing: ({ text1, text2, props }) => (
    <ToastContent
      variant="syncing"
      text1={text1}
      text2={text2}
      onPress={(props as ToastTapProps | undefined)?.onPress}
    />
  ),
};
