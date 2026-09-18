import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * The box every grid tile's icon sits in.
 *
 * The icons themselves are not one family and cannot be: the measurements use
 * hand-drawn figures that read at 56px, while wake and bedtime use the platform
 * symbol set, which is drawn to a much tighter box and looks wrong blown up to
 * match. Sizing each to taste made every tile a different height and pushed
 * each one's value off a different baseline.
 *
 * So the slot is fixed and the icon is centred in it. A tile asks for this
 * container, not for a size, and any icon of any size lands in the same place.
 */
export const TILE_ICON_SLOT = 56;

export default function TileIconSlot({ children }: { children: ReactNode }) {
  return (
    <View
      className="items-center justify-center"
      style={{ width: TILE_ICON_SLOT, height: TILE_ICON_SLOT }}
    >
      {children}
    </View>
  );
}
