import { todayInZone } from '@workspace/shared';
import { CalorieWidgetBridge } from './CalorieWidgetBridge';
import { ensureTimezoneBootstrapped } from './api/preferencesApi';
import {
  buildDailySummary,
  loadDailySummaryRawData,
} from './dailySummaryService';
import type { DailySummary } from '../types/dailySummary';

/**
 * Android widget snapshot contracts mirrored by `parseSnapshot` in the
 * calorie and macro widget Kotlin templates. Optional fields are omitted by
 * JSON serialization, which the native readers interpret as not supplied.
 */
export interface AndroidCalorieSnapshot {
  date: string;
  remaining: number;
  goal: number;
  progress: number;
  /** Eaten, for the outer arc's label. Absent in snapshots written before the arc redesign. */
  food?: number;
  /** Burned, the inner arc. */
  burned?: number;
  /** The Move goal the inner (burned) arc fills against, as the Tracker's card does. */
  burnGoal?: number;
}

/**
 * The Activity rings widget (Move / Exercise / Steps), on both platforms: iOS
 * reads it from the app group as `activitySnapshot`, Android through
 * `setActivitySnapshot`. `steps` is absent when no step count is known — the
 * ring then reads as empty, the way the Dashboard draws a zero.
 */
export interface WidgetActivitySnapshot {
  date: string;
  move: number;
  moveGoal: number;
  exercise: number;
  exerciseGoal: number;
  steps?: number;
  stepsGoal: number;
}

const finiteOrZero = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * The same three figures the Dashboard's Activity Rings card draws. Steps come
 * from the health provider rather than the summary, so the caller passes them;
 * without one, the summary's hourly breakdown stands in.
 */
export function buildWidgetActivitySnapshot(
  summary: DailySummary,
  steps?: number | null
): WidgetActivitySnapshot {
  const resolvedSteps =
    typeof steps === 'number' && Number.isFinite(steps)
      ? steps
      : summary.hourlySteps && summary.hourlySteps.length > 0
        ? summary.hourlySteps.reduce(
            (total, value) => total + finiteOrZero(value),
            0
          )
        : undefined;
  return {
    date: summary.date,
    move: finiteOrZero(summary.activeCalories + summary.otherExerciseCalories),
    moveGoal: finiteOrZero(summary.exerciseCaloriesGoal),
    exercise: finiteOrZero(summary.exerciseMinutes),
    exerciseGoal: finiteOrZero(summary.exerciseMinutesGoal),
    ...(resolvedSteps === undefined ? {} : { steps: resolvedSteps }),
    stepsGoal: finiteOrZero(summary.goals?.steps),
  };
}

export interface AndroidMacroSnapshot {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  remaining?: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

export function buildAndroidWidgetSnapshots(
  summary: DailySummary,
  steps?: number | null
): {
  calorie?: AndroidCalorieSnapshot;
  macro: AndroidMacroSnapshot;
  activity: WidgetActivitySnapshot;
} {
  const balance = summary.calorieBalance;
  const calorie = balance
    ? {
        date: summary.date,
        remaining: balance.remaining,
        goal: balance.goal,
        progress:
          balance.goal > 0
            ? Math.max(0, Math.min(1, balance.progress / 100))
            : 0,
        food: balance.eaten,
        burned: balance.burned,
        burnGoal: summary.exerciseCaloriesGoal,
      }
    : undefined;

  return {
    calorie,
    macro: {
      date: summary.date,
      protein: summary.protein.consumed,
      carbs: summary.carbs.consumed,
      fat: summary.fat.consumed,
      calories: summary.caloriesConsumed,
      remaining: balance?.remaining,
      proteinGoal: summary.protein.goal,
      carbsGoal: summary.carbs.goal,
      fatGoal: summary.fat.goal,
    },
    activity: buildWidgetActivitySnapshot(summary, steps),
  };
}

function serializeWidgetPayload<T extends object>(
  snapshot: T,
  lastUpdated: number
): string {
  return JSON.stringify({ ...snapshot, lastUpdated });
}

export async function pushAndroidCalorieSnapshot(
  snapshot: AndroidCalorieSnapshot,
  lastUpdated = Math.floor(Date.now() / 1000)
): Promise<void> {
  await CalorieWidgetBridge.setCalorieSnapshot(
    serializeWidgetPayload(snapshot, lastUpdated)
  );
  await CalorieWidgetBridge.reloadWidget();
}

export async function pushAndroidMacroSnapshot(
  snapshot: AndroidMacroSnapshot,
  lastUpdated = Math.floor(Date.now() / 1000)
): Promise<void> {
  await CalorieWidgetBridge.setMacroSnapshot(
    serializeWidgetPayload(snapshot, lastUpdated)
  );
  await CalorieWidgetBridge.reloadMacroWidget();
}

export async function pushAndroidActivitySnapshot(
  snapshot: WidgetActivitySnapshot,
  lastUpdated = Math.floor(Date.now() / 1000)
): Promise<void> {
  await CalorieWidgetBridge.setActivitySnapshot(
    serializeWidgetPayload(snapshot, lastUpdated)
  );
  await CalorieWidgetBridge.reloadActivityWidget();
}

export async function refreshAndroidWidgetsFromServer(): Promise<void> {
  const timezone = await ensureTimezoneBootstrapped({ throwOnFailure: true });
  if (!timezone) {
    throw new Error('Account timezone is unavailable for widget refresh');
  }
  const date = todayInZone(timezone);
  const raw = await loadDailySummaryRawData(date);
  const summary = buildDailySummary(date, raw);
  const snapshots = buildAndroidWidgetSnapshots(summary);
  const lastUpdated = Math.floor(Date.now() / 1000);
  const updates: Promise<void>[] = [];

  if (snapshots.calorie) {
    updates.push(pushAndroidCalorieSnapshot(snapshots.calorie, lastUpdated));
  }
  updates.push(pushAndroidMacroSnapshot(snapshots.macro, lastUpdated));
  updates.push(pushAndroidActivitySnapshot(snapshots.activity, lastUpdated));

  const results = await Promise.allSettled(updates);
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (firstFailure) {
    throw firstFailure.reason;
  }
}
