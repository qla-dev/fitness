import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import Button from './ui/Button';
import NativePromptSheet from './ui/NativePromptSheet';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';

/** One round stepper. Its own component so a re-render does not remount it. */
function StepButton({
  icon,
  label,
  tint,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  tint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="rounded-full items-center justify-center"
      style={({ pressed }) => ({
        width: 68,
        height: 68,
        backgroundColor: tint,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={30} color="#FFF" />
    </Pressable>
  );
}

/**
 * Hydration's one-decision sheet: how much you have drunk today.
 *
 * Built on {@link NativePromptSheet} rather than the app's own modal, so it
 * matches the system sheets the rest of the app now uses. No text field —
 * water is counted in servings of whatever container you drink from, the way
 * every other surface in the app records it, so the sheet opens without a
 * keyboard and puts the count in the middle of the screen where a thumb
 * reaches both steppers.
 *
 * The previous design is kept as `WaterRecordSheetOld` until this one has been
 * through a release.
 */
export default function WaterRecordSheet({
  date,
  consumedMl,
  goalMl,
  onClose,
}: {
  date: string;
  consumedMl: number;
  goalMl: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const water = useWaterIntakeMutation({ date });
  const serving = water.servingVolume ?? 250;

  const step = (direction: 1 | -1) => {
    fireSelectionHaptic();
    if (direction === 1) water.increment();
    else water.decrement();
  };

  return (
    <NativePromptSheet
      open
      onClose={onClose}
      title={t('measurements.water', { defaultValue: 'Water' })}
      description={
        goalMl > 0
          ? t('measurements.waterSheetGoal', {
              defaultValue:
                'Add what you have drunk today, one {{serving}} ml serving at a time. Your goal is {{goal}} ml.',
              serving: formatLocalizedNumber(serving, {
                maximumFractionDigits: 0,
              }),
              goal: formatLocalizedNumber(goalMl, { maximumFractionDigits: 0 }),
            })
          : t('measurements.waterSheet', {
              defaultValue:
                'Add what you have drunk today, one {{serving}} ml serving at a time.',
              serving: formatLocalizedNumber(serving, {
                maximumFractionDigits: 0,
              }),
            })
      }
      footer={
        <Button onPress={onClose}>
          {t('common.done', { defaultValue: 'Done' })}
        </Button>
      }
    >
      <View className="flex-row items-center justify-between">
        <StepButton
          icon="remove"
          label={t('measurements.waterRemove', {
            defaultValue: 'Remove a serving',
          })}
          tint={accentPrimary}
          disabled={consumedMl <= 0}
          onPress={() => step(-1)}
        />
        <Text
          className="text-text-primary text-center"
          style={{ fontSize: 72, fontWeight: '300' }}
          numberOfLines={1}
        >
          {formatLocalizedNumber(consumedMl, { maximumFractionDigits: 0 })}
        </Text>
        <StepButton
          icon="add"
          label={t('measurements.waterAdd', { defaultValue: 'Add a serving' })}
          tint={accentPrimary}
          disabled={false}
          onPress={() => step(1)}
        />
      </View>
      <Text className="text-text-secondary text-center text-base font-semibold mt-3 uppercase">
        {t('measurements.waterUnit', { defaultValue: 'ml today' })}
      </Text>
    </NativePromptSheet>
  );
}
