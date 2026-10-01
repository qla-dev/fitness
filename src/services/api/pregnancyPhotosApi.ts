import { randomUUID } from 'expo-crypto';
import { apiFetch } from './apiClient';
import {
  copyProgressPhoto,
  localProgressPhotoFile,
  removeProgressPhoto,
} from '../local/progressPhotoFiles';
import type { BumpPhoto } from '../../types/womensHealth';

export const listPhotos = async (pregnancyId: string): Promise<BumpPhoto[]> => {
  return apiFetch<BumpPhoto[]>({
    endpoint: `/api/v2/pregnancy/photos?pregnancy_id=${encodeURIComponent(pregnancyId)}`,
    serviceName: 'Pregnancy Photos API',
    operation: 'list photos',
  });
};

export const deletePhoto = async (id: string): Promise<void> => {
  await apiFetch<void>({
    endpoint: `/api/v2/pregnancy/photos/${encodeURIComponent(id)}`,
    serviceName: 'Pregnancy Photos API',
    operation: 'delete photo',
    method: 'DELETE',
  });
  removeProgressPhoto(id);
};

/** Where a bump photo's image lives on the device. */
export const bumpPhotoUri = (photo: Pick<BumpPhoto, 'id'>) =>
  localProgressPhotoFile(photo.id).uri;

/**
 * Bump photos stay on the device, beside the progress photos: the picked
 * image is copied in under a new id, then its record is saved. A record that
 * fails to save takes its copy with it.
 */
export async function uploadPhoto(params: {
  pregnancyId: string;
  week: number;
  uri: string;
  notes?: string;
}): Promise<BumpPhoto> {
  const { pregnancyId, week, uri, notes } = params;
  const id = randomUUID();
  copyProgressPhoto(uri, id);
  try {
    return await apiFetch<BumpPhoto>({
      endpoint: '/api/v2/pregnancy/photos',
      serviceName: 'Pregnancy Photos API',
      operation: 'upload photo',
      method: 'POST',
      body: { id, pregnancy_id: pregnancyId, week, notes: notes ?? null },
    });
  } catch (error) {
    removeProgressPhoto(id);
    throw error;
  }
}
