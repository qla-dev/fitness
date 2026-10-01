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
  return values.map((value, index) => ({
    ...value,
    x: 24,
    y: top + [0, 82, 194, 298, 402][index],
    size: [48, 40, 34, 34, 28][index],
    weight: index === 0 ? '300' : '400',
    labelSize: index === 1 ? 13 : 12,
    icon:
      value.icon ??
      ([undefined, 'speed', 'calories', 'heart'] as const)[index],
    iconAbove: true,
  }));
}
