import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
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

export function initializeSensors(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!initializing)
    initializing = (async () => {
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
            update({ heartRate: sample.heartRate, heartRateAt: timestamp });
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
