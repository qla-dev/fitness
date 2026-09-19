import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';

import CalciumIcon from '../components/icons/nutrition/CalciumIcon';
import CarbsIcon from '../components/icons/nutrition/CarbsIcon';
import CholesterolIcon from '../components/icons/nutrition/CholesterolIcon';
import FatIcon from '../components/icons/nutrition/FatIcon';
import FiberIcon from '../components/icons/nutrition/FiberIcon';
import IronIcon from '../components/icons/nutrition/IronIcon';
import MonoFatIcon from '../components/icons/nutrition/MonoFatIcon';
import PolyFatIcon from '../components/icons/nutrition/PolyFatIcon';
import PotassiumIcon from '../components/icons/nutrition/PotassiumIcon';
import ProteinIcon from '../components/icons/nutrition/ProteinIcon';
import SaturatedFatIcon from '../components/icons/nutrition/SaturatedFatIcon';
import SodiumIcon from '../components/icons/nutrition/SodiumIcon';
import SugarsIcon from '../components/icons/nutrition/SugarsIcon';
import TransFatIcon from '../components/icons/nutrition/TransFatIcon';
import VitaminAIcon from '../components/icons/nutrition/VitaminAIcon';
import VitaminCIcon from '../components/icons/nutrition/VitaminCIcon';
import { calculateNutrientTotal } from '../services/api/foodEntriesApi';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import { NUTRIENT_META, getNutrientLabel } from './nutrients';
import { localizeNutrientKey } from '../utils/nutrientLocalization';
import type { DailySummary } from '../types/dailySummary';
import type { FoodEntry } from '../types/foodEntries';

/** The mark above a macro ring, drawn in that macro's own colour. */
export type MacroGlyph = ComponentType<{
  size?: number;
  color?: string;
  accentColor?: string;
}>;

export interface MacroRingSpec {
  /** Matches the `NUTRIENT_META` / `DailyGoals` key, so unit and goal follow. */
  key: string;
  colorVar: string;
  Glyph: MacroGlyph;
}

/**
 * The nutrient the strip is centred on every time the screen is opened.
 *
 * Carbs, protein and fat sit together in the middle of the full list, with
 * protein centred in the viewport and other nutrients reachable on both sides.
 */
export const CENTRED_MACRO_KEY = 'protein';

/**
 * Every nutrient the Tracker draws a ring for, in the order they scroll.
 *
 * Carbs, protein and fat occupy the middle. The remaining nutrients keep their
 * relative order on either side; opening the Tracker scrolls to protein.
 *
 * `glycemic_index` is deliberately absent. It is stored as a string and is an
 * index rather than an amount, so there is nothing to total or to fill a ring
 * against. Custom nutrients are absent for a different reason: they are
 * user-defined and so have no glyph and no colour of their own.
 */
export const MACRO_RINGS: MacroRingSpec[] = [
  {
    key: 'dietary_fiber',
    colorVar: '--color-macro-fiber',
    Glyph: FiberIcon,
  },
  { key: 'sugars', colorVar: '--color-macro-sugars', Glyph: SugarsIcon },
  {
    key: 'saturated_fat',
    colorVar: '--color-macro-saturated-fat',
    Glyph: SaturatedFatIcon,
  },
  {
    key: 'monounsaturated_fat',
    colorVar: '--color-macro-mono-fat',
    Glyph: MonoFatIcon,
  },
  {
    key: 'polyunsaturated_fat',
    colorVar: '--color-macro-poly-fat',
    Glyph: PolyFatIcon,
  },
  {
    key: 'trans_fat',
    colorVar: '--color-macro-trans-fat',
    Glyph: TransFatIcon,
  },
  { key: 'carbs', colorVar: '--color-macro-carbs', Glyph: CarbsIcon },
  {
    key: CENTRED_MACRO_KEY,
    colorVar: '--color-macro-protein',
    Glyph: ProteinIcon,
  },
  { key: 'fat', colorVar: '--color-macro-fat', Glyph: FatIcon },
  {
    key: 'cholesterol',
    colorVar: '--color-macro-cholesterol',
    Glyph: CholesterolIcon,
  },
  { key: 'sodium', colorVar: '--color-macro-sodium', Glyph: SodiumIcon },
  {
    key: 'potassium',
    colorVar: '--color-macro-potassium',
    Glyph: PotassiumIcon,
  },
  { key: 'calcium', colorVar: '--color-macro-calcium', Glyph: CalciumIcon },
  { key: 'iron', colorVar: '--color-macro-iron', Glyph: IronIcon },
  {
    key: 'vitamin_a',
    colorVar: '--color-macro-vitamin-a',
    Glyph: VitaminAIcon,
  },
  {
    key: 'vitamin_c',
    colorVar: '--color-macro-vitamin-c',
    Glyph: VitaminCIcon,
  },
];

export interface ResolvedMacroRing {
  key: string;
  label: string;
  consumed: number;
  /** 0 when no target is set, which the ring reads as "no goal". */
  goal: number;
  unit: string;
}

/**
 * The day's figure and target for one ring.
 *
 * Protein, carbs, fat and fiber read the daily summary, because those totals carry
 * the supplement contribution and the goal adjustments that goal mode applies.
 * The rest have no summary field and are summed from the day's entries here;
 * supplements do not report them, so the entries are the whole of it.
 */
export function resolveMacroRing(
  spec: MacroRingSpec,
  summary: DailySummary,
  showNetCarbs: boolean,
  t: TFunction
): ResolvedMacroRing {
  const unit = NUTRIENT_META[spec.key]?.unit ?? 'g';

  if (spec.key === 'protein') {
    return {
      key: spec.key,
      label: localizeNutrientKey(t, 'protein'),
      consumed: summary.protein.consumed,
      goal: summary.protein.goal,
      unit,
    };
  }
  if (spec.key === 'carbs') {
    return {
      key: spec.key,
      label: localizeNutrientKey(t, showNetCarbs ? 'netCarbs' : 'carbs'),
      consumed: showNetCarbs
        ? getNetCarbsValue(summary.carbs.consumed, summary.fiber.consumed)
        : summary.carbs.consumed,
      goal: summary.carbs.goal,
      unit,
    };
  }
  if (spec.key === 'fat') {
    return {
      key: spec.key,
      label: localizeNutrientKey(t, 'fat'),
      consumed: summary.fat.consumed,
      goal: summary.fat.goal,
      unit,
    };
  }
  if (spec.key === 'dietary_fiber') {
    return {
      key: spec.key,
      label: getNutrientLabel(t, spec.key),
      consumed: summary.fiber.consumed,
      goal: summary.fiber.goal,
      unit,
    };
  }

  const goals = summary.goals as unknown as Record<string, number | undefined>;
  return {
    key: spec.key,
    label: getNutrientLabel(t, spec.key),
    consumed: calculateNutrientTotal(
      summary.foodEntries,
      spec.key as keyof FoodEntry
    ),
    goal: goals[spec.key] ?? 0,
    unit,
  };
}
