/** Shared vector silhouettes for live readings and their exported photo. */
export const photoMetricIcons = {
  speed:
    'M12 3 A9 9 0 0 0 3 12 A9 9 0 0 0 5 18 L7 16 A6 6 0 1 1 17 16 L19 18 A9 9 0 0 0 12 3 Z M11 14 L17 7 L14 15 Z',
  calories:
    'M13 2 C15 8 20 8 20 14 A8 8 0 0 1 4 14 C4 10 7 7 8 6 C8 11 11 10 13 2 Z',
  heart: 'M12 21 L3 12 C-3 4 7 -1 12 6 C17 -1 27 4 21 12 Z',
  // An hourglass, so time reads apart from the speed gauge.
  duration: 'M6 2 H18 V6 L13 12 L18 18 V22 H6 V18 L11 12 L6 6 Z',
  // A route between two points; a map pin read as the photo's capture pin.
  distance:
    'M2 19 A3 3 0 1 0 8 19 A3 3 0 1 0 2 19 Z M16 5 A3 3 0 1 0 22 5 A3 3 0 1 0 16 5 Z M4 16 V13 H18 V8 H20 V15 H6 V16 Z',
  // Fast-forward, so a top speed reads apart from the pace gauge.
  maxSpeed: 'M2 5 L11 12 L2 19 Z M12 5 L21 12 L12 19 Z',
  elevation: 'M2 20 L9 7 L13 13 L16 9 L22 20 Z',
  cadence: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
} as const;

export type PhotoMetricIcon = keyof typeof photoMetricIcons;
