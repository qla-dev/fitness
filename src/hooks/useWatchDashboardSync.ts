import { useEffect } from 'react';
import { Platform } from 'react-native';
import { updateWatchDashboard } from '../../modules/watch-link';
import type { DailySummary } from '../types/dailySummary';
import { getTodayDate } from '../utils/dateUtils';
import { addLog } from '../services/LogService';

/** The same daily totals and goals as the phone dashboard; never send a browsed past day. */
export function useWatchDashboardSync(
  summary: DailySummary | undefined,
  measurements:
    { steps?: number | null; stand_hours?: number | null } | null | undefined,
  distance: number | undefined,
  distanceUnit: 'km' | 'miles'
) {
  useEffect(() => {
    if (Platform.OS !== 'ios' || !summary || summary.date !== getTodayDate())
      return;
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
      distance: distance ?? 0,
      distanceUnit,
      calories: summary.caloriesConsumed,
      calorieGoal: summary.calorieGoal,
      water: summary.waterConsumed,
      waterGoal: summary.waterGoal,
    }).catch((error) =>
      addLog('[Watch] Dashboard sync failed', 'WARNING', [String(error)])
    );
  }, [summary, measurements, distance, distanceUnit]);
}
