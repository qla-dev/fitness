import { useCallback, useRef } from 'react';
import { localProgressPhotoFile } from '../services/local/progressPhotoFiles';

export type CheckInPhotoSource = {
  uri: string;
  headers: Record<string, string>;
};

/** Memoizes on-device photo sources so scrolling does not reload images. */
export function useCheckInPhotoSource() {
  const cacheRef = useRef<Map<string, CheckInPhotoSource>>(new Map());
  const getPhotoSource = useCallback(
    (photoId: string): CheckInPhotoSource | null => {
      if (!photoId) return null;
      const cached = cacheRef.current.get(photoId);
      if (cached) return cached;
      const source = { uri: localProgressPhotoFile(photoId).uri, headers: {} };
      cacheRef.current.set(photoId, source);
      return source;
    },
    []
  );
  return { getPhotoSource, isReady: true };
}
