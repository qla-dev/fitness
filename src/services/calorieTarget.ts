import {
  ACTIVITY_MULTIPLIERS,
  calculateBmr,
  computeCalorieTarget,
  getGoalModeAdjustment,
  normalizeCalorieGoalAdjustmentMode,
  type GoalMode,
} from '@workspace/shared';
import type { UserPreferences } from '../types/preferences';

/**
 * The day's calorie target once the Calorie settings have had their say,
 * and what they did to it, for the surfaces that explain the number.
 */
export type CalorieTargetInfo = {
  /** The calorie goal as set, before any goal mode. */
  base: number;
  /** What the day actually aims for. */
  target: number;
  goalMode: GoalMode;
  /** User-facing percentage: -15 cuts 15 %, +10 adds 10 %. */
  percent: number;
  /** target − base, in kcal. */
  adjustment: number;
  /** The Calorie Mode picked in settings (adaptive, dynamic, fixed…). */
  calorieMode: string;
  /** Adaptive Goal: the baseline is worked out from the body, not typed. */
  adaptive: boolean;
  /**
   * Adaptive without the weeks of tracking a measured TDEE needs, or without
   * the body data for an estimate: the target leans on the estimate or the
   * typed goal until then.
   */
  learning: boolean;
  /** The safety floor raised the target. */
  clamped: boolean;
  /** The floor in force, or null when it is disabled. */
  floor: number | null;
  safetyZone: 'green' | 'yellow' | 'red';
};

export type CalorieTargetInput = {
  preferences: UserPreferences | undefined;
  /** The day's calorie goal as stored. */
  baseGoal: number;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  gender?: string | null;
};

/**
 * Applies Goal Mode, Calorie Mode and the safety floor to the day's calorie
 * goal, through the shared calculation the web app uses.
 *
 * Adaptive Goal takes its baseline from BMR × activity level; the device
 * keeps no measured TDEE yet, so it stays marked as learning, and without
 * the body data for a BMR it falls back to the typed goal. Every other
 * mode adjusts the typed goal. The safety floor holds up any target a
 * deficit pushes under it, in every mode, not only the adaptive one: a cut
 * applied to a typed goal can go as low as one worked out from the body.
 */
export function resolveCalorieTarget({
  preferences,
  baseGoal,
  weightKg,
  heightCm,
  age,
  gender,
}: CalorieTargetInput): CalorieTargetInfo | null {
  const calorieMode = normalizeCalorieGoalAdjustmentMode(
    preferences?.calorie_goal_adjustment_mode
  );
  const goalMode = (preferences?.goal_mode ?? 'maintain') as GoalMode;
  const customPercentage = preferences?.goal_mode_custom_percentage ?? 0;
  const sex = gender === 'male' || gender === 'female' ? gender : null;
  const bmr =
    weightKg && heightCm && age && sex
      ? calculateBmr(
          preferences?.bmr_algorithm ?? 'Mifflin-St Jeor',
          weightKg,
          heightCm,
          age,
          sex
        )
      : 0;
  const adaptive = calorieMode === 'adaptive';
  const estimated = adaptive && bmr > 0;
  if (!estimated && !(baseGoal > 0)) return null;

  const floorMode = preferences?.calorie_safety_floor_mode ?? 'standard';
  const result = computeCalorieTarget({
    goalMode,
    calculationMethod: estimated ? 'adaptive' : 'manual',
    customPercentage,
    bmr,
    activityLevelMultiplier:
      ACTIVITY_MULTIPLIERS[preferences?.activity_level ?? 'not_much'] ?? 1.2,
    adaptiveTdee: null,
    adaptiveTdeeFallback: true,
    adaptiveTdeeDaysOfData: 0,
    weightKg: weightKg ?? 0,
    heightCm: heightCm ?? 0,
    age: age ?? 0,
    // The lower clinical minimum when sex is unknown: never a floor
    // stricter than the person's own.
    gender: sex ?? 'female',
    bmrAlgorithm: preferences?.bmr_algorithm,
    currentGoalCalories: baseGoal,
    calorieSafetyFloorMode: floorMode,
    calorieSafetyFloorValue: preferences?.calorie_safety_floor_value,
  });
  const deficit = getGoalModeAdjustment(goalMode, customPercentage) > 0;
  const floor = result.effectiveSafetyFloor;
  // Without body data the floor is only the clinical minimum.
  const manualClamp =
    !estimated && deficit && floor !== null && result.finalTarget < floor;
  const target = manualClamp ? floor : result.finalTarget;
  const base = estimated ? result.baselineTdee : baseGoal;
  return {
    base,
    target,
    goalMode,
    percent: Math.round(
      -getGoalModeAdjustment(goalMode, customPercentage) * 100
    ),
    adjustment: target - base,
    calorieMode,
    adaptive,
    learning: adaptive,
    clamped: result.wasClampedToFloor || manualClamp,
    floor,
    safetyZone: result.safetyZone,
  };
}

/** Whole years between a date of birth and a day, or null. */
export function ageOn(dateOfBirth: unknown, day: string): number | null {
  if (typeof dateOfBirth !== 'string' || !dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const on = new Date(day);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getFullYear() - birth.getFullYear();
  if (
    on.getMonth() < birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate())
  )
    age--;
  return age > 0 ? age : null;
}
