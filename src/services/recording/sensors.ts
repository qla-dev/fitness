import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  addWatchHeartRateListener,
  addWatchReachabilityListener,
  addWatchWorkoutStateListener,
  isWatchAppInstalled,
  isWatchLinkAvailable,
  isWatchPaired,
  getWatchName,
  startWatchWorkout,
  stopWatchWorkout,
} from '@/modules/watch-link';
import { addLog } from '../LogService';
import {
  CSC_MEASUREMENT,
  CSC_SERVICE,
  HR_MEASUREMENT,
  HR_SERVICE,
  cscDelta,
  parseCsc,
  parseHeartRate,
  type CscCounters,
} from './sensorProtocol';
import type { SensorReading } from './types';

type SensorKind = 'heartRate' | 'bike';
interface SavedSensor {
  id: string;
  name: string;
  kind: SensorKind;
}
interface SensorDevice extends SavedSensor {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
}
interface SensorSnapshot {
  devices: SensorDevice[];
  discovered: SavedSensor[];
  scanning: boolean;
  error: boolean;
  wheelMm: number;
  heartRate: number | null;
  heartRateAt: number;
  /**
   * Which source produced the current heart rate, so the panel can say so. A
   * chest strap and the watch are both plausible at once, and a reading with no
   * attribution reads as a malfunction when the two disagree.
   */
  heartRateSource: 'ble' | 'watch' | null;
  /** The paired watch has an open workout session streaming to us. */
  watchStreaming: boolean;
  /**
   * A paired watch carrying our watch app — the watch is usable as a heart
   * rate source, whether or not it is sending anything yet.
   *
   * Setup has to ask this one rather than {@link watchStreaming}: nothing
   * streams until the session being set up has started, so a screen that asks
   * whether the watch is sending will always answer that there is no watch.
   */
  watchAvailable: boolean;
  /** Paired, but our app is not on it — the one state an install would fix. */
  watchNeedsApp: boolean;
  watchName: string | null;
  cadence: number | null;
  cadenceAt: number;
  speed: number | null;
  speedAt: number;
}
const KEY = '@Fitness/recording-sensors/v1';
let snapshot: SensorSnapshot = {
  devices: [],
  discovered: [],
  scanning: false,
  error: false,
  wheelMm: 2105,
  heartRate: null,
  heartRateAt: 0,
  heartRateSource: null,
  watchStreaming: false,
  watchAvailable: false,
  watchNeedsApp: false,
  watchName: null,
  cadence: null,
  cadenceAt: 0,
  speed: null,
  speedAt: 0,
};
const listeners = new Set<() => void>();
const readings = new Set<(reading: SensorReading) => void>();
export const getSensorSnapshot = () => snapshot;
export const subscribeSensors = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const subscribeSensorReadings = (
  listener: (sample: SensorReading) => void
) => {
  readings.add(listener);
  return () => {
    readings.delete(listener);
  };
};
const update = (patch: Partial<SensorSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
};
let manager: BleManager | undefined;
let initializing: Promise<void> | undefined;
let loading: Promise<void> | undefined;
let saved: SavedSensor[] = [];
const connections = new Map<
  string,
  { device: Device; subscriptions: Subscription[] }
>();
const pending = new Set<string>();
const generations = new Map<string, number>();
const retries = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let persistence: Promise<unknown> = Promise.resolve();
function persist() {
  const value = JSON.stringify({ devices: saved, wheelMm: snapshot.wheelMm });
  persistence = persistence
    .catch(() => {})
    .then(() => AsyncStorage.setItem(KEY, value));
  return persistence;
}
const status = (sensor: SavedSensor, state: SensorDevice['status']) =>
  update({
    devices: [
      ...snapshot.devices.filter((d) => d.id !== sensor.id),
      { ...sensor, status: state },
    ],
  });
function report(error: unknown) {
  update({ error: true });
  addLog('[Recording sensors] Connection error', 'WARNING', [String(error)]);
}

async function permissions() {
  if (Platform.OS !== 'android') return;
  const wanted =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (
    !Object.values(result).every(
      (v) => v === PermissionsAndroid.RESULTS.GRANTED
    )
  )
    throw new Error('Bluetooth permission denied');
}

/**
 * Reads the remembered devices and wheel size. Touches no radio and prompts for
 * nothing, so it is safe on every launch.
 */
export function loadSavedSensors(): Promise<void> {
  if (!loading)
    loading = (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        saved = Array.isArray(parsed.devices)
          ? parsed.devices.filter(
              (d: SavedSensor) =>
                typeof d.id === 'string' &&
                typeof d.name === 'string' &&
                (d.kind === 'heartRate' || d.kind === 'bike')
            )
          : [];
        update({
          wheelMm:
            Number.isFinite(parsed.wheelMm) &&
            parsed.wheelMm >= 500 &&
            parsed.wheelMm <= 4000
              ? parsed.wheelMm
              : 2105,
          devices: saved.map((d) => ({ ...d, status: 'disconnected' })),
        });
      }
    })().catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/**
 * Creates the BLE client. On iOS this is what raises the system Bluetooth
 * prompt, and `restoreStateIdentifier` lets CoreBluetooth relaunch the app for
 * sensor traffic, so it is deliberately never called from app startup - only
 * from an explicit scan/connect, or from `resumeSavedSensors` below.
 */
function initializeSensors(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!initializing)
    initializing = (async () => {
      await loadSavedSensors();
      const { BleManager: Manager } = await import('react-native-ble-plx');
      manager = new Manager({
        restoreStateIdentifier: 'fitness-recording-sensors',
        restoreStateFunction: (state) => {
          // Reattach monitors through the same connection path after CoreBluetooth restoration.
          if (state)
            setTimeout(
              () =>
                saved.forEach((sensor) => {
                  void connectSensor(sensor.id).catch(report);
                }),
              0
            );
        },
      });
      manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          update({ error: false });
          for (const sensor of saved) {
            retries.delete(sensor.id);
            void connectSensor(sensor.id).catch(report);
          }
        } else if (state === 'PoweredOff') {
          stopSensorScan();
          update({ heartRate: null, cadence: null, speed: null });
        }
      }, true);
    })().catch((error) => {
      initializing = undefined;
      report(error);
      throw error;
    });
  return initializing;
}

/**
 * Reconnects remembered sensors. The BLE client is created only once the user
 * has actually paired something, so a launch by someone who never has stays off
 * the radio entirely.
 */
export async function resumeSavedSensors(): Promise<void> {
  if (Platform.OS === 'web') return;
  await loadSavedSensors();
  if (saved.length) await initializeSensors();
}

export function stopSensorScan() {
  if (scanTimer) clearTimeout(scanTimer);
  manager?.stopDeviceScan();
  update({ scanning: false });
}

export async function scanSensors(kind: SensorKind) {
  await initializeSensors();
  await permissions();
  stopSensorScan();
  if (!manager || (await manager.state()) !== 'PoweredOn')
    throw new Error('Bluetooth unavailable');
  update({ scanning: true, discovered: [], error: false });
  scanTimer = setTimeout(stopSensorScan, 20000);
  manager.startDeviceScan(
    [kind === 'heartRate' ? HR_SERVICE : CSC_SERVICE],
    null,
    (error, device) => {
      if (error) {
        stopSensorScan();
        report(error);
        return;
      }
      if (!device || snapshot.discovered.some((d) => d.id === device.id))
        return;
      update({
        discovered: [
          ...snapshot.discovered,
          {
            id: device.id,
            name: device.name ?? device.localName ?? device.id,
            kind,
          },
        ],
      });
    }
  );
}

function reconnect(sensor: SavedSensor) {
  if (!saved.some((d) => d.id === sensor.id)) return;
  const attempt = retries.get(sensor.id) ?? 0;
  if (attempt >= 5) {
    status(sensor, 'disconnected');
    return;
  }
  retries.set(sensor.id, attempt + 1);
  status(sensor, 'reconnecting');
  timers.set(
    sensor.id,
    setTimeout(
      () => {
        timers.delete(sensor.id);
        void connectSensor(sensor.id).catch(report);
      },
      Math.min(15000, 1000 * 2 ** attempt)
    )
  );
}

export async function connectSensor(id: string) {
  // initializeSensors schedules auto-connect asynchronously; never await itself.
  if (!manager) {
    await initializeSensors();
  }
  const sensor =
    saved.find((d) => d.id === id) ??
    snapshot.discovered.find((d) => d.id === id);
  if (!sensor || !manager || pending.has(id) || connections.has(id)) return;
  pending.add(id);
  const generation = generations.get(id) ?? 0;
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  status(sensor, 'connecting');
  let device: Device | undefined;
  try {
    await permissions();
    stopSensorScan();
    device = await manager.connectToDevice(id, { timeout: 10000 });
    await device.discoverAllServicesAndCharacteristics();
    if ((generations.get(id) ?? 0) !== generation) {
      await device.cancelConnection();
      return;
    }
    // A single heart-rate source; two bike sensors may supply wheel and crank.
    if (sensor.kind === 'heartRate')
      for (const other of saved.filter(
        (d) => d.kind === 'heartRate' && d.id !== id
      ))
        await forgetSensor(other.id);
    let previous: CscCounters | null = null;
    let previousAt = 0;
    const subscriptions: Subscription[] = [];
    connections.set(id, { device, subscriptions });
    subscriptions.push(
      device.onDisconnected(() => {
        connections.get(id)?.subscriptions.forEach((s) => s.remove());
        connections.delete(id);
        if (sensor.kind === 'heartRate') update({ heartRate: null });
        else update({ cadence: null, speed: null });
        reconnect(sensor);
      })
    );
    subscriptions.push(
      device.monitorCharacteristicForService(
        sensor.kind === 'heartRate' ? HR_SERVICE : CSC_SERVICE,
        sensor.kind === 'heartRate' ? HR_MEASUREMENT : CSC_MEASUREMENT,
        (error, characteristic) => {
          if (error) {
            report(error);
            return;
          }
          if (!characteristic?.value) return;
          const timestamp = Date.now();
          const sample: SensorReading = {
            timestamp,
            heartRate: null,
            cadence: null,
            speed: null,
            wheelDistance: null,
          };
          if (sensor.kind === 'heartRate') {
            sample.heartRate = parseHeartRate(characteristic.value);
            update({
              heartRate: sample.heartRate,
              heartRateAt: timestamp,
              heartRateSource: sample.heartRate === null ? null : 'ble',
            });
          } else {
            const counters = parseCsc(characteristic.value);
            if (!counters) return;
            if (previous && timestamp - previousAt < 10000)
              Object.assign(
                sample,
                cscDelta(previous, counters, snapshot.wheelMm)
              );
            previous = counters;
            previousAt = timestamp;
            if (sample.cadence !== null)
              update({ cadence: sample.cadence, cadenceAt: timestamp });
            if (sample.speed !== null)
              update({ speed: sample.speed, speedAt: timestamp });
          }
          readings.forEach((fn) => fn(sample));
        }
      )
    );
    if (!saved.some((d) => d.id === id)) saved.push(sensor);
    retries.delete(id);
    status(sensor, 'connected');
    update({ error: false });
    await persist();
  } catch (error) {
    connections.get(id)?.subscriptions.forEach((s) => s.remove());
    connections.delete(id);
    await device?.cancelConnection().catch(() => {});
    if ((generations.get(id) ?? 0) === generation) {
      status(sensor, 'disconnected');
      reconnect(sensor);
    }
    throw error;
  } finally {
    pending.delete(id);
  }
}

export async function forgetSensor(id: string) {
  generations.set(id, (generations.get(id) ?? 0) + 1);
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  saved = saved.filter((d) => d.id !== id);
  const connection = connections.get(id);
  connection?.subscriptions.forEach((s) => s.remove());
  connections.delete(id);
  await connection?.device.cancelConnection().catch(() => {});
  update({
    devices: snapshot.devices.filter((d) => d.id !== id),
    heartRate: null,
    cadence: null,
    speed: null,
  });
  await persist();
}

export async function setWheelCircumference(mm: number) {
  if (!Number.isFinite(mm) || mm < 500 || mm > 4000)
    throw new Error('Invalid wheel circumference');
  update({ wheelMm: mm });
  await persist();
}

// ---------------------------------------------------------------------------
// Apple Watch heart rate
//
// The watch app holds an HKWorkoutSession open and streams each beat over
// WatchConnectivity. That session is what makes it live: heart rate written to
// HealthKit without one only reaches the phone when the watch next syncs, which
// is batched and can lag by minutes.
// ---------------------------------------------------------------------------

/**
 * A connected chest strap wins over the watch. Both measure the same thing, but
 * a strap samples continuously from the chest while the watch is optical and
 * lags on hard efforts, and interleaving the two would produce a series that
 * jumps between them mid-effort.
 */
const hasBleHeartRateSensor = () =>
  snapshot.devices.some(
    (device) => device.kind === 'heartRate' && device.status === 'connected'
  );

let watchSubscriptions: { remove: () => void }[] = [];
let watchStartPromise: Promise<void> | null = null;
let watchGeneration = 0;

export class WatchWorkoutStartError extends Error {
  constructor() {
    super('Apple Watch did not confirm a running workout');
    this.name = 'WatchWorkoutStartError';
  }
}

/**
 * Re-reads whether a watch is there. WCSession activates asynchronously, so
 * the first read after launch can say no to a watch that is plainly on the
 * wrist; the reachability event fires when activation completes and whenever
 * the link changes, which is when this is worth asking again.
 */
function refreshWatchAvailability() {
  if (Platform.OS !== 'ios' || !isWatchLinkAvailable()) return;
  const installed = isWatchAppInstalled();
  const paired = isWatchPaired() || installed;
  const watchName = paired ? getWatchName() : null;
  if (
    snapshot.watchAvailable === installed &&
    snapshot.watchNeedsApp === (paired && !installed) &&
    snapshot.watchName === watchName
  )
    return;
  update({
    watchAvailable: installed,
    watchNeedsApp: paired && !installed,
    watchName,
  });
}

// Watched for the life of the process rather than per screen: the answer is a
// property of the phone, and every surface that asks reads the same snapshot.
if (Platform.OS === 'ios' && isWatchLinkAvailable()) {
  addWatchReachabilityListener(refreshWatchAvailability);
  refreshWatchAvailability();
}

/**
 * Asks the paired watch to open a workout session and starts feeding its
 * samples into the same pipeline the BLE sensors use.
 *
 * A selected watch must acknowledge a running session before this resolves.
 */
export async function startWatchHeartRate(
  sport: 'run' | 'ride',
  options?: { sportId?: string; startAt?: number }
) {
  if (Platform.OS !== 'ios') return;
  if (!isWatchLinkAvailable()) throw new WatchWorkoutStartError();
  if (watchStartPromise) return watchStartPromise;
  if (watchSubscriptions.length > 0 && snapshot.watchStreaming) return;
  watchSubscriptions.forEach((subscription) => subscription.remove());
  const generation = ++watchGeneration;

  const heartRate = addWatchHeartRateListener(({ bpm, timestamp }) => {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    if (hasBleHeartRateSensor()) return;
    const rounded = Math.round(bpm);
    // The watch stamps each sample with the time the sensor produced it, which
    // can trail the message that carried it; keeping that stamp is what lines
    // the series up with the route rather than with delivery latency.
    const sample: SensorReading = {
      timestamp,
      heartRate: rounded,
      cadence: null,
      speed: null,
      wheelDistance: null,
    };
    update({
      heartRate: rounded,
      heartRateAt: timestamp,
      heartRateSource: 'watch',
    });
    readings.forEach((fn) => fn(sample));
  });

  const state = addWatchWorkoutStateListener(({ state: next }) => {
    const streaming = next === 'running';
    update({
      watchStreaming: streaming,
      ...(streaming || hasBleHeartRateSensor()
        ? {}
        : { heartRate: null, heartRateSource: null }),
    });
  });

  watchSubscriptions = [heartRate, state].filter(
    (subscription): subscription is { remove: () => void } =>
      subscription !== null
  );

  const pending = (async () => {
    try {
      await startWatchWorkout(sport, options);
      if (generation !== watchGeneration)
        throw new Error('Watch start cancelled');
      update({ watchStreaming: true });
    } catch (error) {
      if (generation === watchGeneration) {
        watchSubscriptions.forEach((subscription) => subscription.remove());
        watchSubscriptions = [];
        update({ watchStreaming: false });
      }
      addLog('[Recording sensors] Watch workout start failed', 'WARNING', [
        String(error),
      ]);
      throw new WatchWorkoutStartError();
    } finally {
      if (generation === watchGeneration) watchStartPromise = null;
    }
  })();
  watchStartPromise = pending;
  return pending;
}

/** Ends the watch workout and detaches. Never throws into the save path. */
export async function stopWatchHeartRate() {
  ++watchGeneration;
  watchStartPromise = null;
  watchSubscriptions.forEach((subscription) => subscription.remove());
  watchSubscriptions = [];
  if (snapshot.watchStreaming || snapshot.heartRateSource === 'watch')
    update({
      watchStreaming: false,
      ...(snapshot.heartRateSource === 'watch'
        ? { heartRate: null, heartRateSource: null }
        : {}),
    });
  if (Platform.OS !== 'ios' || !isWatchLinkAvailable()) return;
  try {
    await stopWatchWorkout();
  } catch (error) {
    addLog('[Recording sensors] Watch workout stop failed', 'WARNING', [
      String(error),
    ]);
  }
}
