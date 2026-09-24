import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from '../components/Icon';
import LiquidGlassSurface from '../components/LiquidGlassSurface';
import { canUseLiquidGlass } from '../utils/liquidGlass';
import StepperInput, { useStepperDraft } from '../components/StepperInput';
import { ToggleChipRow } from '../components/FilterChipRow';
import SensorSheet from '../components/recording/SensorSheet';
import NativePromptSheet from '../components/ui/NativePromptSheet';
import { useMeasurementHistory } from '../hooks/useMeasurementHistory';
import { useUpsertCheckIn } from '../hooks/useUpsertCheckIn';
import {
  getSensorSnapshot,
  setWheelCircumference,
  subscribeSensors,
  startWatchHeartRate,
  stopWatchHeartRate,
} from '../services/recording/sensors';
import { usePreferences } from '../hooks/usePreferences';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { fireSelectionHaptic } from '../services/haptics';
import type { RecordingGoal } from '../services/recording/types';
import { formatLocalizedNumber } from '../localization';
import { getTodayDate } from '../utils/dateUtils';
import { withAlpha } from '../utils/colors';
import {
  distanceToKm,
  weightFromKg,
  weightToKg,
} from '../utils/unitConversions';
import { parseDecimalInput } from '../utils/numericInput';
import type { RootStackScreenProps } from '../types/navigation';

type Props = RootStackScreenProps<'WorkoutSetup'>;

/** First targets offered, in the unit each card is edited in. */
const DEFAULT_MINUTES = 30;
const DEFAULT_DISTANCE = 5;
const DEFAULT_CALORIES = 300;

/**
 * What a single workout is going to be, before it starts.
 *
 * A program session opens straight into sets and reps because the program
 * already says what to do. A single workout has no plan behind it, so this is
 * where the plan gets made: give it a target — a time, a distance, a calorie
 * burn — or take Quick start and just go. Every card is its own start button,
 * so picking the goal and starting are one tap rather than two.
 *
 * Body weight sits here rather than in the recorder because it is setup, not
 * a live control: it only feeds the calorie estimate, and it arrives prefilled
 * from the last weigh-in, so the ordinary case really is the single tap.
 */
export default function WorkoutSetupScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const { sport, sportId } = route.params;

  const [green, amber, blue, pink, surface] = useCSSVariable([
    '--color-cat-green',
    '--color-cat-amber',
    '--color-cat-blue',
    '--color-cat-pink',
    '--color-surface',
  ]) as string[];

  const { preferences } = usePreferences();
  const distanceUnit =
    preferences?.default_distance_unit === 'miles' ? 'miles' : 'km';
  const weightUnit = preferences?.default_weight_unit === 'lbs' ? 'lbs' : 'kg';

  // Stored metric, shown in the user's unit — the conversion the measurement
  // tiles already do. An edit takes over from the prefill.
  const { history } = useMeasurementHistory(getTodayDate());
  const lastWeight = history?.weight?.shown ?? null;
  // Standing facts about the person, shown so the estimate is not a black box:
  // height never changes between sessions, weight rarely does.
  const lastHeight = history?.height?.shown ?? null;
  const [heightEdit, setHeightEdit] = useState<string | null>(null);
  const heightValue =
    heightEdit ?? (lastHeight === null ? '' : String(Math.round(lastHeight)));
  const [editingStat, setEditingStat] = useState<
    'weight' | 'height' | 'wheel' | null
  >(null);
  const upsertCheckIn = useUpsertCheckIn();
  const usesGlass = canUseLiquidGlass();
  // Off means the session is timed but leaves no route — indoors, or on a
  // court, where a trace is noise and the battery is better spent elsewhere.
  const [gpsEnabled, setGpsEnabled] = useState(true);
  // Quick start is not a goal, so it only shows under "All"; "Custom" is where
  // saved workouts of your own will land and has nothing in it yet.
  const [goalFilter, setGoalFilter] = useState('all');
  // On when a watch is paired: its heart rate is the better reading, and the
  // switch is there for when you would rather it stayed out of the session.
  const [watchChoice, setWatchEnabled] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (startingRef.current) void stopWatchHeartRate();
    };
  }, []);
  const [sensorsOpen, setSensorsOpen] = useState(false);
  // Which target the sheet is editing, if any. One sheet for the three cards:
  // they ask the same question in different units.
  const [editingGoal, setEditingGoal] = useState<
    'time' | 'distance' | 'calories' | null
  >(null);
  // Asked for here rather than at the first GPS fix: a permission sheet that
  // appears the moment you start running is a sheet nobody reads. Setup is
  // where you are still looking at the phone.
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const askForLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    const granted =
      permission.granted && permission.android?.accuracy !== 'coarse';
    setLocationGranted(granted);
    return granted;
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existing = await Location.getForegroundPermissionsAsync();
      const granted =
        existing.granted && existing.android?.accuracy !== 'coarse';
      if (cancelled) return;
      setLocationGranted(granted);
      // Asked on arrival rather than at the first fix: a permission sheet that
      // appears the moment you start running is a sheet nobody reads.
      if (!granted && existing.canAskAgain) await askForLocation();
    })();
    return () => {
      cancelled = true;
    };
    // Arrival only: re-running this on every toggle would re-prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No location is read on this screen. Setup asks for the permission — so
  // the sheet is answered while you are still looking at the phone — but the
  // receiver stays off until a session actually starts, and stops with it.
  // Warming it up here meant the system indicator stayed lit while you were
  // elsewhere in the app, which reads as being tracked for no reason.
  const sensors = useSyncExternalStore(subscribeSensors, getSensorSnapshot);
  // Paired and carrying our app is what makes the watch usable here. Asking
  // whether it is streaming — which is what this used to do — could only ever
  // answer no on this screen: the stream opens with the session being set up,
  // so a watch on the wrist read as "No watch connected" right up until the
  // moment the screen was gone.
  const watchConnected =
    sensors.watchAvailable ||
    sensors.watchStreaming ||
    sensors.heartRateSource === 'watch';
  const watchEnabled = watchChoice ?? watchConnected;
  // Wheel size only means anything on a bike, and only a bike sensor uses
  // it: it is what turns wheel revolutions into distance.
  const [wheelEdit, setWheelEdit] = useState<string | null>(null);
  const wheelValue = wheelEdit ?? String(sensors.wheelMm);
  const commitWheel = () => {
    setEditingStat(null);
    const value = parseDecimalInput(wheelValue);
    if (!(value > 0) || value === sensors.wheelMm) return;
    void setWheelCircumference(value);
  };
  const [weightEdit, setWeightEdit] = useState<string | null>(null);
  const weight =
    weightEdit ??
    (lastWeight === null
      ? ''
      : String(Math.round(weightFromKg(lastWeight, weightUnit) * 10) / 10));

  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);

  // Named the way the card that led here is named, not the way the recorder
  // labels the sport internally.
  const title =
    sport === 'ride'
      ? t('startWorkout.cycling', { defaultValue: 'Cycling' })
      : t('startWorkout.running', { defaultValue: 'Running' });

  // The Workout app's shape: a large title with the cards under it. The stats
  // and the goal filter are page content rather than header accessories —
  // they belong with the cards they describe and scroll away with them.
  const header = useScreenHeader({
    variant: 'system',
    title,
    nativeTitle: title,
    largeTitle: true,
    left: { kind: 'back' },
    right: {
      kind: 'menu',
      accessibilityLabel: t('workoutSetup.filterLabel', {
        defaultValue: 'Filter workouts',
      }),
      identifier: 'workout-setup-filter',
      showsBadge: goalFilter !== 'all',
      items: [
        {
          label: t('workoutSetup.filterLabel', {
            defaultValue: 'Filter workouts',
          }),
          items: [
            {
              label: t('workoutSetup.filters.all', { defaultValue: 'All' }),
              sfSymbol: 'square.stack.3d.up',
              icon: 'meal',
              selected: goalFilter === 'all',
              onPress: () => setGoalFilter('all'),
            },
            {
              label: t('workoutSetup.filters.goals', { defaultValue: 'Goals' }),
              sfSymbol: 'timer',
              icon: 'timer',
              selected: goalFilter === 'goals',
              onPress: () => setGoalFilter('goals'),
            },
            {
              label: t('workoutSetup.filters.custom', {
                defaultValue: 'Custom',
              }),
              sfSymbol: 'doc.on.clipboard',
              icon: 'paste',
              selected: goalFilter === 'custom',
              onPress: () => setGoalFilter('custom'),
            },
          ],
        },
      ],
    },
  });

  const canStart = parseDecimalInput(weight) > 0 && !starting;

  // Written back to the day's check-in rather than kept on the screen: this is
  // the same weight the measurement tiles show, and a run started after an
  // edit should agree with them.
  const commitWeight = () => {
    setEditingStat(null);
    const value = parseDecimalInput(weight);
    if (!(value > 0) || value === lastWeight) return;
    upsertCheckIn.mutate({
      entryDate: getTodayDate(),
      weight: weightToKg(value, weightUnit),
    });
  };
  const commitHeight = () => {
    setEditingStat(null);
    const value = parseDecimalInput(heightValue);
    if (!(value > 0) || value === lastHeight) return;
    upsertCheckIn.mutate({ entryDate: getTodayDate(), height: value });
  };

  /** One tappable stat. Tapping swaps the reading for a focused input. */
  const statCard = ({
    field,
    icon,
    color,
    label,
    unit,
    value,
    onChangeText,
    onCommit,
  }: {
    field: 'weight' | 'height' | 'wheel';
    icon: IconName;
    color: string;
    label: string;
    unit: string;
    value: string;
    onChangeText: (next: string) => void;
    onCommit: () => void;
  }) => {
    const editing = editingStat === field;
    // Glass, like the chips under them: the two rows read as one control
    // strip rather than a filled card above a row of pills. Off iOS 26 the
    // material falls back to the raised fill these had before.
    return (
      <LiquidGlassSurface
        isInteractive
        style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            fireSelectionHaptic();
            setEditingStat(field);
          }}
          className={`flex-1 flex-row items-center gap-3 rounded-2xl px-4 py-3${
            usesGlass ? '' : ' bg-raised'
          }`}
        >
          <Icon name={icon} size={20} color={color} />
          <View className="flex-1">
            <Text className="text-text-muted text-xs" numberOfLines={1}>
              {label}
            </Text>
            {/* One row in both states, with the unit pinned beside the value:
                the reading and the field occupy the same space, so nothing
                moves when the card is tapped and a long value shortens itself
                rather than pushing the unit onto a second line. */}
            <View className="flex-row items-baseline">
              {editing ? (
                <TextInput
                  autoFocus
                  selectTextOnFocus
                  value={value}
                  onChangeText={onChangeText}
                  onBlur={onCommit}
                  onSubmitEditing={onCommit}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  className="text-text-primary text-base font-semibold"
                  style={{ flexShrink: 1, padding: 0 }}
                />
              ) : (
                <Text
                  className="text-text-primary text-base font-semibold"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {value || '—'}
                </Text>
              )}
              <Text
                className="text-text-muted text-xs ml-1"
                numberOfLines={1}
                style={{ flexShrink: 0 }}
              >
                {unit}
              </Text>
            </View>
          </View>
        </Pressable>
      </LiquidGlassSurface>
    );
  };

  // Denied, but the session is about to record a route anyway: the system
  // only asks once, so the way back is the Settings app.
  const promptForLocationSettings = () => {
    Alert.alert(
      t('workoutSetup.locationTitle', {
        defaultValue: 'Track your route?',
      }),
      t('workoutSetup.locationMessage', {
        defaultValue:
          'Location access is off, so this session will record time and calories but no route. Turn it on in Settings to trace where you go.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('workoutSetup.openSettings', { defaultValue: 'Settings' }),
          onPress: () => void Linking.openSettings(),
        },
      ]
    );
  };

  const begin = useCallback(
    (goal: RecordingGoal) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setStarting(true);
      if (watchEnabled) setWatchEnabled(true);
      void (async () => {
        try {
          if (watchEnabled) await startWatchHeartRate(sport, { sportId });
          if (!mountedRef.current) return;
          startingRef.current = false;
          navigation.replace('RunOrRide', {
            sport,
            sportId,
            gps: gpsEnabled,
            watch: watchEnabled,
            goal,
            weightKg: weightToKg(parseDecimalInput(weight), weightUnit),
          });
        } catch {
          if (!mountedRef.current) return;
          Alert.alert(
            t('workoutSetup.watchStartFailedTitle', {
              defaultValue: 'Watch workout did not start',
            }),
            t('workoutSetup.watchStartFailedMessage', {
              defaultValue:
                'Open qla.fit on your Apple Watch, then try again. Your phone workout has not started.',
            }),
            [{ text: t('common.ok', { defaultValue: 'OK' }) }]
          );
        } finally {
          startingRef.current = false;
          if (mountedRef.current) setStarting(false);
        }
      })();
    },
    [
      watchEnabled,
      sport,
      sportId,
      navigation,
      gpsEnabled,
      weight,
      weightUnit,
      t,
    ]
  );

  const start = (goal: RecordingGoal) => {
    if (starting) return;
    fireSelectionHaptic();
    if (gpsEnabled && locationGranted === false) {
      promptForLocationSettings();
      return;
    }
    if (!gpsEnabled) {
      Alert.alert(
        t('workoutSetup.noGpsTitle', { defaultValue: 'Start without GPS?' }),
        t('workoutSetup.noGpsMessage', {
          defaultValue:
            'This session will record time, heart rate and calories, but no route or distance from GPS.',
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('workoutSetup.startAnyway', { defaultValue: 'Start' }),
            onPress: () => begin(goal),
          },
        ]
      );
      return;
    }
    if (watchConnected && !watchEnabled) {
      Alert.alert(
        t('workoutSetup.noWatchTitle', {
          defaultValue: 'Start without your watch?',
        }),
        t('workoutSetup.noWatchMessage', {
          defaultValue:
            'Your watch is connected but will stay out of this session, so there will be no heart rate from it.',
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('workoutSetup.startAnyway', { defaultValue: 'Start' }),
            onPress: () => begin(goal),
          },
        ]
      );
      return;
    }
    begin(goal);
  };

  const minuteDraft = useStepperDraft({
    value: minutes,
    min: 1,
    max: 600,
    step: 5,
    onCommit: setMinutes,
  });
  const distanceDraft = useStepperDraft({
    value: distance,
    min: 1,
    max: 500,
    onCommit: setDistance,
  });
  const calorieDraft = useStepperDraft({
    value: calories,
    min: 25,
    max: 5000,
    step: 25,
    onCommit: setCalories,
  });

  const card = (
    color: string,
    icon: IconName,
    label: string,
    goal: RecordingGoal,
    value?: string,
    onEdit?: () => void
  ) => (
    <Pressable
      accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityLabel={
        onEdit
          ? t('workoutSetup.editGoal', {
              defaultValue: 'Edit {{goal}}',
              goal: label,
            })
          : undefined
      }
      disabled={!onEdit}
      onPress={() => {
        if (!onEdit) return;
        fireSelectionHaptic();
        onEdit();
      }}
      className="rounded-3xl p-4 mb-3"
      style={{ backgroundColor: withAlpha(color, 0.16) }}
    >
      <View className="flex-row items-center">
        <Icon name={icon} size={30} color={color} />
        <View className="flex-1 ml-3">
          <Text className="text-text-primary text-xl font-bold">{label}</Text>
          {value ? (
            <Text
              className="text-base font-semibold mt-0.5"
              style={{ color }}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
        </View>
        {/* Glass, like the tab bar: the start control is the one thing on the
            card that acts on its own, so it gets the material that reacts to
            a press rather than a flat disc. */}
        <LiquidGlassSurface
          isInteractive
          tintColor={color}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workoutSetup.startGoal', {
              defaultValue: 'Start {{goal}}',
              goal: label,
            })}
            disabled={!canStart}
            onPress={() => start(goal)}
            className="w-full h-full items-center justify-center"
            style={{
              backgroundColor: usesGlass ? undefined : color,
              opacity: canStart ? 1 : 0.4,
            }}
          >
            <Icon name="play" size={24} color={surface} />
          </Pressable>
        </LiquidGlassSurface>
      </View>
    </Pressable>
  );

  return (
    // The status-bar inset goes on the container, above the bar, the way
    // PresetSearch and ExerciseProgram carry it: on the screen-owned header
    // path the bar is the first thing on screen, and an inset on the scroll
    // content instead left the bar under the clock with a blank band below.
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {starting && (
        <View className="flex-row items-center gap-3 p-4">
          <ActivityIndicator />
          <Text className="flex-1 text-text-primary">
            {t('workoutSetup.openingWatch', {
              defaultValue:
                'Opening Apple Watch and waiting for its workout to start...',
            })}
          </Text>
        </View>
      )}
      <ScrollView
        pointerEvents={starting ? 'none' : 'auto'}
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-background"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* What the calorie estimate is based on. Both edit in place — one
            tap puts the caret in the card — and commit on blur to the day's
            check-in, so the value the estimate uses is the value on file. */}
        <View className="flex-row gap-2 mb-3">
          {statCard({
            field: 'weight',
            icon: 'scale',
            color: blue,
            label: t('workoutSetup.weightLabel', { defaultValue: 'Weight' }),
            unit: weightUnit,
            value: weight,
            onChangeText: setWeightEdit,
            onCommit: commitWeight,
          })}
          {statCard({
            field: 'height',
            icon: 'measurements',
            color: green,
            label: t('workoutSetup.heightLabel', { defaultValue: 'Height' }),
            unit: 'cm',
            value: heightValue,
            onChangeText: setHeightEdit,
            onCommit: commitHeight,
          })}
          {sport === 'ride' &&
            statCard({
              field: 'wheel',
              icon: 'exercise-cycling',
              color: amber,
              label: t('workoutSetup.wheelLabel', { defaultValue: 'Wheel' }),
              unit: 'mm',
              value: wheelValue,
              onChangeText: setWheelEdit,
              onCommit: commitWheel,
            })}
        </View>

        {/* How this session gets measured. Two switches rather than a
            segmented control: tracing a route and reading the watch are
            independent, and either can be on without the other. */}
        <View className="-mx-4 mb-1">
          <ToggleChipRow
            options={[
              {
                value: 'gps',
                label:
                  gpsEnabled && locationGranted !== false
                    ? t('workoutSetup.gpsOn', {
                        defaultValue: 'GPS tracking on',
                      })
                    : t('workoutSetup.gpsOff', {
                        defaultValue: 'GPS tracking off',
                      }),
                icon: 'gps-track',
                on: gpsEnabled && locationGranted !== false,
              },
              {
                value: 'watch',
                // Three states, because a paired watch without our app is not
                // the same as no watch and is fixed by a different thing.
                label: watchConnected
                  ? t('workoutSetup.watch', { defaultValue: 'Watch' })
                  : sensors.watchNeedsApp
                    ? t('workoutSetup.watchNeedsApp', {
                        defaultValue: 'Install the watch app',
                      })
                    : t('workoutSetup.watchDisconnected', {
                        defaultValue: 'No watch connected',
                      }),
                icon: 'device-watch',
                on: watchEnabled,
                // Nothing to turn on until one is paired.
                disabled: !watchConnected && !watchEnabled,
              },
              {
                value: 'sensors',
                label:
                  sensors.devices.length > 0
                    ? t('workoutSetup.sensorsConnected', {
                        defaultValue: 'Sensors',
                      })
                    : t('recording.sensors', {
                        defaultValue: 'Bluetooth sensors',
                      }),
                icon: 'heart-rate',
                on: sensors.devices.length > 0,
              },
            ]}
            onToggle={(value) => {
              // Not a switch: pairing is a place you go, and the chip reports
              // whether anything is connected rather than turning it on.
              if (value === 'sensors') return setSensorsOpen(true);
              if (value === 'gps') {
                // Turning it on is also when the permission is worth asking
                // for: the answer decides whether the chip can be on at all.
                if (!gpsEnabled) {
                  void askForLocation().then((granted) => {
                    setGpsEnabled(true);
                    if (!granted) promptForLocationSettings();
                  });
                  return;
                }
                return setGpsEnabled(false);
              }
              setWatchEnabled((on) => !(on ?? watchConnected));
            }}
          />
        </View>

        {goalFilter === 'all' &&
          card(
            green,
            'checkmark-circle',
            t('workoutSetup.quickStart', { defaultValue: 'Quick start' }),
            { type: 'open', target: 0 }
          )}
        {goalFilter !== 'custom' &&
          card(
            amber,
            'timer',
            t('workoutSetup.time', { defaultValue: 'Time' }),
            { type: 'time', target: minutes * 60 },
            `${formatLocalizedNumber(minutes, { maximumFractionDigits: 0 })} ${t(
              'workoutSetup.minutesUnit',
              { defaultValue: 'MIN' }
            )}`,
            () => setEditingGoal('time')
          )}
        {goalFilter !== 'custom' &&
          card(
            blue,
            'exercise-running',
            t('workoutSetup.distance', { defaultValue: 'Distance' }),
            {
              type: 'distance',
              target: distanceToKm(distance, distanceUnit) * 1000,
            },
            `${formatLocalizedNumber(distance, {
              maximumFractionDigits: 1,
            })} ${
              distanceUnit === 'miles'
                ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
                : t('workoutSetup.kmUnit', { defaultValue: 'KM' })
            }`,
            () => setEditingGoal('distance')
          )}
        {goalFilter !== 'custom' &&
          card(
            pink,
            'exercise',
            t('workoutSetup.calories', { defaultValue: 'Calories' }),
            { type: 'calories', target: calories },
            `${formatLocalizedNumber(calories, {
              maximumFractionDigits: 0,
            })} ${t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' })}`,
            () => setEditingGoal('calories')
          )}
        {goalFilter === 'custom' && (
          <View className="items-center py-10 px-6">
            <Icon name="paste" size={28} color={surface} />
            <Text className="text-text-secondary text-base font-semibold mt-3 text-center">
              {t('workoutSetup.customEmptyTitle', {
                defaultValue: 'No custom workouts yet',
              })}
            </Text>
            <Text className="text-text-muted text-sm mt-1 text-center">
              {t('workoutSetup.customEmptyMessage', {
                defaultValue: 'Workouts you build yourself will show up here.',
              })}
            </Text>
          </View>
        )}
      </ScrollView>
      <SensorSheet open={sensorsOpen} onClose={() => setSensorsOpen(false)} />
      {/* One sheet for the three targets: same question, different unit. The
          stepper lives here rather than on the card, where it competed with
          the card's own tap and the start button beside it. */}
      <NativePromptSheet
        open={editingGoal !== null}
        onClose={() => setEditingGoal(null)}
        title={
          editingGoal === 'time'
            ? t('workoutSetup.time', { defaultValue: 'Time' })
            : editingGoal === 'distance'
              ? t('workoutSetup.distance', { defaultValue: 'Distance' })
              : t('workoutSetup.calories', { defaultValue: 'Calories' })
        }
        description={t('workoutSetup.goalSheetMessage', {
          defaultValue:
            'A goal is a target, not a limit — the session keeps recording past it until you finish.',
        })}
        footerLabel={t('common.done', { defaultValue: 'Done' })}
        onFooterPress={() => setEditingGoal(null)}
      >
        <View className="items-center">
          <View style={{ width: 200 }}>
            <StepperInput
              keyboardType="number-pad"
              value={
                editingGoal === 'time'
                  ? minuteDraft.value
                  : editingGoal === 'distance'
                    ? distanceDraft.value
                    : calorieDraft.value
              }
              onChangeText={
                editingGoal === 'time'
                  ? minuteDraft.onChangeText
                  : editingGoal === 'distance'
                    ? distanceDraft.onChangeText
                    : calorieDraft.onChangeText
              }
              onBlur={
                editingGoal === 'time'
                  ? minuteDraft.onBlur
                  : editingGoal === 'distance'
                    ? distanceDraft.onBlur
                    : calorieDraft.onBlur
              }
              onIncrement={
                editingGoal === 'time'
                  ? minuteDraft.onIncrement
                  : editingGoal === 'distance'
                    ? distanceDraft.onIncrement
                    : calorieDraft.onIncrement
              }
              onDecrement={
                editingGoal === 'time'
                  ? minuteDraft.onDecrement
                  : editingGoal === 'distance'
                    ? distanceDraft.onDecrement
                    : calorieDraft.onDecrement
              }
              accessibilityLabels={{
                input:
                  editingGoal === 'time'
                    ? t('workoutSetup.timeTarget', {
                        defaultValue: 'Time goal in minutes',
                      })
                    : editingGoal === 'distance'
                      ? t('workoutSetup.distanceTarget', {
                          defaultValue: 'Distance goal',
                        })
                      : t('workoutSetup.calorieTarget', {
                          defaultValue: 'Calorie goal',
                        }),
              }}
            />
          </View>
          <Text className="text-text-secondary text-base font-semibold mt-4 uppercase">
            {editingGoal === 'time'
              ? t('workoutSetup.minutesUnit', { defaultValue: 'MIN' })
              : editingGoal === 'distance'
                ? distanceUnit === 'miles'
                  ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
                  : t('workoutSetup.kmUnit', { defaultValue: 'KM' })
                : t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' })}
          </Text>
        </View>
      </NativePromptSheet>
    </View>
  );
}
