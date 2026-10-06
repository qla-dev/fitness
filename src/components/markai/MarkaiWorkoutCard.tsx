import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import WorkoutGoalCard from '../recording/WorkoutGoalCard';
import { formatLocalizedNumber } from '../../localization';
import { distanceFromKm } from '../../utils/unitConversions';
import type { WorkoutSuggestion } from '../../services/online/markai';

/**
 * The session a Moving help reply suggests, as the same card workout setup
 * shows for that goal: tinted by the goal kind, named by the sport, with the
 * play control that opens setup and starts it there.
 */
export default function MarkaiWorkoutCard({
  workout,
  distanceUnit,
  disabled,
  onStart,
}: {
  workout: WorkoutSuggestion;
  distanceUnit: 'km' | 'miles';
  disabled?: boolean;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  // The setup screen's colours for the same three goals.
  const [amber, blue, pink] = useCSSVariable([
    '--color-cat-amber',
    '--color-cat-blue',
    '--color-cat-pink',
  ]) as string[];
  const color =
    workout.goal === 'time' ? amber : workout.goal === 'distance' ? blue : pink;
  const value =
    workout.goal === 'time'
      ? `${formatLocalizedNumber(workout.value, { maximumFractionDigits: 0 })} ${t(
          'workoutSetup.minutesUnit',
          { defaultValue: 'MIN' }
        )}`
      : workout.goal === 'distance'
        ? `${formatLocalizedNumber(
            distanceFromKm(workout.value, distanceUnit),
            {
              maximumFractionDigits: 1,
            }
          )} ${
            distanceUnit === 'miles'
              ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
              : t('workoutSetup.kmUnit', { defaultValue: 'KM' })
          }`
        : `${formatLocalizedNumber(workout.value, { maximumFractionDigits: 0 })} ${t(
            'workoutSetup.kcalUnit',
            { defaultValue: 'KCAL' }
          )}`;
  return (
    <WorkoutGoalCard
      className=""
      color={color}
      icon={workout.sport === 'ride' ? 'exercise-cycling' : 'exercise-running'}
      label={
        workout.sport === 'ride'
          ? t('startWorkout.cycling', { defaultValue: 'Cycling' })
          : t('startWorkout.running', { defaultValue: 'Running' })
      }
      value={value}
      startDisabled={disabled}
      onStart={onStart}
    />
  );
}
