import type { RecordedPoint, RecordingSession, SensorReading } from './types';

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export const elapsedSeconds = (s: RecordingSession, now = Date.now()) =>
  s.elapsed +
  (s.runningSince === null ? 0 : Math.max(0, now - s.runningSince) / 1000);

// Gross MET estimate, deliberately separate from the heart-rate measurement.
// Unknown HR never fabricates a calorie measurement. Running uses distance;
// cycling uses speed bands. Body mass is entered explicitly before recording.
export function recordingCalories(
  s: Pick<RecordingSession, 'sport' | 'weightKg' | 'distance'>,
  elapsed: number
) {
  if (s.sport === 'run') return Math.round((s.weightKg * s.distance) / 1000);
  const kmh = elapsed > 0 ? (s.distance / elapsed) * 3.6 : 0;
  const met =
    kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22.5 ? 8 : kmh < 25.5 ? 10 : 12;
  return Math.round((met * s.weightKg * elapsed) / 3600);
}

export function summarizeSensors(samples: SensorReading[]) {
  const heart = samples.flatMap((s) =>
    s.heartRate === null ? [] : [s.heartRate]
  );
  const cadence = samples.flatMap((s) =>
    s.cadence === null ? [] : [s.cadence]
  );
  return {
    avgHeartRate: heart.length
      ? Math.round(heart.reduce((a, b) => a + b, 0) / heart.length)
      : null,
    maxHeartRate: heart.length
      ? heart.reduce((a, b) => Math.max(a, b), 0)
      : null,
    avgCadence: cadence.length
      ? Math.round(cadence.reduce((a, b) => a + b, 0) / cadence.length)
      : null,
  };
}

export function recordingSplits(points: RecordedPoint[], unitMeters: number) {
  const splits: { distance: number; seconds: number }[] = [];
  let lastTime = 0;
  let boundary = unitMeters;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (b.distance <= a.distance) continue;
    while (b.distance >= boundary) {
      const time =
        a.elapsed +
        ((b.elapsed - a.elapsed) * (boundary - a.distance)) /
          (b.distance - a.distance);
      splits.push({
        distance: boundary,
        seconds: Math.max(0, time - lastTime),
      });
      lastTime = time;
      boundary += unitMeters;
    }
  }
  return splits;
}

export interface GpsFix {
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
}

/** Stateful, React-free filter; reset at every pause or gap to avoid bridges. */
export class RecordingGpsFilter {
  private previous: GpsFix | null = null;
  private anchor: GpsFix | null = null;
  private altitudeAnchor: number | null = null;
  private altitudes: number[] = [];

  constructor(private sport: 'run' | 'ride') {}

  process(fix: GpsFix) {
    if (
      ![fix.latitude, fix.longitude, fix.timestamp].every(Number.isFinite) ||
      Math.abs(fix.latitude) > 90 ||
      Math.abs(fix.longitude) > 180 ||
      (fix.accuracy !== null &&
        (!Number.isFinite(fix.accuracy) ||
          fix.accuracy < 0 ||
          fix.accuracy > 50))
    )
      return null;
    const previous = this.previous;
    const dt = previous ? (fix.timestamp - previous.timestamp) / 1000 : 0;
    if (previous && dt <= 0) return null;
    const limit = this.sport === 'run' ? 13 : 40;
    const gap = dt > 30;
    if (previous && !gap && distanceMeters(previous, fix) / dt > limit)
      return null;
    if (gap) {
      this.anchor = null;
      this.altitudeAnchor = null;
      this.altitudes = [];
    }
    const nativeSpeed =
      fix.speed !== null &&
      Number.isFinite(fix.speed) &&
      fix.speed >= 0 &&
      fix.speed <= limit
        ? fix.speed
        : null;
    const speed =
      nativeSpeed ??
      (previous && dt > 0 && !gap
        ? Math.min(limit, distanceMeters(previous, fix) / dt)
        : 0);
    let distance = 0;
    const moved = this.anchor ? distanceMeters(this.anchor, fix) : 0;
    if (!this.anchor) this.anchor = fix;
    else if (
      speed >= 0.5 &&
      moved >= Math.max(3, Math.min(8, (fix.accuracy ?? 10) / 2))
    ) {
      distance = moved;
      this.anchor = fix;
    } else if (speed < 0.5) this.anchor = fix;
    let elevation = 0;
    let altitude: number | null = null;
    if (
      fix.altitude !== null &&
      Number.isFinite(fix.altitude) &&
      (fix.altitudeAccuracy === null ||
        (fix.altitudeAccuracy >= 0 && fix.altitudeAccuracy <= 15))
    ) {
      this.altitudes.push(fix.altitude);
      if (this.altitudes.length > 7) this.altitudes.shift();
      const sorted = [...this.altitudes].sort((a, b) => a - b);
      altitude = sorted[Math.floor(sorted.length / 2)];
      if (this.altitudeAnchor === null) this.altitudeAnchor = altitude;
      else if (Math.abs(altitude - this.altitudeAnchor) >= 5) {
        elevation = Math.max(0, altitude - this.altitudeAnchor);
        this.altitudeAnchor = altitude;
      }
    }
    this.previous = fix;
    return { distance, elevation, altitude, speed, gap };
  }
}
