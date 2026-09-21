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
  id: string;
  scope: string;
  sport: RecordingSport;
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
  version: 1;
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
