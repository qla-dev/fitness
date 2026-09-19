import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Shared icon tile for settings and food menu rows.
 *
 * Styled with tokens through classNames like the rest of the components here;
 * only the size stays inline, because it is the caller's to choose. It used to
 * resolve its own fill with `useCSSVariable` and set the radius and centring
 * by hand, which made it the one tile in the app whose look could drift from
 * the theme without the theme changing.
 */
export default function MenuItemIcon({
  children,
  size = 39,
  backgroundColor,
  style,
}: {
  children: ReactNode;
  size?: number;
  /** Overrides the themed fill, for tiles that carry a status colour. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      className="bg-menu-icon-bg rounded-lg items-center justify-center"
      style={[
        { width: size, height: size },
        backgroundColor ? { backgroundColor } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
