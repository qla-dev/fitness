import { requireOptionalNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

export interface WatchHeartRateEvent {
  /** Beats per minute as measured on the watch. */
  bpm: number;
  /** Sample time in epoch milliseconds, taken from the watch sensor. */
  timestamp: number;
}

export interface WatchWorkoutStateEvent {
  state: 'running' | 'stopped';
  sport: 'run' | 'ride';
}

export interface WatchReachabilityEvent {
  isReachable: boolean;
}

interface WatchLinkNativeModule {
  readonly isSupported: boolean;
  readonly isReachable: boolean;
  readonly isWatchAppInstalled: boolean;
  readonly isPaired: boolean;
  startWorkout(
    sport: 'run' | 'ride',
    sportId?: string,
    startAt?: number
  ): Promise<void>;
  stopWorkout(): Promise<void>;
  updateDashboard(snapshot: WatchDashboardSnapshot): Promise<void>;
  updateMetrics(snapshot: WatchWorkoutMetrics): Promise<void>;
  addListener(
    name: 'onHeartRate',
    listener: (event: WatchHeartRateEvent) => void
  ): EventSubscription;
  addListener(
    name: 'onWorkoutState',
    listener: (event: WatchWorkoutStateEvent) => void
  ): EventSubscription;
  addListener(
    name: 'onReachabilityChange',
    listener: (event: WatchReachabilityEvent) => void
  ): EventSubscription;
}

interface WatchDashboardSnapshot {
  date: string;
  updatedAt: number;
  move: number;
  moveGoal: number;
  exercise: number;
  exerciseGoal: number;
  stand: number;
  standGoal: number;
  steps: number;
  distance: number;
  distanceUnit: 'km' | 'miles';
  calories: number;
  calorieGoal: number;
  water: number;
  waterGoal: number;
}

interface WatchWorkoutMetrics {
  sessionId: string;
  startedAt: number;
  timestamp: number;
  phase: 'recording' | 'paused' | 'finished';
  elapsed: number;
  distance: number;
  speed: number;
  maxSpeed: number;
  elevationGain: number;
  calories: number;
}

export async function updateWatchDashboard(
  snapshot: WatchDashboardSnapshot
): Promise<void> {
  await native?.updateDashboard?.(snapshot);
}

export async function updateWatchMetrics(
  snapshot: WatchWorkoutMetrics
): Promise<void> {
  await native?.updateMetrics?.(snapshot);
}

/**
 * Optional on purpose: the module only builds for Apple platforms, so Android
 * and any build made before the watch target existed resolve to null rather
 * than throwing at import time.
 */
const native =
  requireOptionalNativeModule<WatchLinkNativeModule>('QlaFitWatchLink');

/** True when this build can talk to a paired watch at all. */
export const isWatchLinkAvailable = (): boolean => native?.isSupported ?? false;

/** True when the watch app is installed on the paired watch. */
export const isWatchAppInstalled = (): boolean =>
  native?.isWatchAppInstalled ?? false;

/**
 * True when a watch is paired with this phone, app or no app. Reads false on
 * a binary built before the property existed, which makes it safe to combine
 * with {@link isWatchAppInstalled} rather than to rely on alone.
 */
export const isWatchPaired = (): boolean => native?.isPaired ?? false;

/** True when a message sent right now would reach the watch. */
export const isWatchReachable = (): boolean => native?.isReachable ?? false;

/**
 * Launches the paired watch app through HealthKit, then supplies the exact
 * sport over WatchConnectivity. Live heart rate confirms the sensor is ready.
 *
 * `sportId` is the catalogue id from `WORKOUT_SPORTS`, which is what decides
 * the HealthKit activity type and the name the watch shows; without it the
 * watch falls back to running or cycling. `startAt` is when the session
 * starts in epoch ms — the watch counts down to it, and a moment already past
 * simply shows no count.
 */
export async function startWatchWorkout(
  sport: 'run' | 'ride',
  options?: { sportId?: string; startAt?: number }
): Promise<void> {
  await native?.startWorkout(sport, options?.sportId, options?.startAt);
}

export async function stopWatchWorkout(): Promise<void> {
  await native?.stopWorkout();
}

export function addWatchHeartRateListener(
  listener: (event: WatchHeartRateEvent) => void
): EventSubscription | null {
  return native?.addListener('onHeartRate', listener) ?? null;
}

export function addWatchWorkoutStateListener(
  listener: (event: WatchWorkoutStateEvent) => void
): EventSubscription | null {
  return native?.addListener('onWorkoutState', listener) ?? null;
}

export function addWatchReachabilityListener(
  listener: (event: WatchReachabilityEvent) => void
): EventSubscription | null {
  return native?.addListener('onReachabilityChange', listener) ?? null;
}
