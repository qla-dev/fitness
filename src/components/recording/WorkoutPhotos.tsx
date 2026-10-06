import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ActivityDetailResponse } from '@workspace/shared';
import {
  RECORDING_DETAIL_TYPE,
  type RecordingPhoto,
  type PhotoComposition,
} from '../../services/recording/types';
import {
  createRecordingPhoto,
  deleteRecordingPhoto,
  recordingPhotoUri,
} from '../../services/recording/photos';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MenuView } from '@expo/ui/community/menu';
import { useCSSVariable } from 'uniwind';
import Icon from '../Icon';
import { localApiFetch } from '../../services/local/localApi';
import {
  pickImageFromCamera,
  pickImagesFromLibrary,
} from '../../utils/pickImage';
import WorkoutPhotoEditor from './WorkoutPhotoEditor';
import { fetchProfile } from '../../services/api/profileApi';
import { profileQueryKey } from '../../hooks/queryKeys';

/**
 * Every photo of a workout is edited with the workout's final readings, laid
 * out one way. A photo taken mid-session stored the live HUD at that moment
 * (its viewport and a partial set of readings) and one added afterwards
 * stored whatever this screen passed then; reopening either with the current
 * composition makes them the same design. Only where it was taken is kept.
 */
function withCurrentReadings(
  photo: RecordingPhoto,
  current: PhotoComposition
): RecordingPhoto {
  if (!photo.composition) return photo;
  return {
    ...photo,
    composition: {
      ...current,
      // Never trade a route the photo has for an empty one.
      route: current.route.length ? current.route : photo.composition.route,
      captureLocation: photo.composition.captureLocation,
    },
  };
}

export default function WorkoutPhotos({
  details,
  sessionId,
  composition,
  workoutName,
}: {
  details: ActivityDetailResponse[];
  sessionId: string;
  composition: PhotoComposition;
  workoutName?: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RecordingPhoto | null>(null);
  // The composition is rebuilt on every parent render; key on its content so
  // the editor only sees a new photo when the readings actually change.
  const readingsKey = JSON.stringify(composition);
  const editing = useMemo(
    () => selected && withCurrentReadings(selected, JSON.parse(readingsKey)),
    [selected, readingsKey]
  );
  const [containerWidth, setContainerWidth] = useState(320);
  const tileWidth = Math.max(64, (containerWidth - 32) / 3);
  const client = useQueryClient();
  const key = ['workoutPhotos', sessionId];
  const endpoint = '/api/workout-photos/' + encodeURIComponent(sessionId);
  const {
    data: added = [],
    isError,
    refetch,
  } = useQuery({
    queryKey: key,
    queryFn: () => localApiFetch<RecordingPhoto[]>({ endpoint }),
  });
  const { data: profile } = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
  });
  const busy = useRef(false);
  const [adding, setAdding] = useState(false);
  const accent = useCSSVariable('--color-accent-primary') as string;
  const add = async (source: string) => {
    if (busy.current) return;
    busy.current = true;
    setAdding(true);
    let created: RecordingPhoto | undefined;
    try {
      let uri: string | undefined;
      if (source === 'camera') {
        const result = await pickImageFromCamera();
        if (result.status === 'denied') {
          Alert.alert(
            t('progressPhotos.cameraPermission', {
              defaultValue: 'Camera permission is required',
            })
          );
          return;
        }
        if (result.status === 'ok') uri = result.image.uri;
      } else uri = (await pickImagesFromLibrary(1))[0]?.uri;
      if (!uri) return;
      created = await createRecordingPhoto(uri, composition);
      await localApiFetch({ endpoint, method: 'POST', body: created });
      const saved = created;
      created = undefined;
      client.setQueryData<RecordingPhoto[]>(key, (previous = []) => [
        ...previous,
        saved,
      ]);
      setSelected(saved);
    } catch {
      if (created) deleteRecordingPhoto(created);
      Alert.alert(
        t('progressPhotos.uploadError', {
          defaultValue: 'Could not save that photo',
        })
      );
    } finally {
      busy.current = false;
      setAdding(false);
    }
  };
  const data = details.find(
    (detail) => detail.detail_type === RECORDING_DETAIL_TYPE
  )?.detail_data;
  const photos =
    data &&
    typeof data === 'object' &&
    'photos' in data &&
    Array.isArray(data.photos)
      ? data.photos.filter(
          (photo): photo is RecordingPhoto =>
            typeof photo?.fileName === 'string' &&
            /^[a-f0-9-]+\.jpg$/i.test(photo.fileName)
        )
      : [];
  const allPhotos = [...photos, ...added];
  return (
    <View className="py-4">
      <Text className="text-text-primary text-lg font-semibold mb-3">
        {t('recording.workoutPhotos', { defaultValue: 'Workout photos' })}
      </Text>
      <View
        className="bg-surface rounded-2xl overflow-hidden p-2 flex-row flex-wrap gap-2"
        onLayout={({ nativeEvent }) =>
          setContainerWidth(nativeEvent.layout.width)
        }
      >
        {allPhotos.map((photo) => (
          <Pressable
            key={photo.fileName}
            accessibilityRole="button"
            accessibilityLabel={t('recording.openPhoto', {
              defaultValue: 'Open workout photo',
            })}
            onPress={() => setSelected(photo)}
          >
            <Image
              source={{ uri: recordingPhotoUri(photo) }}
              style={{
                width: tileWidth,
                height: 110,
                borderRadius: 12,
              }}
            />
          </Pressable>
        ))}
        <MenuView
          actions={[
            {
              id: 'camera',
              title: t('progressPhotos.takePhoto', {
                defaultValue: 'Take Photo',
              }),
              image: 'camera',
              attributes: { disabled: adding },
            },
            {
              id: 'library',
              title: t('progressPhotos.chooseLibrary', {
                defaultValue: 'Choose from Library',
              }),
              image: 'photo',
              attributes: { disabled: adding },
            },
          ]}
          onPressAction={({ nativeEvent }) => void add(nativeEvent.event)}
        >
          <View
            accessibilityRole="button"
            accessibilityLabel={t('recording.addPhoto', {
              defaultValue: 'Add photo',
            })}
            style={{
              width: allPhotos.length ? tileWidth : containerWidth - 16,
              height: 110,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {adding ? (
              <ActivityIndicator color={accent} />
            ) : (
              <Icon name="add" size={28} color={accent} />
            )}
            <Text className="text-accent-primary">
              {t('recording.addPhoto', { defaultValue: 'Add photo' })}
            </Text>
          </View>
        </MenuView>
      </View>
      {isError && (
        <Pressable onPress={() => void refetch()}>
          <Text className="text-text-secondary">
            {t('recording.photosLoadFailed', {
              defaultValue: 'Could not load photos. Tap to retry.',
            })}
          </Text>
        </Pressable>
      )}
      {editing && (
        <WorkoutPhotoEditor
          photo={editing}
          onClose={() => setSelected(null)}
          workoutName={workoutName}
          userName={profile?.full_name ?? undefined}
        />
      )}
    </View>
  );
}
