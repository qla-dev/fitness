import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import NativePromptSheet from '../ui/NativePromptSheet';
import SheetStepper from '../ui/SheetStepper';
import Icon from '../Icon';
import { formatLocalizedNumber } from '../../localization';
import { fireSelectionHaptic } from '../../services/haptics';
import type { WorkoutGoalSheetProps } from '../../types/workoutGoalSheet';

export default function WorkoutGoalSheet({
  open,
  kind,
  value,
  distanceUnit,
  onChange,
  onClose,
}: WorkoutGoalSheetProps) {
  const { t } = useTranslation();
  const tint = useCSSVariable('--color-accent-primary') as string;
  const [draft, setDraft] = useState(value);
  const minimum = kind === 'calories' ? 25 : kind === 'distance' ? 0.1 : 1;
  const maximum = kind === 'calories' ? 5000 : kind === 'time' ? 600 : 500;
  const stepSize = kind === 'calories' ? 25 : kind === 'time' ? 5 : 0.1;
  const title =
    kind === 'time'
      ? t('workoutSetup.time', { defaultValue: 'Time' })
      : kind === 'distance'
        ? t('workoutSetup.distance', { defaultValue: 'Distance' })
        : t('workoutSetup.calories', { defaultValue: 'Calories' });
  const unit =
    kind === 'time'
      ? t('workoutSetup.minutesUnit', { defaultValue: 'MIN' })
      : kind === 'calories'
        ? t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' })
        : distanceUnit === 'miles'
          ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
          : t('workoutSetup.kmUnit', { defaultValue: 'KM' });
  const step = (direction: 1 | -1) => {
    fireSelectionHaptic();
    setDraft((current) =>
      Math.max(
        minimum,
        Math.min(
          maximum,
          Math.round((current + direction * stepSize) * 10) / 10
        )
      )
    );
  };
  return (
    <NativePromptSheet
      open={open}
      onClose={onClose}
      title={title}
      category={t('profile.goals', { defaultValue: 'Goals' })}
      footerLabel={t('common.done', { defaultValue: 'Done' })}
      onFooterPress={() => {
        onChange(draft);
        onClose();
      }}
    >
      <SheetStepper
        value={formatLocalizedNumber(draft, { maximumFractionDigits: 1 })}
        unit={unit}
        tint={tint}
        badge={
          <Icon
            name={
              kind === 'calories'
                ? 'flame'
                : kind === 'time'
                  ? 'timer'
                  : 'gps-track'
            }
            size={56}
            color={tint}
          />
        }
        decrementLabel={t('profile.goalDecrease', {
          defaultValue: 'Decrease goal',
        })}
        incrementLabel={t('profile.goalIncrease', {
          defaultValue: 'Increase goal',
        })}
        decrementDisabled={draft <= minimum}
        incrementDisabled={draft >= maximum}
        onDecrement={() => step(-1)}
        onIncrement={() => step(1)}
      />
    </NativePromptSheet>
  );
}
