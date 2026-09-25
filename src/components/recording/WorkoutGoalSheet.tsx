import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import NativePromptSheet from '../ui/NativePromptSheet';
import StepperInput, { useStepperDraft } from '../StepperInput';
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
  const title =
    kind === 'time'
      ? t('workoutSetup.time', { defaultValue: 'Time' })
      : kind === 'distance'
        ? t('workoutSetup.distance', { defaultValue: 'Distance' })
        : t('workoutSetup.calories', { defaultValue: 'Calories' });
  const draft = useStepperDraft({
    value,
    min: kind === 'calories' ? 25 : kind === 'distance' ? 0.1 : 1,
    max: kind === 'calories' ? 5000 : kind === 'time' ? 600 : 500,
    step: kind === 'calories' ? 25 : kind === 'time' ? 5 : 0.1,
    onCommit: onChange,
  });
  return (
    <NativePromptSheet
      open={open}
      title={title}
      onClose={onClose}
      footerLabel={t('common.done', { defaultValue: 'Done' })}
      onFooterPress={() => {
        draft.onBlur();
        onClose();
      }}
    >
      <View className="items-center">
        <StepperInput
          value={draft.value}
          onChangeText={draft.onChangeText}
          onBlur={draft.onBlur}
          onIncrement={draft.onIncrement}
          onDecrement={draft.onDecrement}
          keyboardType={kind === 'distance' ? 'decimal-pad' : 'number-pad'}
          accessibilityLabels={{ input: title }}
        />
        <Text className="text-text-secondary mt-4">
          {kind === 'time'
            ? t('workoutSetup.minutesUnit', { defaultValue: 'MIN' })
            : kind === 'calories'
              ? t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' })
              : distanceUnit === 'miles'
                ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
                : t('workoutSetup.kmUnit', { defaultValue: 'KM' })}
        </Text>
      </View>
    </NativePromptSheet>
  );
}
