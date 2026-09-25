import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ActivityDetailResponse } from '@workspace/shared';
import {
  RECORDING_DETAIL_TYPE,
  type RecordingPhoto,
} from '../../services/recording/types';
import { recordingPhotoUri } from '../../services/recording/photos';
import WorkoutPhotoEditor from './WorkoutPhotoEditor';

export default function WorkoutPhotos({
  details,
}: {
  details: ActivityDetailResponse[];
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RecordingPhoto | null>(null);
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
  if (!photos.length) return null;
  return (
    <View className="py-4">
      <Text className="text-text-primary text-lg font-semibold mb-3">
        {t('recording.workoutPhotos', { defaultValue: 'Workout photos' })}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {photos.map((photo) => (
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
                width: 130,
                height: 180,
                borderRadius: 12,
                marginRight: 10,
              }}
            />
          </Pressable>
        ))}
      </ScrollView>
      {selected && (
        <WorkoutPhotoEditor
          photo={selected}
          onDiscard={() => setSelected(null)}
        />
      )}
    </View>
  );
}
