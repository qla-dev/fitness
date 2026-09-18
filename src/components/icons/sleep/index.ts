import type React from 'react';
import BedTimeIcon from './BedTimeIcon';
import WakeUpIcon from './WakeUpIcon';

export { BedTimeIcon, WakeUpIcon };

export type SleepIconKind = 'wake' | 'bedtime';

/** Keyed the way `MeasurementIcons` is, so a tile can look either family up. */
export const SleepIcons: Record<
  SleepIconKind,
  React.ComponentType<{
    size?: number;
    color?: string;
    accentColor?: string;
  }>
> = {
  wake: WakeUpIcon,
  bedtime: BedTimeIcon,
};
