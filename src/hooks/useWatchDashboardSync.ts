import { useEffect } from 'react';
import { Platform, processColor } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { MACRO_RINGS, resolveMacroRing } from '../constants/macroRings';
import { goalStep, goalMaximum } from '../constants/profileGoals';
import { updateWatchDashboard } from '../../modules/watch-link';
import type { DailySummary } from '../types/dailySummary';
import { getTodayDate } from '../utils/dateUtils';
import { addLog } from '../services/LogService';

/** The same daily totals and goals as the phone dashboard; never send a browsed past day. */
export function useWatchDashboardSync(
  summary: DailySummary | undefined,
  measurements:
    | {
        steps?: number | null;
        stand_hours?: number | null;
        weight?: number | null;
      }
    | null
    | undefined,
  distance: number | undefined,
  distanceUnit: 'km' | 'miles',
  showNetCarbs = false,
  weightUnit: 'kg' | 'lbs' = 'kg'
) {
  const { t } = useTranslation();
  const colors = useCSSVariable(
    MACRO_RINGS.map((spec) => spec.colorVar)
  ) as string[];
  const palette = JSON.stringify(colors);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !summary || summary.date !== getTodayDate())
      return;
    const resolvedColors = JSON.parse(palette) as string[];
    void updateWatchDashboard({
      date: summary.date,
      updatedAt: Date.now(),
      move: summary.activeCalories + summary.otherExerciseCalories,
      moveGoal: summary.exerciseCaloriesGoal,
      exercise: summary.exerciseMinutes,
      exerciseGoal: summary.exerciseMinutesGoal,
      stand: measurements?.stand_hours ?? 0,
      standGoal: summary.goals.stand_hours ?? 0,
      steps: measurements?.steps ?? 0,
      stepsGoal: summary.goals.steps ?? 0,
      distance: distance ?? 0,
      distanceUnit,
      calories: summary.caloriesConsumed,
      calorieGoal: summary.calorieGoal,
      water: summary.waterConsumed,
      waterGoal: summary.waterGoal,
      ...(typeof measurements?.weight === 'number'
        ? { weight: measurements.weight }
        : {}),
      weightUnit,
      nutrients: MACRO_RINGS.map((spec, index) => {
        const color = processColor(resolvedColors[index]);
        return {
          ...resolveMacroRing(spec, summary, showNetCarbs, t),
          goalStep: goalStep(spec.key),
          ...(goalMaximum(spec.key) === undefined
            ? {}
            : { goalMaximum: goalMaximum(spec.key) }),
          color: typeof color === 'number' ? color >>> 0 : 0xffffffff,
        };
      }),
    }).catch((error) =>
      addLog('[Watch] Dashboard sync failed', 'WARNING', [String(error)])
    );
  }, [
    summary,
    measurements,
    distance,
    distanceUnit,
    showNetCarbs,
    t,
    palette,
    weightUnit,
  ]);
}
