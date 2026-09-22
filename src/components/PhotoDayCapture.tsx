import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

import i18n from '../localization/i18n';
import PhotoDaySlots, { type PhotoPickSource } from './PhotoDaySlots';
import ProgressPhotoViewer from './ProgressPhotoViewer';
import { useCheckInPhotoMutations } from '../hooks/useCheckInPhotos';
import { useCheckInPhotoSource } from '../hooks/useCheckInPhotoSource';
import { usePreferences } from '../hooks/usePreferences';
import { getApiErrorMessage } from '../services/api/errors';
import { pickImageFromCamera, pickImagesFromLibrary } from '../utils/pickImage';
import { formatDateLabel } from '../utils/dateUtils';
import {
  formatWeightDisplay,
  type WeightDisplayMode,
} from '../utils/unitConversions';
import type { CheckInPhoto, PhotoType } from '../types/checkInPhotos';

function confirmRemovePhoto(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('progressPhotos.removeTitle', { defaultValue: 'Remove photo?' }),
      i18n.t('progressPhotos.removeMessage', {
        defaultValue: 'This deletes the photo from this day.',
      }),
      [
        {
          text: i18n.t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: i18n.t('progressPhotos.remove', {
            defaultValue: 'Remove Photo',
          }),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]
    );
  });
}

interface PhotoDayCaptureProps {
  /** The day a pick records into. */
  date: string;
  /**
   * That day's photos by angle. Taken as a prop rather than fetched here
   * because every caller already holds them for something else — the diary
   * needs them for its empty-day predicate — and a second copy of the query
   * would only be another thing to keep in step.
   */
  photos: Map<PhotoType, CheckInPhoto>;
  /** The day's weight, shown as the caption when a photo opens full screen. */
  weight?: number | null;
}

/**
 * One day's three angles, wired to actually record them: a tap on an empty
 * slot offers camera or library, a tap on a photo opens it full screen, and
 * the corner button replaces or removes it.
 *
 * Extracted from ProgressPhotosScreen so the capture lives where the day
 * lives. It used to exist only on that screen, which meant the identical block
 * of slots on the diary could do nothing but push to a second copy of itself —
 * two taps and a screen transition to reach the picker that was already under
 * the user's thumb. The screen is the history now; this is the recording.
 *
 * Writes land immediately rather than staging behind a Save. This sits inside
 * a day someone is browsing, and unsaved state plus a back-guard does not
 * belong there; one pick is one request, so uploads stay serial anyway.
 */
const PhotoDayCapture: React.FC<PhotoDayCaptureProps> = ({
  date,
  photos,
  weight = null,
}) => {
  const { t } = useTranslation();
  const dateLocale = i18n.language;
  const { getPhotoSource } = useCheckInPhotoSource();
  const { preferences } = usePreferences();
  const weightMode: WeightDisplayMode =
    preferences?.default_weight_unit ?? 'kg';
  const { uploadAsync, uploadingType, deleteAsync } =
    useCheckInPhotoMutations();

  /** The photo on show full screen. */
  const [zoomed, setZoomed] = useState<CheckInPhoto | null>(null);
  // The picker is a native modal; without this a double tap opens two.
  const pickerLock = useRef(false);

  const uploadFrom = useCallback(
    async (type: PhotoType, source: PhotoPickSource) => {
      if (pickerLock.current) return;
      pickerLock.current = true;
      try {
        let uri: string | undefined;
        if (source === 'camera') {
          const result = await pickImageFromCamera();
          if (result.status === 'denied') {
            Toast.show({
              type: 'error',
              text1: t('progressPhotos.cameraPermission', {
                defaultValue: 'Camera permission is required',
              }),
              text2: t('progressPhotos.cameraPermissionHint', {
                defaultValue: 'Enable camera access for qla.fit in Settings.',
              }),
            });
            return;
          }
          if (result.status === 'cancelled') return;
          uri = result.image.uri;
        } else {
          uri = (await pickImagesFromLibrary(1))[0]?.uri;
        }
        if (!uri) return;
        // The server upserts on (user_id, entry_date, photo_type), so an
        // upload over an existing angle replaces it with no delete first.
        await uploadAsync({ date, type, uri });
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: t('progressPhotos.uploadError', {
            defaultValue: 'Could not save that photo',
          }),
          text2: getApiErrorMessage(err) ?? undefined,
        });
      } finally {
        pickerLock.current = false;
      }
    },
    [t, uploadAsync, date]
  );

  const removePhoto = useCallback(
    async (type: PhotoType) => {
      const photo = photos.get(type);
      if (!photo) return;
      if (!(await confirmRemovePhoto())) return;
      try {
        await deleteAsync(photo.id);
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: t('progressPhotos.deleteError', {
            defaultValue: 'Could not remove that photo',
          }),
          text2: getApiErrorMessage(err) ?? undefined,
        });
      }
    },
    [photos, deleteAsync, t]
  );

  return (
    <>
      <PhotoDaySlots
        photos={photos}
        uploadingType={uploadingType}
        onPick={(type, source) => void uploadFrom(type, source)}
        onView={setZoomed}
        onRemove={(type) => void removePhoto(type)}
      />

      <ProgressPhotoViewer
        visible={zoomed != null}
        source={zoomed ? getPhotoSource(zoomed.id) : null}
        title={formatDateLabel(date, t, dateLocale)}
        subtitle={
          weight != null ? formatWeightDisplay(weight, weightMode) : undefined
        }
        onClose={() => setZoomed(null)}
      />
    </>
  );
};

export default PhotoDayCapture;
