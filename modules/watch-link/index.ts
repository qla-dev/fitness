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
 * Asks the watch app to open a workout session for this sport. Best effort:
 * the watch must be reachable, so callers should treat a live heart rate
 * arriving as the only real confirmation.
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
