import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AccessibilityInfo,
  Animated,
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
  recordingPhotoUri,
} from '../../services/recording/photos';
import { fireRefreshHaptic } from '../../services/haptics';
import { playCameraShutterSound } from '../../services/sounds';
import type { PhotoComposition } from '../../services/recording/types';
import { capturePhotoLocation } from '../../services/recording/photoLocation';

export default function WorkoutCamera({
  recordingId,
  metrics,
  bottom,
  active,
  viewport,
  top,
  route,
}: {
  recordingId: string;
  metrics: PhotoComposition['metrics'];
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
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [flash] = useState(() => new Animated.Value(0));
  const [savedAnimation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      subscription.remove();
      flash.stopAnimation();
      savedAnimation.stopAnimation();
    };
  }, [flash, savedAnimation]);
  const composition: PhotoComposition = {
    ...viewport,
    top,
    route,
    metrics,
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
    if (locked.current || savedUri || !ready || !active || !foreground) return;
    locked.current = true;
    setBusy(true);
    fireRefreshHaptic();
    playCameraShutterSound();
    flash.setValue(reduceMotion ? 0 : 0.65);
    Animated.timing(flash, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    let temporary: string | undefined;
    try {
      const [picture, captureLocation] = await Promise.all([
        camera.current?.takePictureAsync({
          quality: 0.9,
          shutterSound: false,
        }),
        capturePhotoLocation(),
      ]);
      if (!picture) throw new Error('Camera unavailable');
      temporary = picture.uri;
      const photo = await createRecordingPhoto(picture.uri, {
        ...composition,
        captureLocation,
      });
      try {
        await attachRecordingPhoto(recordingId, photo);
      } catch (error) {
        deleteRecordingPhoto(photo);
        throw error;
      }
      savedAnimation.setValue(0);
      setSavedUri(recordingPhotoUri(photo));
      AccessibilityInfo.announceForAccessibility(
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
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
      {!ready && (
        <View
          testID="camera-restarting-cover"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}
        />
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#fff', opacity: flash },
        ]}
      />
      {savedUri && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.Image
            source={{ uri: savedUri }}
            onLoad={() => {
              Animated.timing(savedAnimation, {
                toValue: 1,
                duration: reduceMotion ? 250 : 650,
                useNativeDriver: true,
              }).start(({ finished }) => {
                if (finished) setSavedUri(null);
              });
            }}
            style={[
              StyleSheet.absoluteFill,
              {
                width: '100%',
                height: '100%',
                borderWidth: 3,
                borderColor: '#fff',
                opacity: savedAnimation.interpolate({
                  inputRange: [0, 0.55, 1],
                  outputRange: [1, 1, 0],
                }),
                transform: reduceMotion
                  ? []
                  : [
                      {
                        translateX: savedAnimation.interpolate({
                          inputRange: [0, 0.4, 1],
                          outputRange: [0, 0, viewport.width * 0.4],
                        }),
                      },
                      {
                        translateY: savedAnimation.interpolate({
                          inputRange: [0, 0.4, 1],
                          outputRange: [0, 0, viewport.height * 0.35],
                        }),
                      },
                      {
                        scale: savedAnimation.interpolate({
                          inputRange: [0, 0.4, 1],
                          outputRange: [1, 0.3, 0.12],
                        }),
                      },
                    ],
              },
            ]}
          />
        </View>
      )}
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
          <View
            style={{
              width: viewport.width,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recording.switchCamera', {
                defaultValue: 'Switch camera',
              })}
              disabled={busy || !ready}
              onPress={() => {
                setReady(false);
                setFacing((value) => (value === 'front' ? 'back' : 'front'));
              }}
              style={{
                position: 'absolute',
                right: viewport.width / 2 + 68,
                padding: 12,
                backgroundColor: '#222',
                borderRadius: 30,
              }}
            >
              <Icon name="camera-reverse" size={28} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recording.capturePhoto', {
                defaultValue: 'Capture photo with metrics',
              })}
              disabled={busy || !!savedUri || !ready || !active}
              onPress={() => void capture()}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                borderWidth: 5,
                borderColor: 'white',
                backgroundColor: busy ? '#666' : '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="camera" size={28} color="#222" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
