import { z } from 'zod';
import { PHOTO_TYPES } from '@workspace/shared';
import {
  deleteRecord,
  saveRecord,
  table,
  type LocalDatabase,
} from './database';
import type { LocalRequest, LocalResult } from './request';
import { localMeasurements } from './healthRepository';

export function photoRepository(
  db: LocalDatabase,
  { path, method, body }: LocalRequest
): LocalResult | undefined {
  const base = '/api/measurements/check-in-photos';
  if (path === base || path.startsWith(`${base}/`)) {
    const suffix = decodeURIComponent(path.slice(base.length + 1));
    const rows = table(db, 'progressPhotos');
    if (method === 'GET') {
      const sorted = [...rows].sort((a, b) =>
        String(b.entry_date).localeCompare(String(a.entry_date))
      );
      if (suffix === 'dates')
        return { value: [...new Set(sorted.map((row) => row.entry_date))] };
      if (suffix)
        return { value: sorted.filter((row) => row.entry_date === suffix) };
      const dates = sorted.map((row) => String(row.entry_date));
      const weights = new Map(
        dates.length
          ? localMeasurements(db, {
              start: dates[dates.length - 1],
              end: dates[0],
            }).map((row) => [String(row.entry_date), row.weight ?? null])
          : []
      );
      return {
        value: sorted.map((row) => ({
          ...row,
          weight: weights.get(String(row.entry_date)) ?? null,
        })),
      };
    }
    if (method === 'POST') {
      const photo = z
        .object({
          id: z.string().uuid(),
          entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          photo_type: z.enum(PHOTO_TYPES),
        })
        .parse(body);
      const previous = rows.find(
        (row) =>
          row.entry_date === photo.entry_date &&
          row.photo_type === photo.photo_type
      );
      if (previous) deleteRecord(db, 'progressPhotos', previous.id);
      return {
        value: saveRecord(db, 'progressPhotos', {
          ...photo,
          check_in_measurement_id: null,
          file_path: `${photo.id}.jpg`,
        }),
      };
    }
    if (method === 'DELETE' && suffix.startsWith('photo/')) {
      deleteRecord(db, 'progressPhotos', suffix.slice(6));
      return { value: undefined };
    }
  }
  if (path.startsWith('/api/workout-photos/')) {
    const sessionId = decodeURIComponent(
      path.slice('/api/workout-photos/'.length)
    );
    if (method === 'GET')
      return {
        value: table(db, 'workoutPhotos')
          .filter((row) => row.sessionId === sessionId)
          .map((row) => row.photo),
      };
    if (method === 'POST') {
      saveRecord(db, 'workoutPhotos', { sessionId, photo: body });
      return { value: body };
    }
  }
}
