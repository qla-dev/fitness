import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CommonActions } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Icon from '../components/Icon';
import PromptScreen from '../components/ui/PromptScreen';
import {
  getSensorSnapshot,
  subscribeSensors,
  startWatchHeartRate,
  stopWatchHeartRate,
} from '../services/recording/sensors';
import type { RootStackScreenProps } from '../types/navigation';

/** The same native modal and header as MeasurementEdit, while the watch wakes. */
export default function WatchWorkoutStartScreen({
  navigation,
  route,
}: RootStackScreenProps<'WatchWorkoutStart'>) {
  const { t } = useTranslation();
  const sensors = useSyncExternalStore(subscribeSensors, getSensorSnapshot);
  const name =
    sensors.watchName ??
    t('recording.appleWatch', { defaultValue: 'Apple Watch' });
  const [phase, setPhase] = useState<'connecting' | 'connected' | 'failed'>(
    'connecting'
  );
  const [attempt, setAttempt] = useState(0);
  const [accent, green] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
  ]) as string[];
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const params = route.params;
  const presented = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let handedOff = false;
    let ready = false;
    let transition: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(transition);
      if (!handedOff) void stopWatchHeartRate();
    };
    const removeListener = navigation.addListener('beforeRemove', cancel);
    const handoffWhenPresented = () => {
      if (cancelled || !ready || !presented.current || transition) return;
      transition = setTimeout(() => {
        if (cancelled) return;
        handedOff = true;
        navigation.dispatch((state) => {
          // Replace setup and its connection sheet together, keeping the
          // original destination underneath the recorder for its close button.
          const index = state.routes.findIndex(
            (entry) => entry.key === route.key
          );
          const setupIndex =
            index > 0 && state.routes[index - 1].name === 'WorkoutSetup'
              ? index - 1
              : index;
          const routes = [
            ...state.routes.slice(0, setupIndex),
            { name: 'RunOrRide', params },
          ];
          return CommonActions.reset({
            ...state,
            routes,
            index: routes.length - 1,
          });
        });
      }, 400);
    };
    const removeTransitionListener = navigation.addListener(
      'transitionEnd',
      ({ data }) => {
        if (data.closing) return;
        presented.current = true;
        handoffWhenPresented();
      }
    );
    void startWatchHeartRate(params.sport, { sportId: params.sportId })
      .then(() => {
        if (cancelled) return;
        ready = true;
        setPhase('connected');
        handoffWhenPresented();
      })
      .catch(() => {
        if (!cancelled) setPhase('failed');
      });
    return () => {
      removeListener();
      removeTransitionListener();
      cancel();
    };
  }, [attempt, navigation, params, route.key]);

  useEffect(() => {
    pulse.value =
      phase === 'connecting' && !reducedMotion
        ? withRepeat(withTiming(1, { duration: 1400 }), -1, false)
        : 0;
    return () => cancelAnimation(pulse);
  }, [phase, reducedMotion, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.65 }],
  }));
  const signal = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.7,
    transform: [{ translateX: pulse.value * 44 - 22 }],
  }));
  const connected = phase === 'connected';
  const failed = phase === 'failed';
  const color = connected ? green : accent;

  return (
    <PromptScreen
      headerTitle={t('workoutSetup.watchConnection', {
        defaultValue: 'Watch connection',
      })}
      title={
        failed
          ? t('workoutSetup.watchStartFailedTitle', {
              defaultValue: 'Watch workout did not start',
            })
          : connected
            ? t('workoutSetup.watchConnectedName', {
                defaultValue: '{{watch}} is ready',
                watch: name,
              })
            : t('workoutSetup.connectingWatchName', {
                defaultValue: 'Connecting to {{watch}}',
                watch: name,
              })
      }
      description={
        failed
          ? t('workoutSetup.watchStartFailedMessage', {
              defaultValue:
                'Open qla.fit on your Apple Watch, then try again. Your phone workout has not started.',
            })
          : t('workoutSetup.watchConnectionHelp', {
              defaultValue:
                'Keep your watch nearby. Your workout will start when your watch is ready.',
            })
      }
      footerLabel={
        failed
          ? t('common.retry', { defaultValue: 'Retry' })
          : t('common.cancel', { defaultValue: 'Cancel' })
      }
      onFooterPress={() => {
        if (failed) {
          setPhase('connecting');
          setAttempt((value) => value + 1);
        } else navigation.goBack();
      }}
    >
      <View className="items-center gap-8">
        <View
          className="flex-row items-center justify-center gap-6"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="device-phone" size={72} color={color} />
          <View style={{ width: 48, alignItems: 'center' }}>
            {connected || failed ? (
              <Icon
                name={connected ? 'checkmark-circle' : 'alert-circle'}
                size={28}
                color={color}
              />
            ) : (
              <Animated.View
                style={[
                  {
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                  },
                  signal,
                ]}
              />
            )}
          </View>
          <View
            style={{
              width: 88,
              height: 112,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 2,
                  borderColor: color,
                },
                halo,
              ]}
            />
            <Icon name="device-watch" size={80} color={color} />
          </View>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          className="text-text-secondary text-center text-lg"
        >
          {name}
        </Text>
      </View>
    </PromptScreen>
  );
}
