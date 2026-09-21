import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RouteMap from '../RouteMap';
import Icon from '../Icon';
import { useCSSVariable } from 'uniwind';
import { withAlpha } from '../../utils/colors';
import { fireSelectionHaptic } from '../../services/haptics';
import Button from '../ui/Button';
import FormInput from '../FormInput';
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
  initialSportId,
  initialGps,
  initialWatch,
  initialGoal,
  initialWeightKg,
}: Pick<RootStackScreenProps<'RunOrRide'>, 'navigation'> & {
  /** Setup's choices. The in-screen controls still override them. */
  initialSport?: RecordingSport;
  /** Names the session; the sport above only decides how it records. */
  initialSportId?: string;
  /** False records the session without tracing a route. */
  initialGps?: boolean;
  /** False keeps a paired watch out of the session. */
  initialWatch?: boolean;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locked = useRef(false);
  // Set once the session is over, so the leave guard steps aside and lets the
  // navigation it was holding back through.
  const leaving = useRef(false);
  const session = snapshot.session;
  const accent = useCSSVariable('--color-accent-primary') as string;
  // A session recorded without a route has no map to show, so the screen is
  // the readings on black rather than a dimmed blank tile.
  const tracksRoute = session ? session.gps !== false : initialGps !== false;
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
      initialGoal,
      initialSportId,
      initialGps,
      initialWatch
    ).catch(() => setAutoStartFailed(true));
  }, [
    initialWeightKg,
    initialSport,
    initialSportId,
    initialGps,
    initialWatch,
    initialGoal,
    session,
    snapshot.ready,
    t,
  ]);
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
  const number = (value: number, digits = 1) =>
    formatLocalizedNumber(value, { maximumFractionDigits: digits });
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
              leaving.current = true;
              navigation.replace('ActivityDetail', { session: entry });
            }),
        },
      ]
    );
  // Leaving is ending. Backing out used to close the screen and leave the
  // session running — the recording outlives its screen, so you would be back
  // on the tabs with the route still being traced and no sign of it. The
  // listener catches the back button, the swipe and the hardware back alike.
  useEffect(() => {
    if (!session) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (leaving.current) return;
      event.preventDefault();
      Alert.alert(
        t('recording.leaveTitle', { defaultValue: 'End this workout?' }),
        t('recording.leaveMessage', {
          defaultValue:
            'Recording stops when you leave. Save it as an exercise, or throw it away.',
        }),
        [
          {
            text: t('recording.keepRecording', {
              defaultValue: 'Keep recording',
            }),
            style: 'cancel',
          },
          {
            text: t('recording.discard', { defaultValue: 'Discard' }),
            style: 'destructive',
            onPress: () =>
              void perform(async () => {
                await discardRecording();
                leaving.current = true;
                navigation.dispatch(event.data.action);
              }),
          },
          {
            text: t('recording.finish', { defaultValue: 'Finish and save' }),
            onPress: () => finish(),
          },
        ]
      );
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, session, t]);

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
    // Forced dark for the whole recording: a full-screen takeover read at
    // arm's length, usually outdoors, where a light sheet under sun is the
    // wrong instinct. It also lets the map sit behind everything without the
    // panel over it changing colour with the user's theme.
    <View className="flex-1" style={{ backgroundColor: '#000' }}>
      {active && focused && <KeepRecordingAwake />}
      {tracksRoute ? (
        <>
          {/* The map is the background rather than a pane at the top: it fills
              the screen and the readings sit over it, dimmed enough to stay
              legible against a bright map. */}
          <View style={StyleSheet.absoluteFill}>
            <RouteMap
              center={snapshot.points[snapshot.points.length - 1]}
              segments={routeSegments(snapshot.points)}
              showsUserLocation={!!session && active}
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.55)' },
            ]}
          />
        </>
      ) : null}
      <View className="flex-1 justify-center px-6" pointerEvents="none">
        {session ? (
          <>
            <View className="flex-row items-baseline">
              <Text
                style={{ color: '#FFF', fontSize: 84, fontWeight: '300' }}
                numberOfLines={1}
              >
                {number(distanceFromKm(session.distance / 1000, unit), 2)}
              </Text>
              <Text
                style={{ color: '#FFF', fontSize: 28, fontWeight: '600' }}
                className="ml-2"
              >
                {unitLabel}
              </Text>
            </View>

            <View className="flex-row items-baseline mt-6">
              <Text style={{ color: '#FFF', fontSize: 40, fontWeight: '400' }}>
                {currentSport === 'run'
                  ? speed > 0.5
                    ? recordingClock(
                        (unit === 'miles' ? 1609.344 : 1000) / speed
                      )
                    : '—'
                  : number(distanceFromKm(speed * 3.6, unit))}
              </Text>
              <Text
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}
                className="ml-2 uppercase"
              >
                {currentSport === 'run'
                  ? t('recording.pace', { defaultValue: 'Pace' })
                  : t('recording.speed', { defaultValue: 'Speed' })}
              </Text>
            </View>

            <View className="flex-row mt-8">
              <View className="flex-1">
                <Text
                  style={{ color: '#FFF', fontSize: 34, fontWeight: '400' }}
                >
                  {number(recordingCalories(session, seconds), 0)}
                </Text>
                <Text
                  style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  className="uppercase"
                >
                  {t('recording.kcal', { defaultValue: 'kcal' })}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  style={{ color: '#FFF', fontSize: 34, fontWeight: '400' }}
                >
                  {bpm === null ? '—' : number(bpm, 0)}
                </Text>
                <Text
                  style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  className="uppercase"
                >
                  {t('recording.bpm', { defaultValue: 'bpm' })}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="rounded-t-3xl"
        // Dark whatever the app theme is, and translucent so the route keeps
        // showing through underneath.
        style={{ backgroundColor: 'rgba(12,12,12,0.92)', flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="self-center rounded-full mb-3"
          style={{
            width: 40,
            height: 5,
            backgroundColor: 'rgba(255,255,255,0.25)',
          }}
        />
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
                    t,
                    undefined,
                    initialSportId,
                    initialGps,
                    initialWatch
                  )
                )
              }
            >
              {t('recording.start', { defaultValue: 'Start recording' })}
            </Button>
          </View>
        ) : (
          <View className="gap-2">
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
            <View className="flex-row items-center justify-between mb-4">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: withAlpha(accent, 0.18),
                }}
              >
                <Icon
                  name={
                    currentSport === 'ride'
                      ? 'exercise-cycling'
                      : 'exercise-running-filled'
                  }
                  size={22}
                  color={accent}
                />
              </View>
              <Text
                style={{
                  color: active ? accent : 'rgba(255,255,255,0.5)',
                  fontSize: 44,
                  fontWeight: '500',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {recordingClock(seconds)}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <View className="flex-row items-center justify-center gap-6 mb-2">
              {session.phase !== 'finished' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    active
                      ? t('recording.pause', { defaultValue: 'Pause' })
                      : t('recording.resume', { defaultValue: 'Resume' })
                  }
                  disabled={busy}
                  onPress={() => {
                    fireSelectionHaptic();
                    void perform(() =>
                      active ? pauseRecording() : resumeRecording(t)
                    );
                  }}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 84,
                    height: 84,
                    backgroundColor: active
                      ? 'rgba(255,255,255,0.12)'
                      : withAlpha(accent, 0.22),
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Icon
                    name={active ? 'pause' : 'play'}
                    size={34}
                    color={active ? '#FFF' : accent}
                  />
                </Pressable>
              )}
            </View>

            {/* Ending appears once you have stopped: mid-session it would be a
                thumb-slip away from throwing the run away. */}
            {!active && (
              <>
                <Button className="mt-2" loading={busy} onPress={finish}>
                  {t('recording.finish', { defaultValue: 'Finish and save' })}
                </Button>
                <Button variant="ghost" disabled={busy} onPress={discard}>
                  {t('recording.discard', { defaultValue: 'Discard' })}
                </Button>
              </>
            )}
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
      </ScrollView>
    </View>
  );
}
