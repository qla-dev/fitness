import type React from 'react';
import BmrIcon from './BmrIcon';
import BodyFatIcon from './BodyFatIcon';
import BodyWaterIcon from './BodyWaterIcon';
import BoneIcon from './BoneIcon';
import HeightIcon from './HeightIcon';
import HipsIcon from './HipsIcon';
import MuscleIcon from './MuscleIcon';
import NeckIcon from './NeckIcon';
import StepsIcon from './StepsIcon';
import WaistIcon from './WaistIcon';
import WeightIcon from './WeightIcon';

export {
  BmrIcon,
  BodyFatIcon,
  BodyWaterIcon,
  BoneIcon,
  HeightIcon,
  HipsIcon,
  MuscleIcon,
  NeckIcon,
  StepsIcon,
  WaistIcon,
  WeightIcon,
};

export type MeasurementKind =
  | 'weight'
  | 'body_fat_percentage'
  | 'height'
  | 'neck'
  | 'waist'
  | 'hips'
  | 'steps'
  | 'muscle_mass'
  | 'bone_mass'
  | 'body_water'
  | 'bmr';

/**
 * Every field in the registry has a drawn icon, so nothing in the measurements
 * sheet falls back to the generic chart glyph. A new field needs a kind here
 * and a drawing beside it, or its tile will be the only one wearing a symbol
 * from a different family.
 */
export const MeasurementIcons: Record<
  MeasurementKind,
  React.ComponentType<{
    size?: number;
    color?: string;
    accentColor?: string;
  }>
> = {
  weight: WeightIcon,
  body_fat_percentage: BodyFatIcon,
  height: HeightIcon,
  neck: NeckIcon,
  waist: WaistIcon,
  hips: HipsIcon,
  steps: StepsIcon,
  muscle_mass: MuscleIcon,
  bone_mass: BoneIcon,
  body_water: BodyWaterIcon,
  bmr: BmrIcon,
};
