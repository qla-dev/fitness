import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import PromptSheet from './ui/PromptSheet';
import StepperInput from './StepperInput';
import { formatDuration } from '../utils/workoutSession';

export interface WorkoutDurationSheetRef {
  /** Open prefilled with `initialMinutes`, capped at `maxMinutes`. */
  present: (initialMinutes: number, maxMinutes: number) => void;
  dismiss: () => void;
}

interface WorkoutDurationSheetProps {
  onSave: (minutes: number) => void;
}

/**
 * Custom editor for the end-of-workout "adjust duration" prompt: pick how many
 * minutes the workout counts as, capped at its wall-clock span. The value in
 * minutes; exercise duration and burned calories derive from it.
 *
 * GoalEdit's sheet (PromptSheet): the stepper under the explanation, Save in
 * the footer.
 */
const WorkoutDurationSheet = forwardRef<
  WorkoutDurationSheetRef,
  WorkoutDurationSheetProps
>(({ onSave }, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const [currentValue, setCurrentValue] = useState<number>(60);
  const [maxMinutes, setMaxMinutes] = useState<number>(60);
  const [text, setText] = useState('60');

  const clampMinutes = useCallback((minutes: number, max: number) => {
    if (!Number.isFinite(minutes)) return 1;
    return Math.max(1, Math.min(max, Math.round(minutes)));
  }, []);

  useImperativeHandle(ref, () => ({
    present: (initialMinutes, max) => {
      const boundedMax = Math.max(1, Math.floor(max));
      const initial = clampMinutes(initialMinutes, boundedMax);
      setMaxMinutes(boundedMax);
      setCurrentValue(initial);
      setText(String(initial));
      setOpen(true);
    },
    dismiss: () => setOpen(false),
  }));

  const parsed = useMemo(() => {
    const n = parseInt(text, 10);
    return Number.isNaN(n) ? NaN : n;
  }, [text]);

  const adjust = (delta: number) => {
    const base = Number.isNaN(parsed) ? currentValue : parsed;
    setText(String(clampMinutes(base + delta, maxMinutes)));
  };

  const handleTextChange = (value: string) => {
    // Only allow positive integer digits while typing.
    if (value === '' || /^\d+$/.test(value)) {
      setText(value);
    }
  };

  const clampOnBlur = () => {
    if (Number.isNaN(parsed)) {
      setText(String(currentValue));
      return;
    }
    setText(String(clampMinutes(parsed, maxMinutes)));
  };

  const handleSave = () => {
    const base = Number.isNaN(parsed) ? currentValue : parsed;
    onSave(clampMinutes(base, maxMinutes));
    setOpen(false);
  };

  return (
    <PromptSheet
      open={open}
      onClose={() => setOpen(false)}
      headerTitle=""
      title={t('workout.durationTitle', { defaultValue: 'Workout duration' })}
      description={t('workout.durationDescription', {
        defaultValue:
          'Minutes this workout counts as, up to its {{span}} span.',
        span: formatDuration(maxMinutes),
      })}
      footerLabel={t('common.save', { defaultValue: 'Save' })}
      onFooterPress={handleSave}
      hasTextInput
    >
      <View className="flex-row items-center justify-center">
        <StepperInput
          value={text}
          onChangeText={handleTextChange}
          onBlur={clampOnBlur}
          onDecrement={() => adjust(-5)}
          onIncrement={() => adjust(5)}
          keyboardType="number-pad"
        />
        <Text className="text-text-secondary text-base ml-3">
          {formatDuration(Number.isNaN(parsed) ? currentValue : parsed)}
        </Text>
      </View>
    </PromptSheet>
  );
});

WorkoutDurationSheet.displayName = 'WorkoutDurationSheet';

export default WorkoutDurationSheet;
