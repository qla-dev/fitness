import { randomUUID } from 'expo-crypto';
import {
  copyProgressPhoto,
  removeProgressPhoto,
} from '../local/progressPhotoFiles';
import { apiFetch } from './apiClient';
import type {
  CheckInPhoto,
  CheckInPhotoWithWeight,
  PhotoType,
} from '../../types/checkInPhotos';

const SERVICE = 'Check-In Photos API';

/**
 * Every progress photo with the weight logged that day, newest first. One
 * request backs the gallery, the comparison and the time-lapse player.
 */
export const fetchPhotoGallery = async (): Promise<
  CheckInPhotoWithWeight[]
> => {
  return apiFetch<CheckInPhotoWithWeight[]>({
    endpoint: '/api/measurements/check-in-photos',
    serviceName: SERVICE,
    operation: 'fetch photo gallery',
  });
};

/**
 * The calendar days that have at least one photo, newest first. Marks those
 * days in the date pickers without pulling the whole gallery.
 */
export const fetchPhotoDates = async (): Promise<string[]> => {
  return apiFetch<string[]>({
    endpoint: '/api/measurements/check-in-photos/dates',
    serviceName: SERVICE,
    operation: 'fetch photo dates',
  });
};

/** The photos taken on one calendar day. */
export const fetchPhotosByDate = async (
  date: string
): Promise<CheckInPhoto[]> => {
  return apiFetch<CheckInPhoto[]>({
    endpoint: `/api/measurements/check-in-photos/${encodeURIComponent(date)}`,
    serviceName: SERVICE,
    operation: 'fetch photos by date',
  });
};

/** Removes one photo. Replacing an angle does not need this: the repository upserts. */
export const deletePhoto = async (id: string): Promise<void> => {
  await apiFetch<void>({
    endpoint: `/api/measurements/check-in-photos/photo/${encodeURIComponent(id)}`,
    serviceName: SERVICE,
    operation: 'delete photo',
    method: 'DELETE',
  });
  removeProgressPhoto(id);
};

/**
 * Uploads one angle for one day, replacing whatever was there before (the
 * repository upserts on date + type).
 */
export async function uploadPhoto(params: {
  date: string;
  type: PhotoType;
  uri: string;
}): Promise<CheckInPhoto> {
  const { date, type, uri } = params;
  const previous = (await fetchPhotosByDate(date)).find(
    (photo) => photo.photo_type === type
  );
  const id = randomUUID();
  copyProgressPhoto(uri, id);
  try {
    const photo = await apiFetch<CheckInPhoto>({
      endpoint: '/api/measurements/check-in-photos',
      method: 'POST',
      body: { id, entry_date: date, photo_type: type },
      serviceName: SERVICE,
      operation: 'save local photo',
    });
    if (previous) removeProgressPhoto(previous.id);
    return photo;
  } catch (error) {
    removeProgressPhoto(id);
    throw error;
  }
}
