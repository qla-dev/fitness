import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { randomUUID } from 'expo-crypto';
import type { TFunction } from 'i18next';
import {
  createExercise,
  createExerciseEntry,
  fetchExerciseHistory,
  searchExercises,
  type CreateExerciseEntryPayload,
} from '../api/exerciseApi';
import { getActiveServerConfig } from '../storage';
import { isLocalDataMode } from '../dataMode';
import { getTodayDate } from '../../utils/dateUtils';
import { addLog } from '../LogService';
import {
  checkpointRecording,
  clearRecording,
  loadRecording,
  recordingSamples,
} from './database';
import {
  elapsedSeconds,
  RecordingGpsFilter,
  recordingCalories,
  summarizeSensors,
} from './metrics';
import {
  getSensorSnapshot,
  loadSavedSensors,
  resumeSavedSensors,
  startWatchHeartRate,
  stopWatchHeartRate,
  subscribeSensorReadings,
} from './sensors';
import {
  RECORDING_DETAIL_TYPE,
  type RecordedPoint,
  type RecordingGoal,
  type RecordingDetail,
  type RecordingSession,
  type RecordingSport,
  type SensorReading,
} from './types';
import type { IndividualSessionResponse } from '@workspace/shared';

export const RECORDING_TASK = 'fitness-run-ride-location-v1';
interface Snapshot {
  session: RecordingSession | null;
  points: RecordedPoint[];
  error: boolean;
  ready: boolean;
}
let snapshot: Snapshot = {
  session: null,
  points: [],
  error: false,
  ready: false,
};
const listeners = new Set<() => void>();
export const getRecordingSnapshot = () => snapshot;
export const subscribeRecording = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function publish(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
}
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const task = queue.then(work);
  queue = task.catch(() => {});
  return task;
}
let hydration: Promise<void> | undefined;
let filter: RecordingGpsFilter | undefined;
let wheelAt = 0;
let sensorSubscription: (() => void) | undefined;

async function scope() {
  if (isLocalDataMode()) return 'local';
  const config = await getActiveServerConfig();
  if (!config) throw new Error('No active server');
  return config.id;
}
async function assertScope(s: RecordingSession) {
  if (s.scope !== (await scope()))
    throw new Error('Recording belongs to another data profile');
}
function reducedPath(points: RecordedPoint[]) {
  const stride = Math.max(1, Math.ceil(points.length / 1500));
  return points.filter(
    (p, i) =>
      i % stride === 0 ||
      i === points.length - 1 ||
      p.segment !== points[i - 1]?.segment
  );
}
async function hydrate() {
  if (!hydration)
    hydration = (async () => {
      const session = await loadRecording();
      const points = session
        ? await recordingSamples<RecordedPoint>(session.id, 'gps')
        : [];
      if (session) filter = new RecordingGpsFilter(session.sport);
      publish({ session, points: reducedPath(points), ready: true });
    })().catch((error) => {
      hydration = undefined;
      throw error;
    });
  return hydration;
}
function report(error: unknown) {
  publish({ error: true });
  addLog('[Run or Ride] Recording operation failed', 'ERROR', [String(error)]);
}

/**
 * `sensors` opts into the radio. Creating the BLE client raises the iOS
 * Bluetooth prompt and, with state restoration, lets CoreBluetooth relaunch the
 * app for sensor traffic - neither belongs on a cold launch by someone who is
 * not recording, so app startup passes nothing and only an unfinished session
 * pulls the sensors back up. The recorder screen passes `true`.
 */
export async function initializeRecorder({
  sensors = false,
}: { sensors?: boolean } = {}) {
  if (Platform.OS === 'web') {
    publish({ ready: true });
    return;
  }
  await serialize(async () => {
    await hydrate();
    const s = snapshot.session;
    if (s?.phase === 'recording') {
      const active =
        await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK);
      // A cold process with no live native task cannot claim the intervening
      // time was recorded. Preserve the last committed interval for recovery.
      if (!active) {
        const next = {
          ...s,
          elapsed: elapsedSeconds(s, s.updatedAt),
          runningSince: null,
          phase: 'paused' as const,
          segment: s.segment + 1,
        };
        await checkpointRecording(next);
        publish({ session: next });
      }
    } else if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))
      await Location.stopLocationUpdatesAsync(RECORDING_TASK);
  });
  if (!sensorSubscription)
    sensorSubscription = subscribeSensorReadings((reading) => {
      void recordSensor(reading).catch(report);
    });
  // Remembered devices are read either way so the sensor panel can list them.
  await loadSavedSensors();
  if (
    sensors ||
    snapshot.session?.phase === 'recording' ||
    snapshot.session?.phase === 'paused'
  )
    await resumeSavedSensors();
}

async function recordSensor(reading: SensorReading) {
  return serialize(async () => {
    await hydrate();
    const s = snapshot.session;
    if (
      !s ||
      s.phase !== 'recording' ||
      reading.timestamp < (s.runningSince ?? Infinity)
    )
      return;
    let next = { ...s, updatedAt: reading.timestamp };
    if (
      s.sport === 'ride' &&
      reading.speed !== null &&
      reading.wheelDistance !== null
    ) {
      // First frame after acquisition/reconnect establishes the handoff; never
      // add a wheel interval that has already been credited by GPS.
      const fresh = reading.timestamp - wheelAt < 5000;
      next = {
        ...next,
        distance: s.distance + (fresh ? reading.wheelDistance : 0),
        speed: reading.speed,
        maxSpeed: Math.max(s.maxSpeed, reading.speed),
      };
      wheelAt = reading.timestamp;
    }
    await checkpointRecording(next, [], [reading]);
    publish({ session: next });
  });
}

export async function ingestLocations(locations: Location.LocationObject[]) {
  return serialize(async () => {
    await hydrate();
    const initial = snapshot.session;
    if (!initial || initial.phase !== 'recording') return;
    filter ??= new RecordingGpsFilter(initial.sport);
    let s = { ...initial };
    const points: RecordedPoint[] = [];
    for (const location of [...locations].sort(
      (a, b) => a.timestamp - b.timestamp
    )) {
      if (location.timestamp < (s.runningSince ?? Infinity)) continue;
      const result = filter.process({
        timestamp: location.timestamp,
        ...location.coords,
      });
      if (!result) continue;
      const sensors = getSensorSnapshot();
      const wheel =
        s.sport === 'ride' &&
        location.timestamp >= wheelAt &&
        location.timestamp - wheelAt < 5000;
      s = {
        ...s,
        updatedAt: Math.max(s.updatedAt, location.timestamp),
        distance: s.distance + (wheel ? 0 : result.distance),
        elevationGain: s.elevationGain + result.elevation,
        speed: wheel ? s.speed : result.speed,
        maxSpeed: Math.max(s.maxSpeed, wheel ? s.speed : result.speed),
        segment: s.segment + (result.gap ? 1 : 0),
      };
      points.push({
        timestamp: location.timestamp,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: result.altitude,
        speed: s.speed,
        distance: s.distance,
        elapsed: elapsedSeconds(s, location.timestamp),
        segment: s.segment,
        heartRate:
          Math.abs(location.timestamp - sensors.heartRateAt) < 10000
            ? sensors.heartRate
            : null,
        cadence:
          s.sport === 'ride' &&
          Math.abs(location.timestamp - sensors.cadenceAt) < 5000
            ? sensors.cadence
            : null,
      });
    }
    if (!points.length) return;
    try {
      await checkpointRecording(s, points);
      publish({
        session: s,
        points: reducedPath([...snapshot.points, ...points]),
        error: false,
      });
    } catch (error) {
      // The filter already consumed these fixes: pause visibly rather than
      // silently continue with aggregate state ahead of durable samples.
      filter = undefined;
      publish({
        session: {
          ...initial,
          elapsed: elapsedSeconds(initial, initial.updatedAt),
          runningSince: null,
          phase: 'paused',
          segment: initial.segment + 1,
        },
      });
      throw error;
    }
  });
}

if (Platform.OS !== 'web')
  TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
    if (error) {
      report(error);
      return;
    }
    if (
      data &&
      typeof data === 'object' &&
      'locations' in data &&
      Array.isArray(data.locations)
    ) {
      try {
        await ingestLocations(data.locations);
      } catch (failure) {
        report(failure);
      }
    }
  });

async function startLocation(t: TFunction) {
  if (Platform.OS === 'web') throw new Error('Native location required');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted || permission.android?.accuracy === 'coarse')
    throw new Error('Precise location permission required');
  if (Platform.OS === 'ios') {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted)
      throw new Error('Background location permission required');
  }
  await Location.startLocationUpdatesAsync(RECORDING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: t('recording.notificationTitle', {
        defaultValue: 'Run or ride in progress',
      }),
      notificationBody: t('recording.notificationBody', {
        defaultValue: 'Recording your route and fitness sensors.',
      }),
      killServiceOnDestroy: true,
    },
  });
}

export async function startRecording(
  sport: RecordingSport,
  weightKg: number,
  t: TFunction,
  goal?: RecordingGoal
) {
  return serialize(async () => {
    await hydrate();
    if (snapshot.session) throw new Error('An unfinished recording exists');
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400)
      throw new Error('Invalid body weight');
    const now = Date.now();
    const session: RecordingSession = {
      id: randomUUID(),
      scope: await scope(),
      sport,
      phase: 'paused',
      startedAt: now,
      updatedAt: now,
      entryDate: getTodayDate(),
      elapsed: 0,
      runningSince: null,
      distance: 0,
      elevationGain: 0,
      maxSpeed: 0,
      speed: 0,
      weightKg,
      segment: 0,
      ...(goal && goal.type !== 'open' ? { goal } : {}),
    };
    await checkpointRecording(session);
    publish({ session, error: false });
    filter = new RecordingGpsFilter(sport);
    wheelAt = 0;
    await startLocation(t);
    const next = {
      ...session,
      phase: 'recording' as const,
      runningSince: Date.now(),
    };
    await checkpointRecording(next);
    publish({ session: next });
    // Best effort and deliberately not awaited into the failure path: a watch
    // that is asleep, unpaired, or without the app installed must not stop a
    // run from being recorded on the phone.
    void startWatchHeartRate(sport);
  });
}

export async function pauseRecording(finish = false) {
  return serialize(async () => {
    await hydrate();
    const s = snapshot.session;
    if (!s || s.phase === 'finished') return;
    const now = Date.now();
    const next = {
      ...s,
      phase: finish ? ('finished' as const) : ('paused' as const),
      elapsed: elapsedSeconds(s, now),
      runningSince: null,
      updatedAt: now,
      speed: 0,
      segment: s.segment + 1,
    };
    await checkpointRecording(next);
    publish({ session: next });
    filter = undefined;
    wheelAt = 0;
    if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))
      await Location.stopLocationUpdatesAsync(RECORDING_TASK);
    // A pause deliberately leaves the watch session open: recordSensor drops
    // anything outside the recording phase, so nothing is mis-credited, and
    // resuming costs nothing. Only finishing ends the workout on the watch.
    if (finish) void stopWatchHeartRate();
  });
}

export async function resumeRecording(t: TFunction) {
  return serialize(async () => {
    await hydrate();
    const s = snapshot.session;
    if (!s || s.phase !== 'paused') return;
    await assertScope(s);
    await startLocation(t);
    const next = {
      ...s,
      runningSince: Date.now(),
      updatedAt: Date.now(),
      phase: 'recording' as const,
    };
    await checkpointRecording(next);
    filter = new RecordingGpsFilter(s.sport);
    wheelAt = 0;
    publish({ session: next, error: false });
  });
}

export async function discardRecording() {
  return serialize(async () => {
    await hydrate();
    if (!snapshot.session) return;
    if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))
      await Location.stopLocationUpdatesAsync(RECORDING_TASK);
    await clearRecording(snapshot.session.id);
    publish({ session: null, points: [], error: false });
    filter = undefined;
    wheelAt = 0;
    // Discarding abandons a session that may never have been finished, so the
    // watch workout has to be ended here too or it would run until the battery
    // died.
    void stopWatchHeartRate();
  });
}

export async function saveRecording(): Promise<IndividualSessionResponse> {
  return serialize(async () => {
    await hydrate();
    let s = snapshot.session;
    if (!s || s.phase !== 'finished')
      throw new Error('Finish the recording first');
    await assertScope(s);
    // A retry after an uncertain HTTP response first finds the recording marker
    // in history. Local POSTs additionally deduplicate atomically by this id.
    if (s.saveAttempted) {
      let page = 1;
      while (true) {
        const history = await fetchExerciseHistory(page, 100);
        const existing = history.sessions.find(
          (entry) =>
            entry.type === 'individual' &&
            entry.activity_details.some(
              (d) =>
                d.detail_type === RECORDING_DETAIL_TYPE &&
                typeof d.detail_data === 'object' &&
                d.detail_data !== null &&
                'recordingId' in d.detail_data &&
                d.detail_data.recordingId === s!.id
            )
        );
        if (existing?.type === 'individual') {
          await clearRecording(s.id);
          publish({ session: null, points: [] });
          return existing;
        }
        if (!history.pagination.hasMore) break;
        page++;
      }
    }
    const exerciseName = s.sport === 'run' ? 'Running' : 'Cycling';
    if (!s.exerciseId) {
      const existing = (await searchExercises(exerciseName)).find(
        (exercise) =>
          exercise.name === exerciseName &&
          exercise.modality === 'duration_distance'
      );
      const exercise =
        existing ??
        (await createExercise({
          name: exerciseName,
          category: 'Cardio',
          modality: 'duration_distance',
          description: null,
        }));
      s = { ...s, exerciseId: exercise.id };
      await checkpointRecording(s);
      publish({ session: s });
    }
    const points = await recordingSamples<RecordedPoint>(s.id, 'gps');
    const sensors = await recordingSamples<SensorReading>(s.id, 'sensor');
    const detail: RecordingDetail = {
      version: 1,
      recordingId: s.id,
      sport: s.sport,
      startedAt: s.startedAt,
      endedAt: s.updatedAt,
      elapsed: s.elapsed,
      distance: s.distance,
      elevationGain: s.elevationGain,
      maxSpeed: s.maxSpeed,
      calories: recordingCalories(s, s.elapsed),
      ...summarizeSensors(sensors),
      points,
      sensors,
    };
    const payload: CreateExerciseEntryPayload = {
      exercise_id: s.exerciseId!,
      entry_date: s.entryDate,
      duration_minutes: s.elapsed / 60,
      distance: s.distance / 1000,
      calories_burned: detail.calories,
      avg_heart_rate: detail.avgHeartRate,
      max_heart_rate: detail.maxHeartRate,
      avg_speed_mps: s.elapsed ? s.distance / s.elapsed : 0,
      max_speed_mps: s.maxSpeed,
      avg_cadence: detail.avgCadence,
      elevation_gain_meters: s.elevationGain,
      elapsed_time_seconds: s.elapsed,
      activity_details: [
        {
          id: s.id,
          provider_name: 'fitness',
          detail_type: RECORDING_DETAIL_TYPE,
          detail_data: detail,
        },
      ],
    };
    s = { ...s, saveAttempted: true };
    await checkpointRecording(s);
    publish({ session: s });
    const entry = await createExerciseEntry(payload);
    // Clearing only after acknowledgement preserves a retryable recording on error.
    await clearRecording(s.id);
    publish({ session: null, points: [], error: false });
    return { ...entry, type: 'individual', name: exerciseName };
  });
}
