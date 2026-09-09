import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { EmptyState } from '../components/EmptyState';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import Icon from '../components/Icon';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';

type CartScreenProps = RootStackScreenProps<'Cart'>;

/**
 * The store cart, reached from the cart button in the Exercises store header.
 * Intentionally empty for now: the route, header and empty state exist so the
 * button has somewhere real to go while the cart itself is built out.
 */
const CartScreen: React.FC<CartScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [headerHeight, setHeaderHeight] = useState(0);
  const iconColor = useCSSVariable('--color-text-muted') as string;

  const header = useScreenHeader({
    title: t('cart.title', { defaultValue: 'Grocery List' }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header && (
        <View
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          {header}
        </View>
      )}
      <View
        className="flex-1 justify-center items-center px-6"
        style={{ paddingBottom: insets.bottom + activeWorkoutBarPadding }}
      >
        <EmptyState
          includeHeaderHeight={true}
          headerHeight={headerHeight}
          icon={<Icon name="cart" size={32} color={iconColor} />}
          title={t('cart.empty', { defaultValue: 'Your grocery list is empty' })}
          description={t('cart.emptySubtitle', {
            defaultValue: 'Items you add to your grocery list will show up here.',
          })}
        />
      </View>
    </View>
  );
};

export default CartScreen;
