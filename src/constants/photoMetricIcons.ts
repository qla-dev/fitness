/** Shared vector silhouettes for live readings and their exported photo. */
export const photoMetricIcons = {
  speed:
    'M12 3 A9 9 0 0 0 3 12 A9 9 0 0 0 5 18 L7 16 A6 6 0 1 1 17 16 L19 18 A9 9 0 0 0 12 3 Z M11 14 L17 7 L14 15 Z',
  calories:
    'M13 2 C15 8 20 8 20 14 A8 8 0 0 1 4 14 C4 10 7 7 8 6 C8 11 11 10 13 2 Z',
  heart: 'M12 21 L3 12 C-3 4 7 -1 12 6 C17 -1 27 4 21 12 Z',
  // An hourglass, so time reads apart from the speed gauge.
  duration: 'M6 2 H18 V6 L13 12 L18 18 V22 H6 V18 L11 12 L6 6 Z',
  distance:
    'M12 2 C8 2 5 5 5 9 C5 14 12 22 12 22 C12 22 19 14 19 9 C19 5 16 2 12 2 Z',
  elevation: 'M2 20 L9 7 L13 13 L16 9 L22 20 Z',
  cadence: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
} as const;

export type PhotoMetricIcon = keyof typeof photoMetricIcons;
