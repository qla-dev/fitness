export type RecordingSport = 'run' | 'ride';

/** What the session is aiming at. `open` is Quick Start: no target at all. */
export type RecordingGoalType = 'open' | 'time' | 'distance' | 'calories';

export interface RecordingGoal {
  type: RecordingGoalType;
  /**
   * Seconds for `time`, metres for `distance`, kilocalories for
   * `calories`. Always metric and always absolute, so a goal set under one
   * unit preference still reads correctly under another.
   */
  target: number;
}

export interface RecordedPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number;
  distance: number;
  elapsed: number;
  segment: number;
  heartRate: number | null;
  cadence: number | null;
}

export interface SensorReading {
  timestamp: number;
  heartRate: number | null;
  cadence: number | null;
  speed: number | null;
  wheelDistance: number | null;
}

export interface RecordingSession {
  photos?: RecordingPhoto[];
  id: string;
  scope: string;
  /**
   * How the recording behaves: which GPS filter profile it uses and whether
   * wheel sensors apply. Two profiles, on foot and on a bike.
   */
  sport: RecordingSport;
  /**
   * What the session *is*, as opposed to how it records. Tennis and hiking both
   * use the foot profile but are not both "Running", so the saved exercise
   * takes these instead. Resolved when the recording starts — saving happens
   * without a `t`, and a session that outlives a language change should keep
   * the name it was started under.
   */
  sportName?: string;
  sportCategory?: string;
  /**
   * Whether the phone traces a route. Off for a session indoors or on a court,
   * where a track is noise: the clock, the sensors and the calorie estimate
   * all still run. Undefined on a recording started before this existed, which
   * is why every read treats only `false` as off.
   */
  gps?: boolean;
  /**
   * Whether a paired watch streams its heart rate into the session. Off leaves
   * the reading to a chest strap, or to nothing. Undefined on a recording
   * started before this existed, so only `false` counts as off.
   */
  watch?: boolean;
  phase: 'recording' | 'paused' | 'finished';
  startedAt: number;
  updatedAt: number;
  speedUpdatedAt?: number;
  entryDate: string;
  elapsed: number;
  runningSince: number | null;
  distance: number;
  elevationGain: number;
  maxSpeed: number;
  speed: number;
  weightKg: number;
  segment: number;
  exerciseId?: string;
  /** Absent on sessions started before goals existed, and on Quick Start. */
  goal?: RecordingGoal;
  saveAttempted?: boolean;
}

export interface RecordingDetail {
  photos?: RecordingPhoto[];
  version: 1;
  /** Daily totals from this provider already include this watch-recorded effort. */
  healthSource?: 'HealthKit';
  recordingId: string;
  sport: RecordingSport;
  startedAt: number;
  endedAt: number;
  elapsed: number;
  distance: number;
  elevationGain: number;
  maxSpeed: number;
  calories: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  points: RecordedPoint[];
  sensors: SensorReading[];
}

export const RECORDING_DETAIL_TYPE = 'fitness_recording_v1';

export interface RecordingPhoto {
  fileName: string;
  capturedAt: number;
  originalFileName?: string;
  composition?: PhotoComposition;
}

export interface PhotoComposition {
  width: number;
  height: number;
  top: number;
  metrics: { text: string; x: number; y: number; size: number }[];
  route: { latitude: number; longitude: number; segment: number }[];
}
