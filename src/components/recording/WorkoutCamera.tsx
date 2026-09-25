import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { attachRecordingPhoto } from '../../services/recording/recorder';
import {
  createRecordingPhoto,
  deleteRecordingPhoto,
} from '../../services/recording/photos';
import { fireSuccessHaptic } from '../../services/haptics';
import type { PhotoComposition } from '../../services/recording/types';

export default function WorkoutCamera({
  recordingId,
  lines,
  bottom,
  active,
  viewport,
  top,
  route,
}: {
  recordingId: string;
  lines: string[];
  bottom: number;
  active: boolean;
  viewport: { width: number; height: number };
  top: number;
  route: PhotoComposition['route'];
}) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const composition: PhotoComposition = {
    ...viewport,
    top,
    route,
    metrics: [
      { text: lines[1], x: 24, y: top, size: 48 },
      { text: lines[3], x: 24, y: top + 82, size: 40 },
      { text: lines[4], x: 24, y: top + 154, size: 34 },
      { text: lines[5], x: 24, y: top + 220, size: 34 },
      { text: lines[2], x: 24, y: top + 286, size: 28 },
    ],
  };
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active'
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      setReady(false);
    });
    return () => subscription.remove();
  }, []);
  const capture = async () => {
    if (locked.current || !ready || !active || !foreground) return;
    locked.current = true;
    setBusy(true);
    let temporary: string | undefined;
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.9 });
      if (!picture) throw new Error('Camera unavailable');
      temporary = picture.uri;
      const photo = await createRecordingPhoto(picture.uri, composition);
      try {
        await attachRecordingPhoto(recordingId, photo);
      } catch (error) {
        deleteRecordingPhoto(photo);
        throw error;
      }
      fireSuccessHaptic();
      Alert.alert(
        t('recording.photoSaved', {
          defaultValue: 'Photo saved to this workout',
        })
      );
    } catch {
      Alert.alert(
        t('recording.photoFailed', {
          defaultValue: 'Could not save the photo. Please try again.',
        })
      );
    } finally {
      if (temporary) {
        try {
          new File(temporary).delete();
        } catch {
          /* Cache cleanup only. */
        }
      }
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={StyleSheet.absoluteFill}>
      {permission?.granted && active && foreground ? (
        <CameraView
          key={facing}
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mirror={facing === 'front'}
          onCameraReady={() => setReady(true)}
        />
      ) : null}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {composition.metrics.map((metric, index) => (
          <Text
            key={index}
            style={{
              position: 'absolute',
              left: metric.x,
              top: metric.y,
              fontSize: metric.size,
              lineHeight: metric.size * 1.2,
              fontWeight: '400',
              color: 'white',
            }}
          >
            {metric.text}
          </Text>
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: bottom + 16,
          alignSelf: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {!permission?.granted ? (
          <Pressable
            onPress={() =>
              void (permission?.canAskAgain === false
                ? Linking.openSettings()
                : requestPermission())
            }
          >
            <Text
              style={{ color: 'white', backgroundColor: '#222', padding: 16 }}
            >
              {t('recording.allowCamera', {
                defaultValue: 'Allow camera access',
              })}
            </Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recording.switchCamera', {
                defaultValue: 'Switch camera',
              })}
              disabled={busy}
              onPress={() => {
                setReady(false);
                setFacing((value) => (value === 'front' ? 'back' : 'front'));
              }}
              style={{ padding: 12, backgroundColor: '#222', borderRadius: 30 }}
            >
              <Icon name="camera-reverse" size={28} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recording.capturePhoto', {
                defaultValue: 'Capture photo with metrics',
              })}
              disabled={busy || !ready || !active}
              onPress={() => void capture()}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                borderWidth: 5,
                borderColor: 'white',
                backgroundColor: busy ? '#666' : '#fff',
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}
