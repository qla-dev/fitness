import type { ActivityDetailResponse } from '@workspace/shared';
import type { WorkoutGpsPoint, WorkoutHrSample } from '../types/healthRecords';
import { RECORDING_DETAIL_TYPE } from '../services/recording/types';

/** Read both persisted recording formats, including transformed local imports. */
export function activityTelemetry(details: readonly ActivityDetailResponse[]) {
  const hr = new Map<string, WorkoutHrSample>();
  let gps: WorkoutGpsPoint[] = [];
  const add = (time: unknown, bpm: unknown) => {
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) return;
    if (typeof time !== 'string' && typeof time !== 'number') return;
    const date = new Date(time);
    if (!Number.isFinite(date.getTime())) return;
    const t = date.toISOString();
    hr.set(t, { t, bpm });
  };
  for (const detail of details) {
    const data = detail.detail_data as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') continue;
    if (detail.detail_type === 'health_import') {
      const raw = data.raw_data as Record<string, unknown> | undefined;
      const samples = data.hr_samples ?? raw?.hr_samples;
      if (Array.isArray(samples))
        for (const sample of samples) add(sample?.t, sample?.bpm);
      const points = data.gps_points ?? raw?.gps_points;
      if (Array.isArray(points)) gps = points as WorkoutGpsPoint[];
    }
    if (detail.detail_type === RECORDING_DETAIL_TYPE) {
      // Sensor samples also exist for indoor recordings without GPS points.
      for (const rows of [data.points, data.sensors]) {
        if (Array.isArray(rows))
          for (const sample of rows) add(sample?.timestamp, sample?.heartRate);
      }
    }
  }
  return { gps, hr: [...hr.values()].sort((a, b) => a.t.localeCompare(b.t)) };
}
