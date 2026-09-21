import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RouteMap from '../RouteMap';
import Button from '../ui/Button';
import FormInput from '../FormInput';
import SensorPanel from './SensorPanel';
import { recordingClock, routeSegments } from './format';
import { usePreferences } from '../../hooks/usePreferences';
import { invalidateExerciseCache } from '../../hooks/invalidateExerciseCache';
import {
  discardRecording,
  getRecordingSnapshot,
  initializeRecorder,
  pauseRecording,
  resumeRecording,
  saveRecording,
  startRecording,
  subscribeRecording,
} from '../../services/recording/recorder';
import {
  getSensorSnapshot,
  subscribeSensors,
} from '../../services/recording/sensors';
import {
  elapsedSeconds,
  recordingCalories,
} from '../../services/recording/metrics';
import type {
  RecordingGoal,
  RecordingSport,
} from '../../services/recording/types';
import type { RootStackScreenProps } from '../../types/navigation';
import { formatLocalizedNumber } from '../../localization';
import { distanceFromKm, weightToKg } from '../../utils/unitConversions';
import { parseDecimalInput } from '../../utils/numericInput';

function KeepRecordingAwake() {
  useKeepAwake('run-ride');
  return null;
}

export default function RunRideRecorder({
  navigation,
  initialSport,
  initialGoal,
  initialWeightKg,
}: Pick<RootStackScreenProps<'RunOrRide'>, 'navigation'> & {
  /** Setup's choices. The in-screen controls still override them. */
  initialSport?: RecordingSport;
  initialGoal?: RecordingGoal;
  initialWeightKg?: number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const { preferences } = usePreferences();
  const unit = preferences?.default_distance_unit === 'miles' ? 'miles' : 'km';
  const weightUnit = preferences?.default_weight_unit === 'lbs' ? 'lbs' : 'kg';
  const snapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot
  );
  const sensors = useSyncExternalStore(subscribeSensors, getSensorSnapshot);
  const [sport, setSport] = useState<RecordingSport>(initialSport ?? 'run');
  const [weight, setWeight] = useState('');
  const [showSensors, setShowSensors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locked = useRef(false);
  const session = snapshot.session;
  useEffect(() => {
    void initializeRecorder({ sensors: true }).catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [focused]);
  const perform = async (operation: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  // Arriving from the setup screen there is nothing left to ask: sport, goal
  // and weight came with the route, so the session starts itself as soon as
  // permissions are ready. A bare entry — a resume, a deep link — still gets
  // the form below.
  const autoStarted = useRef(false);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  useEffect(() => {
    if (!initialWeightKg || session || autoStarted.current) return;
    if (!snapshot.ready || Platform.OS === 'web') return;
    autoStarted.current = true;
    void startRecording(
      initialSport ?? 'run',
      initialWeightKg,
      t,
      initialGoal
    ).catch(() => setAutoStartFailed(true));
  }, [initialWeightKg, initialSport, initialGoal, session, snapshot.ready, t]);
  // Derived, not stored: the route asked for a session and there is not one
  // yet, so the form it would have filled in has nothing left to ask.
  const autoStarting = !!initialWeightKg && !session && !autoStartFailed;

  const active = session?.phase === 'recording';
  const seconds = session ? elapsedSeconds(session, now) : 0;
  const speed =
    active && now - (session?.updatedAt ?? 0) < 5000
      ? (session?.speed ?? 0)
      : 0;
  const unitLabel =
    unit === 'miles'
      ? t('recording.miles', { defaultValue: 'mi' })
      : t('recording.km', { defaultValue: 'km' });
  const currentSport = session?.sport ?? sport;
  const bpm = now - sensors.heartRateAt < 10000 ? sensors.heartRate : null;
  const cadence = now - sensors.cadenceAt < 5000 ? sensors.cadence : null;
  const number = (value: number, digits = 1) =>
    formatLocalizedNumber(value, { maximumFractionDigits: digits });
  const metric = (label: string, value: string) => (
    <View key={label} className="w-1/2 py-1">
      <Text className="text-text-muted text-xs">{label}</Text>
      <Text className="text-text-primary text-xl font-semibold">{value}</Text>
    </View>
  );
  // Progress against the session's own goal. It is read off the session
  // rather than off the route, so it survives leaving the screen and coming
  // back — the recording outlives the navigation that started it.
  const goal = session?.goal;
  const goalDone =
    !goal || !session
      ? 0
      : goal.type === 'time'
        ? seconds
        : goal.type === 'distance'
          ? session.distance
          : recordingCalories(session, seconds);
  const goalPercent =
    goal && goal.target > 0
      ? Math.min(100, Math.round((goalDone / goal.target) * 100))
      : 0;
  const goalText = () => {
    if (!goal) return null;
    if (goal.type === 'time')
      return `${recordingClock(Math.min(goalDone, goal.target))} / ${recordingClock(goal.target)}`;
    if (goal.type === 'distance') {
      const target = distanceFromKm(goal.target / 1000, unit);
      return `${number(distanceFromKm(goalDone / 1000, unit), 2)} / ${number(target, 2)} ${unitLabel}`;
    }
    return `${number(goalDone, 0)} / ${number(goal.target, 0)} ${t('recording.kcal', { defaultValue: 'kcal' })}`;
  };
  const goalLabel = () => {
    if (!goal) return '';
    if (goal.type === 'time')
      return t('workoutSetup.time', { defaultValue: 'Time' });
    if (goal.type === 'distance')
      return t('workoutSetup.distance', { defaultValue: 'Distance' });
    return t('workoutSetup.calories', { defaultValue: 'Calories' });
  };

  const finish = () =>
    Alert.alert(
      t('recording.finishTitle', { defaultValue: 'Finish this session?' }),
      t('recording.finishMessage', {
        defaultValue:
          'Your route and sensor readings will be saved as an exercise.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('recording.finish', { defaultValue: 'Finish and save' }),
          onPress: () =>
            void perform(async () => {
              await pauseRecording(true);
              const entry = await saveRecording();
              invalidateExerciseCache(queryClient, entry.entry_date!);
              void queryClient.invalidateQueries({
                queryKey: ['exercisesLibrary'],
              });
              void queryClient.invalidateQueries({
                queryKey: ['exercises', 'count'],
              });
              navigation.replace('ActivityDetail', { session: entry });
            }),
        },
      ]
    );
  const discard = () =>
    Alert.alert(
      t('recording.discardTitle', { defaultValue: 'Discard this recording?' }),
      t('recording.discardMessage', {
        defaultValue: 'This route and its sensor readings will be deleted.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('recording.discard', { defaultValue: 'Discard' }),
          style: 'destructive',
          onPress: () => void perform(discardRecording),
        },
      ]
    );

  return (
    <View className="flex-1">
      {active && focused && <KeepRecordingAwake />}
      <View className="flex-1">
        <RouteMap
          center={snapshot.points[snapshot.points.length - 1]}
          segments={routeSegments(snapshot.points)}
          showsUserLocation={!!session && active}
        />
      </View>
      <ScrollView
        className="bg-background rounded-t-3xl"
        style={{ maxHeight: showSensors ? '70%' : '55%' }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {!session && autoStarting ? (
          <View className="items-center gap-3 py-8">
            <ActivityIndicator />
            <Text className="text-text-muted">
              {t('recording.starting', { defaultValue: 'Starting…' })}
            </Text>
          </View>
        ) : !session ? (
          <View className="gap-3">
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                variant={sport === 'run' ? 'primary' : 'secondary'}
                onPress={() => setSport('run')}
              >
                {t('recording.run', { defaultValue: 'Run' })}
              </Button>
              <Button
                className="flex-1"
                variant={sport === 'ride' ? 'primary' : 'secondary'}
                onPress={() => setSport('ride')}
              >
                {t('recording.ride', { defaultValue: 'Bike ride' })}
              </Button>
            </View>
            <Text className="text-text-muted">
              {t('recording.weight', {
                defaultValue: 'Body weight ({{unit}}), for estimated calories',
                unit: weightUnit,
              })}
            </Text>
            <FormInput
              accessibilityLabel={t('recording.weight', {
                defaultValue: 'Body weight ({{unit}}), for estimated calories',
                unit: weightUnit,
              })}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
            <Button
              loading={busy}
              disabled={
                !snapshot.ready || Platform.OS === 'web' || !weight.trim()
              }
              onPress={() =>
                void perform(() =>
                  startRecording(
                    sport,
                    weightToKg(parseDecimalInput(weight), weightUnit),
                    t
                  )
                )
              }
            >
              {t('recording.start', { defaultValue: 'Start recording' })}
            </Button>
          </View>
        ) : (
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-text-primary font-semibold">
                {currentSport === 'run'
                  ? t('recording.run', { defaultValue: 'Run' })
                  : t('recording.ride', { defaultValue: 'Bike ride' })}
              </Text>
              <Text className="text-text-muted">
                {active
                  ? t('recording.active', { defaultValue: 'Recording' })
                  : session.phase === 'paused'
                    ? t('recording.paused', {
                        defaultValue: 'Paused — resume or save',
                      })
                    : t('recording.unsaved', {
                        defaultValue: 'Finished — ready to save',
                      })}
              </Text>
            </View>
            {goal && (
              <View className="gap-1 mb-1">
                <View className="flex-row justify-between">
                  <Text className="text-text-secondary text-sm">
                    {t('recording.goal', {
                      defaultValue: '{{goal}} goal',
                      goal: goalLabel(),
                    })}
                  </Text>
                  <Text className="text-text-primary text-sm font-semibold">
                    {goalText()}
                  </Text>
                </View>
                <View className="h-2 rounded-full bg-progress-track overflow-hidden">
                  <View
                    className="h-2 bg-accent-primary rounded-full"
                    style={{ width: `${goalPercent}%` }}
                  />
                </View>
              </View>
            )}
            <View className="flex-row flex-wrap">
              {metric(
                t('recording.duration', { defaultValue: 'Duration' }),
                recordingClock(seconds)
              )}
              {metric(
                t('recording.distance', { defaultValue: 'Distance' }),
                `${number(distanceFromKm(session.distance / 1000, unit), 2)} ${unitLabel}`
              )}
              {metric(
                currentSport === 'run'
                  ? t('recording.pace', { defaultValue: 'Pace' })
                  : t('recording.speed', { defaultValue: 'Speed' }),
                currentSport === 'run'
                  ? speed > 0.5
                    ? `${recordingClock((unit === 'miles' ? 1609.344 : 1000) / speed)} / ${unitLabel}`
                    : '—'
                  : `${number(distanceFromKm(speed * 3.6, unit))} ${unitLabel}/h`
              )}
              {metric(
                t('recording.maxSpeed', { defaultValue: 'Max speed' }),
                `${number(distanceFromKm(session.maxSpeed * 3.6, unit))} ${unitLabel}/h`
              )}
              {metric(
                t('recording.elevation', { defaultValue: 'Elevation gain' }),
                `${number(unit === 'miles' ? session.elevationGain * 3.28084 : session.elevationGain, 0)} ${unit === 'miles' ? t('recording.feet', { defaultValue: 'ft' }) : t('recording.meters', { defaultValue: 'm' })}`
              )}
              {metric(
                t('recording.calories', { defaultValue: 'Estimated calories' }),
                `${number(recordingCalories(session, seconds), 0)} ${t('recording.kcal', { defaultValue: 'kcal' })}`
              )}
              {metric(
                t('recording.heartRate', { defaultValue: 'Heart rate' }),
                bpm === null
                  ? '—'
                  : `${number(bpm, 0)} ${t('recording.bpm', { defaultValue: 'bpm' })}`
              )}
              {currentSport === 'ride' &&
                metric(
                  t('recording.cadence', { defaultValue: 'Cadence' }),
                  cadence === null
                    ? '—'
                    : `${number(cadence, 0)} ${t('recording.rpm', { defaultValue: 'rpm' })}`
                )}
            </View>
            {active && !snapshot.points.length && (
              <Text className="text-text-muted">
                {t('recording.waitingGps', {
                  defaultValue:
                    'Waiting for an accurate GPS position. Move outdoors with a clear view of the sky.',
                })}
              </Text>
            )}
            <View className="flex-row gap-2">
              {session.phase !== 'finished' && (
                <Button
                  className="flex-1"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    void perform(() =>
                      active ? pauseRecording() : resumeRecording(t)
                    )
                  }
                >
                  {active
                    ? t('recording.pause', { defaultValue: 'Pause' })
                    : t('recording.resume', { defaultValue: 'Resume' })}
                </Button>
              )}
              <Button className="flex-1" loading={busy} onPress={finish}>
                {t('recording.finish', { defaultValue: 'Finish and save' })}
              </Button>
            </View>
            <Button variant="ghost" disabled={busy} onPress={discard}>
              {t('recording.discard', { defaultValue: 'Discard' })}
            </Button>
            <Text className="text-text-muted text-xs">
              {t('recording.backgroundHint', {
                defaultValue:
                  'Recording continues when you leave this screen. Return through Run or Ride.',
              })}
            </Text>
          </View>
        )}
        {(error || snapshot.error) && (
          <View className="py-2">
            <Text accessibilityRole="alert" className="text-text-primary">
              {t('recording.error', {
                defaultValue:
                  'Could not complete the action. Check precise/background location permissions, storage, and your connection. Your saved recording is kept for retry.',
              })}
            </Text>
            <Button variant="ghost" onPress={() => void Linking.openSettings()}>
              {t('recording.settings', {
                defaultValue: 'Open device settings',
              })}
            </Button>
          </View>
        )}
        <Button
          variant="ghost"
          onPress={() => setShowSensors((value) => !value)}
        >
          {t('recording.sensors', { defaultValue: 'Bluetooth sensors' })}
        </Button>
        {showSensors && <SensorPanel />}
      </ScrollView>
    </View>
  );
}
