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
  AsyncStorage.removeItem(key(photo)).catch(() => {
    /* A stale draft for a deleted photo is harmless. */
  });
}
