import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import CustomModal, { type CustomModalRef } from './CustomModal';
import Icon from './Icon';
import WaterBottleIcon from './icons/measurements/WaterBottleIcon';
import FooterCTA from './ui/FooterCTA';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';
import { formatDottedDay } from '../utils/dateUtils';

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
      className="bg-surface rounded-full items-center justify-center"
      style={({ pressed }) => ({
        width: 64,
        height: 64,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={26} color={tint} />
    </Pressable>
  );
}

/**
 * Hydration's version of the one-measurement sheet.
 *
 * Same shape as `MeasurementRecordSheet` — full height, the mark centred over
 * its name, the action at the foot — but a pair of steppers instead of a text
 * field. Water is not typed in: it is counted in servings of whatever
 * container the user drinks from, and every other surface in the app already
 * adds it one serving at a time. Offering a millilitre box here would have
 * been a second way to record the same thing, disagreeing with the first.
 *
 * The bottle fills as you go, so the sheet answers "how am I doing" without a
 * second reading of the number.
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
  const sheetRef = useRef<CustomModalRef>(null);
  const { t } = useTranslation();
  const [accentPrimary, iconDecorative, textSecondary] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
    '--color-text-secondary',
  ]) as [string, string, string];

  const water = useWaterIntakeMutation({ date });

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const fill = goalMl > 0 ? consumedMl / goalMl : 0;
  const serving = water.servingVolume;

  const step = (direction: 1 | -1) => {
    fireSelectionHaptic();
    if (direction === 1) water.increment();
    else water.decrement();
  };

  return (
    <CustomModal
      ref={sheetRef}
      fullHeight
      background="background"
      title={formatDottedDay(date)}
      onDismiss={onClose}
    >
      <View className="flex-1 px-5">
        <View className="items-center py-4">
          <WaterBottleIcon
            size={140}
            color={iconDecorative}
            accentColor={accentPrimary}
            fill={fill}
          />
        </View>
        <Text className="text-text-primary text-3xl font-bold text-center">
          {t('measurements.water', { defaultValue: 'Water' })}
        </Text>
        <Text className="text-text-secondary text-sm mt-2 text-center">
          {goalMl > 0
            ? t('measurements.waterOfGoal', {
                defaultValue: '{{amount}} of {{goal}} ml',
                amount: formatLocalizedNumber(consumedMl, {
                  maximumFractionDigits: 0,
                }),
                goal: formatLocalizedNumber(goalMl, {
                  maximumFractionDigits: 0,
                }),
              })
            : t('measurements.waterAmount', {
                defaultValue: '{{amount}} ml',
                amount: formatLocalizedNumber(consumedMl, {
                  maximumFractionDigits: 0,
                }),
              })}
        </Text>

        <View className="flex-row items-center justify-center gap-6 mt-8">
          <StepButton
            icon="remove"
            tint={accentPrimary}
            label={t('measurements.waterRemove', {
              defaultValue: 'Remove a serving',
            })}
            // Nothing drunk is nothing to take back.
            disabled={!water.isReady || consumedMl <= 0}
            onPress={() => step(-1)}
          />
          <View className="items-center" style={{ minWidth: 110 }}>
            <Text className="text-text-primary text-2xl font-bold">
              {serving
                ? t('measurements.waterServing', {
                    defaultValue: '{{amount}} {{unit}}',
                    amount: formatLocalizedNumber(serving, {
                      maximumFractionDigits: 0,
                    }),
                    unit: water.unit ?? 'ml',
                  })
                : '—'}
            </Text>
            <Text className="text-text-muted text-xs mt-1">
              {t('measurements.waterPerTap', { defaultValue: 'per tap' })}
            </Text>
          </View>
          <StepButton
            icon="add"
            tint={accentPrimary}
            label={t('measurements.waterAdd', {
              defaultValue: 'Add a serving',
            })}
            disabled={!water.isReady}
            onPress={() => step(1)}
          />
        </View>

        {!water.isReady && water.isContainersLoaded ? (
          <Text
            className="text-text-muted text-sm text-center mt-6"
            style={{ color: textSecondary }}
          >
            {t('measurements.waterNoContainer', {
              defaultValue:
                'Set up a water container to start tracking hydration.',
            })}
          </Text>
        ) : null}
      </View>
      <FooterCTA
        // The sheet lifts for the keyboard on its own; there is no keyboard
        // here at all, but the footer stays the same object as everywhere else.
        sticky={false}
        label={t('common.done', { defaultValue: 'Done' })}
        onPress={() => sheetRef.current?.dismiss()}
      />
    </CustomModal>
  );
}
