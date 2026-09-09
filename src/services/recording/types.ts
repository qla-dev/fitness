export type RecordingSport = 'run' | 'ride';

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
