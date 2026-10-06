import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhotoEditorOptions } from './photoEditor';
import type { RecordingPhoto } from './types';

const key = (photo: Pick<RecordingPhoto, 'fileName'>) =>
  `workoutPhotoDraft:${photo.fileName}`;

/** A draft is only a convenience; unreadable storage opens the defaults. */
export async function loadPhotoDraft(
  photo: RecordingPhoto
): Promise<Partial<PhotoEditorOptions> | null> {
  try {
    const value = await AsyncStorage.getItem(key(photo));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function savePhotoDraft(
  photo: RecordingPhoto,
  options: PhotoEditorOptions
) {
  await AsyncStorage.setItem(key(photo), JSON.stringify(options));
}

export function removePhotoDraft(photo: Pick<RecordingPhoto, 'fileName'>) {
  AsyncStorage.multiRemove([key(photo), locationKey(photo)]).catch(() => {
    /* A stale draft or location for a deleted photo is harmless. */
  });
}

type PhotoLocation = NonNullable<
  NonNullable<RecordingPhoto['composition']>['captureLocation']
>;
const locationKey = (photo: Pick<RecordingPhoto, 'fileName'>) =>
  `workoutPhotoLocation:${photo.fileName}`;

/**
 * Where a photo was taken, added by hand when it carries no GPS fix — one
 * added after the workout, or from a session started on the watch. Kept per
 * photo beside its draft, since a photo can live in a recording's details as
 * well as in the added-photo list.
 */
export async function loadPhotoLocation(
  photo: Pick<RecordingPhoto, 'fileName'>
): Promise<PhotoLocation | null> {
  try {
    const value = await AsyncStorage.getItem(locationKey(photo));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function savePhotoLocation(
  photo: Pick<RecordingPhoto, 'fileName'>,
  location: PhotoLocation
) {
  await AsyncStorage.setItem(locationKey(photo), JSON.stringify(location));
}
