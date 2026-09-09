import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useCSSVariable } from 'uniwind';

/** Shared icon tile for settings and food menu rows. */
export default function MenuItemIcon({
  children,
  size = 39,
  backgroundColor,
  style,
}: {
  children: ReactNode;
  size?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const defaultBackground = useCSSVariable('--color-menu-icon-bg') as string;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: backgroundColor ?? defaultBackground,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
