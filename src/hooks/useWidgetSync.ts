import { useEffect, useRef } from 'react';

import { ExtensionStorage } from '@bacons/apple-targets';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  buildAndroidWidgetSnapshots,
  buildWidgetActivitySnapshot,
  pushAndroidActivitySnapshot,
  pushAndroidCalorieSnapshot,
  pushAndroidMacroSnapshot,
} from '../services/androidWidgetSyncService';
import { addLog } from '../services/LogService';
import type { DailySummary } from '../types/dailySummary';
import { getTodayDate } from '../utils/dateUtils';

const WIDGET_KIND = 'widget';
const CALORIE_SNAPSHOT_KEY = 'calorieSnapshot';
const MACRO_WIDGET_KIND = 'macroWidget';
const MACRO_SNAPSHOT_KEY = 'macroSnapshot';
const ACTIVITY_WIDGET_KIND = 'activityWidget';
const ACTIVITY_SNAPSHOT_KEY = 'activitySnapshot';

const iosAppGroup = (
  Constants.expoConfig?.extra as { iosAppGroup?: string } | undefined
)?.iosAppGroup;

/**
 * Publishes today's figures to the home-screen widgets.
 *
 * `steps` is the health provider's count, which the Dashboard reads beside the
 * summary rather than from it; the Activity widget's inner ring fills from it.
 */
export function useWidgetSync(
  summary: DailySummary | undefined,
  steps?: number | null
): void {
  const date = summary?.date;
  const isToday = date === getTodayDate();
  const lastAndroidCalorieSnapshotKeyRef = useRef<string | null>(null);
  const lastAndroidMacroSnapshotKeyRef = useRef<string | null>(null);
  const lastAndroidActivitySnapshotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isToday || !date || !summary) {
      return;
    }

    const balance = summary.calorieBalance;
    const lastUpdated = Math.floor(Date.now() / 1000);

    if (Platform.OS === 'ios') {
      try {
        if (!iosAppGroup) {
          addLog(
            '[useWidgetSync] iOS app group unavailable; widget snapshots were not written',
            'WARNING'
          );
          return;
        }

        const storage = new ExtensionStorage(iosAppGroup);

        if (balance) {
          const { eaten, burned, goal, remaining, progress } = balance;
          storage.set(CALORIE_SNAPSHOT_KEY, {
            date,
            food: eaten,
            burned,
            goal,
            remaining,
            progress: goal > 0 ? Math.max(0, Math.min(1, progress / 100)) : 0,
            // The inner arc fills burned against the Move goal, as on the
            // Tracker's nutrition card.
            burnGoal: summary.exerciseCaloriesGoal,
            lastUpdated,
          });
        }

        // Goals let each macro ring fill toward its own target, the way the
        // Tracker's nutrient rings do.
        storage.set(MACRO_SNAPSHOT_KEY, {
          date,
          protein: summary.protein.consumed,
          carbs: summary.carbs.consumed,
          fat: summary.fat.consumed,
          calories: summary.caloriesConsumed,
          proteinGoal: summary.protein.goal,
          carbsGoal: summary.carbs.goal,
          fatGoal: summary.fat.goal,
          lastUpdated,
        });

        storage.set(ACTIVITY_SNAPSHOT_KEY, {
          ...buildWidgetActivitySnapshot(summary, steps),
          lastUpdated,
        });

        if (storage.get(MACRO_SNAPSHOT_KEY) === null) {
          addLog(
            '[useWidgetSync] ExtensionStorage unavailable; widget snapshots were not written',
            'WARNING'
          );
          return;
        }

        if (balance) {
          ExtensionStorage.reloadWidget(WIDGET_KIND);
        }
        ExtensionStorage.reloadWidget(MACRO_WIDGET_KIND);
        ExtensionStorage.reloadWidget(ACTIVITY_WIDGET_KIND);
      } catch (error) {
        addLog(
          `[useWidgetSync] Failed to push snapshot to widget: ${error}`,
          'ERROR'
        );
      }
      return;
    }

    if (Platform.OS === 'android') {
      const snapshots = buildAndroidWidgetSnapshots(summary, steps);

      const activitySnapshot = snapshots.activity;
      const activitySnapshotKey = JSON.stringify(activitySnapshot);
      if (lastAndroidActivitySnapshotKeyRef.current !== activitySnapshotKey) {
        lastAndroidActivitySnapshotKeyRef.current = activitySnapshotKey;
        void (async () => {
          try {
            await pushAndroidActivitySnapshot(activitySnapshot, lastUpdated);
          } catch (error) {
            if (
              lastAndroidActivitySnapshotKeyRef.current === activitySnapshotKey
            ) {
              lastAndroidActivitySnapshotKeyRef.current = null;
            }
            addLog(
              `[useWidgetSync] Android activity widget push failed: ${error}`,
              'ERROR'
            );
          }
        })();
      }

      if (snapshots.calorie) {
        const calorieSnapshot = snapshots.calorie;
        const calorieSnapshotKey = JSON.stringify(calorieSnapshot);

        if (lastAndroidCalorieSnapshotKeyRef.current !== calorieSnapshotKey) {
          lastAndroidCalorieSnapshotKeyRef.current = calorieSnapshotKey;
          void (async () => {
            try {
              await pushAndroidCalorieSnapshot(calorieSnapshot, lastUpdated);
            } catch (error) {
              if (
                lastAndroidCalorieSnapshotKeyRef.current === calorieSnapshotKey
              ) {
                lastAndroidCalorieSnapshotKeyRef.current = null;
              }
              addLog(
                `[useWidgetSync] Android calorie widget push failed: ${error}`,
                'ERROR'
              );
            }
          })();
        }
      }

      // Goals ride along so the widget's per-macro bars can show progress
      // toward each goal. Without them the widget can only compare a macro
      // against the day's other macros, which barely moves as the day fills up
      // (#2228). iOS carries the same goals for its per-macro rings.
      const macroSnapshot = snapshots.macro;
      const macroSnapshotKey = JSON.stringify(macroSnapshot);
      if (lastAndroidMacroSnapshotKeyRef.current === macroSnapshotKey) return;

      lastAndroidMacroSnapshotKeyRef.current = macroSnapshotKey;
      void (async () => {
        try {
          await pushAndroidMacroSnapshot(macroSnapshot, lastUpdated);
        } catch (error) {
          if (lastAndroidMacroSnapshotKeyRef.current === macroSnapshotKey) {
            lastAndroidMacroSnapshotKeyRef.current = null;
          }
          addLog(
            `[useWidgetSync] Android macro widget push failed: ${error}`,
            'ERROR'
          );
        }
      })();
    }
  }, [summary, steps, date, isToday]);
}
