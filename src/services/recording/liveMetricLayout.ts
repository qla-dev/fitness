import type { PhotoComposition } from './types';
import type { PhotoMetricIcon } from '../../constants/photoMetricIcons';

/**
 * Shared point geometry for the live HUD and the first photo layout, in
 * points of a phone-width (about 390pt) viewport. A reading names its own
 * icon; otherwise the HUD's order supplies one.
 */
export function liveMetricLayout(
  values: {
    text: string;
    unit?: string;
    label?: string;
    icon?: PhotoMetricIcon;
  }[],
  top: number
): PhotoComposition['metrics'] {
  // Rows stack by what they actually draw (icon, reading, label), so a list
  // that is not the HUD's — a photo added after the workout, say, whose first
  // reading carries an icon — never runs one row into the next.
  let y = top;
  return values.map((value, index) => {
    const size = [48, 40, 34, 34, 28][index] ?? 28;
    const labelSize = index === 1 ? 13 : 12;
    const icon =
      value.icon ?? ([undefined, 'speed', 'calories', 'heart'] as const)[index];
    // The lead reading is the large number on its own, as on the HUD: its
    // icon and label are kept only for grid layouts that show them, so they
    // take no room in this stack.
    const lead = index === 0;
    const metric = {
      ...value,
      lead,
      x: 24,
      y,
      size,
      weight: index === 0 ? ('300' as const) : ('400' as const),
      labelSize,
      icon,
      iconAbove: true,
    };
    y +=
      (icon && !lead ? ICON_SIZE : 0) +
      size * 1.2 +
      (value.label && !lead ? labelSize * 1.2 : 0) +
      ROW_GAP;
    return metric;
  });
}

const ICON_SIZE = 24;
const ROW_GAP = 24;
