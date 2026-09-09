import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusView from '../components/StatusView';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';

type CartScreenProps = RootStackScreenProps<'Cart'>;

/** Keeps the block clear of the bottom edge before it is centred. */
const EMPTY_STATE_BOTTOM_PADDING = 50;
/** Upward nudge so the centred block does not read as sitting too low. */
const EMPTY_STATE_OPTICAL_OFFSET = -36;

/**
 * The store cart, reached from the cart button in the Exercises store header.
 * Intentionally empty for now: the route, header and empty state exist so the
 * button has somewhere real to go while the cart itself is built out.
 */
const CartScreen: React.FC<CartScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();

  const header = useScreenHeader({
    title: t('cart.title', { defaultValue: 'Cart' }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {/* Optically centred rather than mathematically centred: a block sitting
          on the true centre line reads low, so the empty state is padded off
          the bottom edge and nudged up — the same treatment the empty states
          in putni-nalozi get. The inner block stays plain StatusView. */}
      <View
        className="flex-1"
        style={{
          justifyContent: 'center',
          paddingBottom: insets.bottom + EMPTY_STATE_BOTTOM_PADDING,
          transform: [{ translateY: EMPTY_STATE_OPTICAL_OFFSET }],
        }}
      >
        <StatusView
          icon="cart"
          iconTone="muted"
          iconSize={64}
          title={t('cart.empty', { defaultValue: 'Your cart is empty' })}
          subtitle={t('cart.emptySubtitle', {
            defaultValue: 'Programs you add from the store will show up here.',
          })}
        />
      </View>
    </View>
  );
};

export default CartScreen;
