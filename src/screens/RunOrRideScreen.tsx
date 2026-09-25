import { useState, useSyncExternalStore } from 'react';
import {
  getRecordingSnapshot,
  subscribeRecording,
} from '../services/recording/recorder';
import { StatusBar, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import RunRideRecorder from '../components/recording/RunRideRecorder';
import RecordingCountdown from '../components/recording/RecordingCountdown';
import { WORKOUT_SPORTS } from '../constants/workoutSports';
import type { RootStackScreenProps } from '../types/navigation';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';

export default function RunOrRideScreen({
  navigation,
  route,
}: RootStackScreenProps<'RunOrRide'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const focused = useIsFocused();
  const [cameraMode, setCameraMode] = useState(false);
  const recording = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot
  );

  // The screen is black whatever the theme, so the root's theme-driven bar
  // style leaves the clock invisible on the light theme. Mounted only while
  // focused: a StatusBar element wins over the root's for as long as it is
  // mounted, and this screen stays mounted under whatever is pushed over it.
  const statusBar = focused ? <StatusBar barStyle="light-content" /> : null;

  // Only an arrival from setup counts down: it is the one case where the
  // session starts by itself and the phone is still in your hand. A resume or
  // a deep link drops into a recording already under way.
  const [countdown, setCountdown] = useState(!!route.params?.weightKg);
  const sport = WORKOUT_SPORTS.find(
    (entry) => entry.id === route.params?.sportId
  );

  // Transparent and titleless: the map is the screen, and a bar with a name on
  // it would be chrome over something that is already saying what it is.
  const header = useScreenHeader({
    variant: 'transparent',
    nativeTitle: '',
    title: '',
    borderless: true,
    // Forced-dark content under it: see `appearance` on the hook.
    appearance: 'dark',
    right: [
      {
        kind: 'icon',
        separated: true,
        sfSymbol: cameraMode ? 'map' : 'camera',
        ionicon: cameraMode ? 'map-outline' : 'camera-outline',
        accessibilityLabel: cameraMode
          ? t('recording.showMap', { defaultValue: 'Show map' })
          : t('recording.showCamera', { defaultValue: 'Show camera' }),
        onPress: () => setCameraMode((value) => !value),
        disabled:
          countdown ||
          !recording.session ||
          recording.session.phase === 'finished',
      },
      {
        kind: 'dismiss',
        onPress: () => navigation.goBack(),
        disabled: countdown,
      },
    ],
    nativeOptions: {
      headerBackVisible: false,
      gestureEnabled: false,
      headerTransparent: true,
      headerBlurEffect: 'none',
      headerStyle: { backgroundColor: 'transparent' },
      headerShadowVisible: false,
      scrollEdgeEffects: { top: 'hidden' },
    },
  });

  // The count owns the whole screen, bar included — nothing to go back to
  // mid-count, and the readings behind it are not ready to be read yet.
  if (countdown)
    return (
      <>
        {statusBar}
        <RecordingCountdown
          color={accent}
          icon={
            sport?.icon ??
            (route.params?.sport === 'ride'
              ? 'exercise-cycling'
              : 'exercise-running-filled')
          }
          label={
            sport?.label(t) ??
            (route.params?.sport === 'ride'
              ? t('recording.ride', { defaultValue: 'Bike ride' })
              : t('recording.run', { defaultValue: 'Run' }))
          }
          onDone={() => setCountdown(false)}
        />
      </>
    );

  return (
    <View className="flex-1" style={{ backgroundColor: '#000' }}>
      {statusBar}
      {/* The map fills the screen and the header sits over it, so the route is
          never boxed into a panel. It is absolutely positioned rather than a
          flex child for that reason. */}
      <View className="flex-1">
        <RunRideRecorder
          cameraMode={cameraMode}
          navigation={navigation}
          initialSport={route.params?.sport}
          initialSportId={route.params?.sportId}
          initialGps={route.params?.gps}
          initialWatch={route.params?.watch}
          initialGoal={route.params?.goal}
          initialWeightKg={route.params?.weightKg}
        />
      </View>
      <View
        className="absolute left-0 right-0 top-0"
        style={{ paddingTop: usesNativeHeader ? 0 : insets.top }}
        pointerEvents="box-none"
      >
        {header}
      </View>
    </View>
  );
}
