import type { PhotoComposition } from './types';

/** Shared point geometry for the live HUD and the first photo layout. */
export function liveMetricLayout(
  values: { text: string; unit?: string; label?: string }[],
  top: number
): PhotoComposition['metrics'] {
  return values.map((value, index) => ({
    ...value,
    x: 24,
    y: top + [0, 82, 194, 298][index],
    size: [48, 40, 34, 34][index],
    weight: index === 0 ? '300' : '400',
    labelSize: index === 1 ? 13 : 12,
    icon: ([undefined, 'speed', 'calories', 'heart'] as const)[index],
    iconAbove: true,
  }));
}
