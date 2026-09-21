import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import FormInput from '../components/FormInput';
import Icon, { type IconName } from '../components/Icon';
import StepperInput, { useStepperDraft } from '../components/StepperInput';
import { useMeasurementHistory } from '../hooks/useMeasurementHistory';
import { usePreferences } from '../hooks/usePreferences';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { fireSelectionHaptic } from '../services/haptics';
import type { RecordingGoal } from '../services/recording/types';
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
  const { sport } = route.params;

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

  useScreenHeader({ title, nativeTitle: title, left: { kind: 'back' } });

  const canStart = parseDecimalInput(weight) > 0;

  const start = (goal: RecordingGoal) => {
    fireSelectionHaptic();
    // Replace: with a session running, back belongs to the recorder, and a
    // setup screen left behind it would offer to start a second one.
    navigation.replace('RunOrRide', {
      sport,
      goal,
      weightKg: weightToKg(parseDecimalInput(weight), weightUnit),
    });
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

  const targetRow = (
    color: string,
    draft: ReturnType<typeof useStepperDraft>,
    unit: string,
    accessibilityLabel: string
  ) => (
    <View className="flex-row items-center mt-2">
      <View style={{ width: 128 }}>
        <StepperInput
          compact
          keyboardType="number-pad"
          value={draft.value}
          onChangeText={draft.onChangeText}
          onBlur={draft.onBlur}
          onIncrement={draft.onIncrement}
          onDecrement={draft.onDecrement}
          accessibilityLabels={{ input: accessibilityLabel }}
        />
      </View>
      <Text className="ml-2 text-sm font-semibold" style={{ color }}>
        {unit}
      </Text>
    </View>
  );

  const card = (
    color: string,
    icon: IconName,
    label: string,
    goal: RecordingGoal,
    target?: React.ReactNode
  ) => (
    <View
      className="rounded-3xl p-4 mb-3"
      style={{ backgroundColor: withAlpha(color, 0.16) }}
    >
      <View className="flex-row items-center">
        <Icon name={icon} size={30} color={color} />
        <View className="flex-1 ml-3">
          <Text className="text-text-primary text-xl font-bold">{label}</Text>
          {target}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workoutSetup.startGoal', {
            defaultValue: 'Start {{goal}}',
            goal: label,
          })}
          disabled={!canStart}
          onPress={() => start(goal)}
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: color, opacity: canStart ? 1 : 0.4 }}
        >
          <Icon name="play" size={24} color={surface} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        padding: 16,
        paddingTop: usesNativeHeader ? 16 : insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {card(
        green,
        'checkmark-circle',
        t('workoutSetup.quickStart', { defaultValue: 'Quick start' }),
        { type: 'open', target: 0 }
      )}
      {card(
        amber,
        'timer',
        t('workoutSetup.time', { defaultValue: 'Time' }),
        { type: 'time', target: minutes * 60 },
        targetRow(
          amber,
          minuteDraft,
          t('workoutSetup.minutesUnit', { defaultValue: 'MIN' }),
          t('workoutSetup.timeTarget', { defaultValue: 'Time goal in minutes' })
        )
      )}
      {card(
        blue,
        'exercise-running',
        t('workoutSetup.distance', { defaultValue: 'Distance' }),
        {
          type: 'distance',
          target: distanceToKm(distance, distanceUnit) * 1000,
        },
        targetRow(
          blue,
          distanceDraft,
          distanceUnit === 'miles'
            ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
            : t('workoutSetup.kmUnit', { defaultValue: 'KM' }),
          t('workoutSetup.distanceTarget', { defaultValue: 'Distance goal' })
        )
      )}
      {card(
        pink,
        'exercise',
        t('workoutSetup.calories', { defaultValue: 'Calories' }),
        { type: 'calories', target: calories },
        targetRow(
          pink,
          calorieDraft,
          t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' }),
          t('workoutSetup.calorieTarget', { defaultValue: 'Calorie goal' })
        )
      )}

      <Text className="text-text-secondary text-sm mt-2 mb-2">
        {t('workoutSetup.weightHint', {
          defaultValue: 'Used for the calorie estimate ({{unit}})',
          unit: weightUnit,
        })}
      </Text>
      <FormInput
        accessibilityLabel={t('recording.weight', {
          defaultValue: 'Body weight ({{unit}}), for estimated calories',
          unit: weightUnit,
        })}
        value={weight}
        onChangeText={setWeightEdit}
        keyboardType="decimal-pad"
      />
      {!canStart && (
        <Text className="text-text-muted text-sm mt-2">
          {t('workoutSetup.weightRequired', {
            defaultValue: 'Enter your body weight to start.',
          })}
        </Text>
      )}
      <Text className="text-text-muted text-xs mt-4">
        {t('workoutSetup.goalHint', {
          defaultValue:
            'A goal is a target, not a limit — the session keeps recording past it until you finish.',
        })}
      </Text>
    </ScrollView>
  );
}
