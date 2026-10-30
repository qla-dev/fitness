import { useTranslation } from 'react-i18next';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text } from 'react-native';
import PromptSheet from './ui/PromptSheet';
import StepperInput from './StepperInput';
import { useUpdateFoodEntry } from '../hooks/useUpdateFoodEntry';
import type { FoodEntry } from '../types/foodEntries';
import { formatServingUnit } from '../utils/foodDetails';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';

export interface ServingAdjustSheetRef {
  present: (entry: FoodEntry) => void;
  dismiss: () => void;
}

interface ServingAdjustSheetProps {
  onViewEntry?: (entry: FoodEntry) => void;
}

/**
 * Quick serving change for a diary entry: GoalEdit's sheet (PromptSheet),
 * the food as the heading, the quantity stepper and the resulting calories in
 * the middle, Done in the footer.
 */
const ServingAdjustSheet = forwardRef<
  ServingAdjustSheetRef,
  ServingAdjustSheetProps
>(({ onViewEntry }, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<FoodEntry | null>(null);
  const [quantityText, setQuantityText] = useState('0');

  const quantity = parseDecimalInput(quantityText) || 0;
  const totalCalories =
    entry && entry.serving_size > 0
      ? Math.round((entry.calories * quantity) / entry.serving_size)
      : 0;

  const { updateEntry, isPending, invalidateCache } = useUpdateFoodEntry({
    entryId: entry?.id ?? '',
    entryDate: entry?.entry_date ?? '',
    onSuccess: () => {
      invalidateCache();
      setOpen(false);
    },
  });

  useImperativeHandle(ref, () => ({
    present: (newEntry: FoodEntry) => {
      if (!newEntry.serving_size || newEntry.serving_size <= 0) return;
      setEntry(newEntry);
      setQuantityText(String(newEntry.quantity));
      setOpen(true);
    },
    dismiss: () => setOpen(false),
  }));

  const formatQuantity = (value: number): string => {
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  };

  const clampQuantity = () => {
    if (quantity <= 0) setQuantityText(formatQuantity(0.5));
  };

  const adjustQuantity = (delta: number) => {
    const step = (entry?.serving_size ?? 2) / 2;
    if (quantity <= 0) {
      if (delta > 0) setQuantityText(formatQuantity(step));
      return;
    }
    const boundary =
      delta > 0
        ? Math.ceil(quantity / step) * step
        : Math.floor(quantity / step) * step;
    const next = boundary !== quantity ? boundary : quantity + delta * step;
    setQuantityText(formatQuantity(Math.max(0.5, next)));
  };

  const updateQuantityText = (text: string) => {
    if (DECIMAL_INPUT_REGEX.test(text)) {
      setQuantityText(text);
    }
  };

  const handleDone = () => {
    if (!entry || quantity <= 0) return;
    if (quantity === entry.quantity) {
      setOpen(false);
      return;
    }
    updateEntry({ quantity });
  };

  return (
    <PromptSheet
      open={open && entry !== null}
      onClose={() => setOpen(false)}
      headerTitle=""
      title={
        entry?.food_name ||
        t('foodRow.unknownFood', { defaultValue: 'Unknown food' })
      }
      description={
        entry
          ? `${entry.serving_size} ${formatServingUnit(entry.unit)} = ${entry.calories} ${t('nutrition.caloriesUnit', { defaultValue: 'Cal' })}`
          : undefined
      }
      footerLabel={
        isPending
          ? t('common.saving', { defaultValue: 'Saving…' })
          : t('common.done', { defaultValue: 'Done' })
      }
      onFooterPress={handleDone}
      footerDisabled={isPending || quantity <= 0}
      hasTextInput
    >
      {entry && (
        <View className="items-center gap-5">
          <View className="flex-row items-center">
            <StepperInput
              value={quantityText}
              onChangeText={updateQuantityText}
              onBlur={clampQuantity}
              onDecrement={() => adjustQuantity(-1)}
              onIncrement={() => adjustQuantity(1)}
            />
            <Text className="text-text-secondary text-lg ml-3">
              {formatServingUnit(entry.unit)}
            </Text>
          </View>
          <Text className="text-text-primary text-2xl font-semibold">
            {totalCalories}{' '}
            {t('nutrition.caloriesUnit', { defaultValue: 'Cal' })}
          </Text>
        </View>
      )}
    </PromptSheet>
  );
});

ServingAdjustSheet.displayName = 'ServingAdjustSheet';

export default ServingAdjustSheet;
