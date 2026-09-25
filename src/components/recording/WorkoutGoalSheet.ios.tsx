import {
  BottomSheet,
  Button,
  HStack,
  Host,
  Picker,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  padding,
  pickerStyle,
  presentationDetents,
  presentationDragIndicator,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../../localization';
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
  const unit =
    kind === 'distance'
      ? distanceUnit === 'miles'
        ? t('workoutSetup.milesUnit', { defaultValue: 'MI' })
        : t('workoutSetup.kmUnit', { defaultValue: 'KM' })
      : t('workoutSetup.kcalUnit', { defaultValue: 'KCAL' });
  const options = (count: number, step: number, first = 0) =>
    Array.from({ length: count }, (_, index) => {
      const number = (index + first) * step;
      return (
        <Text key={index} modifiers={[tag(number)]}>
          {formatLocalizedNumber(number, { maximumFractionDigits: 1 })}
        </Text>
      );
    });
  return (
    <Host style={{ position: 'absolute', width: 1, height: 1 }}>
      <BottomSheet
        isPresented={open}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <VStack
          spacing={18}
          modifiers={[
            padding({ all: 24 }),
            presentationDetents(['medium', 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          <Text modifiers={[font({ size: 24, weight: 'bold' })]}>{title}</Text>
          {kind === 'time' ? (
            <HStack>
              <Picker
                label={t('workoutSetup.hours', { defaultValue: 'Hours' })}
                selection={Math.floor(value / 60)}
                onSelectionChange={(hours: number) =>
                  onChange(
                    Math.max(1, Math.min(600, hours * 60 + (value % 60)))
                  )
                }
                modifiers={[pickerStyle('wheel')]}
              >
                {options(11, 1)}
              </Picker>
              <Text>{t('workoutSetup.hoursUnit', { defaultValue: 'h' })}</Text>
              <Picker
                label={t('workoutSetup.minutes', { defaultValue: 'Minutes' })}
                selection={value % 60}
                onSelectionChange={(minutes: number) =>
                  onChange(
                    Math.max(
                      1,
                      Math.min(600, Math.floor(value / 60) * 60 + minutes)
                    )
                  )
                }
                modifiers={[pickerStyle('wheel')]}
              >
                {options(60, 1)}
              </Picker>
              <Text>
                {t('workoutSetup.minutesUnit', { defaultValue: 'MIN' })}
              </Text>
            </HStack>
          ) : kind === 'distance' ? (
            <HStack>
              <Picker
                label={title}
                selection={Math.floor(value)}
                onSelectionChange={(whole: number) =>
                  onChange(
                    Math.max(
                      0.1,
                      Math.min(500, whole + Math.round((value % 1) * 10) / 10)
                    )
                  )
                }
                modifiers={[pickerStyle('wheel')]}
              >
                {options(501, 1)}
              </Picker>
              <Text>
                {formatLocalizedNumber(1.1).replace(/\p{Number}/gu, '')}
              </Text>
              <Picker
                label={t('workoutSetup.decimal', { defaultValue: 'Decimal' })}
                selection={Math.round((value % 1) * 10)}
                onSelectionChange={(fraction: number) =>
                  onChange(
                    Math.max(
                      0.1,
                      Math.min(500, Math.floor(value) + fraction / 10)
                    )
                  )
                }
                modifiers={[pickerStyle('wheel')]}
              >
                {options(10, 1)}
              </Picker>
              <Text>{unit}</Text>
            </HStack>
          ) : (
            <HStack>
              <Picker
                label={title}
                selection={value}
                onSelectionChange={onChange}
                modifiers={[pickerStyle('wheel')]}
              >
                {options(200, 25, 1)}
              </Picker>
              <Text>{unit}</Text>
            </HStack>
          )}
          <Button
            label={t('common.done', { defaultValue: 'Done' })}
            onPress={onClose}
            modifiers={[buttonStyle('borderedProminent')]}
          />
        </VStack>
      </BottomSheet>
    </Host>
  );
}
