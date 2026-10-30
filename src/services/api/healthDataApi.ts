import { localApiFetch } from '../local/localApi';
import type { SleepStageEvent } from '../../types/mobileHealthData';

interface BaseHealthDataPayloadItem {
  type: string;
  source?: string;
  timestamp?: string;
  date?: string;
  entry_date?: string;
  value?: number;
  /** IANA timezone when available (best source for HealthKit) */
  record_timezone?: string | null;
  /** Fixed UTC offset in minutes (best fallback for Health Connect) */
  record_utc_offset_minutes?: number | null;
}

export interface HealthDataPayloadItem extends BaseHealthDataPayloadItem {
  bedtime?: string;
  wake_time?: string;
  duration_in_seconds?: number;
  time_asleep_in_seconds?: number;
  sleep_score?: number;
  deep_sleep_seconds?: number;
  light_sleep_seconds?: number;
  rem_sleep_seconds?: number;
  awake_sleep_seconds?: number;
  stage_events?: SleepStageEvent[];
  activityType?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  caloriesBurned?: number;
  distance?: number;
  notes?: string;
  raw_data?: unknown;
  sets?: unknown[];
  source_id?: string;
  unit?: string;
  [key: string]: unknown;
}

export type HealthDataPayload = HealthDataPayloadItem[];

/** Per-record rejection reported during a health import. */
export interface RecordSyncError {
  error: string;
  entry?: unknown;
}

/** Outcome of importing health records into the diary. */
export interface HealthDataSyncSummary {
  /** Number of records handled by the import. */
  recordsSent: number;
  /** Records the import could not save. */
  recordErrors: RecordSyncError[];
}

/** Imports Apple Health / Health Connect records into the on-device diary. */
export const syncHealthData = async (
  data: HealthDataPayload
): Promise<HealthDataSyncSummary> =>
  localApiFetch<HealthDataSyncSummary>({
    endpoint: '/api/health-data',
    method: 'POST',
    body: data,
  });

/** Checks that the diary is ready for reads and writes. */
export const checkServerConnection = async (): Promise<boolean> => {
  await localApiFetch({ endpoint: '/api/user-preferences' });
  return true;
};
