import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ActivityDetailResponse } from '@workspace/shared';
import {
  RECORDING_DETAIL_TYPE,
  type RecordingPhoto,
} from '../../services/recording/types';
import {
  createPhotoPreview,
  recordingPhotoUri,
} from '../../services/recording/photos';

export default function WorkoutPhotos({
  details,
}: {
  details: ActivityDetailResponse[];
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RecordingPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [whiteWash, setWhiteWash] = useState(false);
  const [whiteText, setWhiteText] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareLock = useRef(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let temporary: string | undefined;
    void createPhotoPreview(selected, whiteWash, showRoute, whiteText)
      .then((uri) => {
        if (uri !== recordingPhotoUri(selected)) temporary = uri;
        if (cancelled) {
          if (temporary) {
            try {
              new File(temporary).delete();
            } catch {
              /* Cache cleanup. */
            }
          }
          return;
        }
        setPreview(uri);
      })
      .catch(() => {
        if (!cancelled)
          Alert.alert(
            t('recording.photoFailed', {
              defaultValue: 'Could not save the photo. Please try again.',
            })
          );
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
      if (temporary) {
        try {
          new File(temporary).delete();
        } catch {
          /* Cache cleanup. */
        }
      }
    };
  }, [selected, whiteWash, showRoute, whiteText, t]);
  const share = async () => {
    if (!preview || rendering || shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error('Sharing unavailable');
      await Sharing.shareAsync(preview, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: t('recording.sharePhoto', {
          defaultValue: 'Share workout photo',
        }),
      });
    } catch {
      Alert.alert(
        t('recording.sharePhotoFailed', {
          defaultValue: 'Could not share this photo. Please try again.',
        })
      );
    } finally {
      shareLock.current = false;
      setSharing(false);
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
            onPress={() => {
              setWhiteWash(false);
              setWhiteText(true);
              setShowRoute(false);
              setPreview(null);
              setRendering(true);
              setSelected(photo);
            }}
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
      <Modal
        visible={selected !== null}
        onRequestClose={() => {
          if (!shareLock.current) setSelected(null);
        }}
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'black',
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {selected && (
            <Image
              source={{ uri: preview ?? recordingPhotoUri(selected) }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}
          {selected?.composition && (
            <View style={{ paddingHorizontal: 24, gap: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white' }}>
                  {t('recording.photoWhiteText', {
                    defaultValue: 'White text',
                  })}
                </Text>
                <Switch
                  disabled={sharing}
                  accessibilityLabel={t('recording.photoWhiteText', {
                    defaultValue: 'White text',
                  })}
                  value={whiteText}
                  onValueChange={(value) => {
                    setRendering(true);
                    setPreview(null);
                    setWhiteText(value);
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white' }}>
                  {t('recording.photoWhiteOverlay', {
                    defaultValue: 'White overlay',
                  })}
                </Text>
                <Switch
                  disabled={sharing}
                  accessibilityLabel={t('recording.photoWhiteOverlay', {
                    defaultValue: 'White overlay',
                  })}
                  value={whiteWash}
                  onValueChange={(value) => {
                    setRendering(true);
                    setPreview(null);
                    setWhiteWash(value);
                  }}
                />
              </View>
              {selected.composition.route.length > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white' }}>
                    {t('recording.photoRoute', { defaultValue: 'Show route' })}
                  </Text>
                  <Switch
                    disabled={sharing}
                    accessibilityLabel={t('recording.photoRoute', {
                      defaultValue: 'Show route',
                    })}
                    value={showRoute}
                    onValueChange={(value) => {
                      setRendering(true);
                      setPreview(null);
                      setShowRoute(value);
                    }}
                  />
                </View>
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!preview || rendering || sharing}
            onPress={() => void share()}
            style={{
              margin: 16,
              padding: 16,
              borderRadius: 28,
              backgroundColor: '#C13584',
              opacity: !preview || rendering || sharing ? 0.5 : 1,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              {t('recording.shareInstagram', {
                defaultValue: 'Share to Instagram',
              })}
            </Text>
          </Pressable>
          <Text
            style={{
              color: '#aaa',
              textAlign: 'center',
              paddingHorizontal: 24,
            }}
          >
            {t('recording.shareInstagramHint', {
              defaultValue:
                'Choose Instagram in the share sheet, or save the image to post later.',
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={sharing}
            onPress={() => setSelected(null)}
            style={{ padding: 20, alignItems: 'center' }}
          >
            <Text style={{ color: 'white' }}>
              {t('common.close', { defaultValue: 'Close' })}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
