import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import CustomModal, { type CustomModalRef } from './CustomModal';
import PillInput from './ui/PillInput';
import Button from './ui/Button';
import { useUpsertCheckIn } from '../hooks/useUpsertCheckIn';
import { formatLocalizedNumber } from '../localization';
import {
  measurementFieldById,
  DEFAULT_MEASUREMENT_UNITS,
  type MeasurementFieldId,
  type MeasurementUnits,
} from '../utils/measurementFields';

interface MeasurementRecordSheetProps {
  field: MeasurementFieldId;
  /** The day being recorded — the diary's selected date, not always today. */
  date: string;
  /** Stored value for this field on that day, if any. */
  current: number | null;
  units?: Partial<MeasurementUnits>;
  onClose: () => void;
}

/**
 * One measurement, one input — the setup wizard's question step, reached by
 * tapping a tile instead of walking a flow. The full form exists for the day
 * you sit down and record everything; this is for the far commoner case of
 * changing the one number you actually stepped on the scale for.
 *
 * Mounted only while open and presents itself, so the tiles behind it cost
 * nothing until one is tapped.
 */
export default function MeasurementRecordSheet({
  field,
  date,
  current,
  units,
  onClose,
}: MeasurementRecordSheetProps) {
  const sheetRef = useRef<CustomModalRef>(null);
  const { t } = useTranslation();
  const upsert = useUpsertCheckIn();
  const resolved: MeasurementUnits = { ...DEFAULT_MEASUREMENT_UNITS, ...units };
  const definition = useMemo(() => measurementFieldById(field), [field]);

  const [value, setValue] = useState(() =>
    current === null ? '' : definition.toInput(current, resolved)
  );

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const parsed = Number(value.replace(',', '.'));
  const filled = value.trim() !== '';
  const invalid =
    filled &&
    (!Number.isFinite(parsed) || parsed < 0 || parsed > definition.max);

  const save = () => {
    if (invalid) return;
    upsert.mutate(
      {
        entryDate: date,
        // An emptied input clears the value rather than leaving the old one:
        // null is the check-in's explicit "no value", undefined means
        // "unchanged", and the user emptying a field means the former.
        [definition.id]: filled
          ? definition.toStorage(parsed, resolved)
          : null,
      },
      { onSuccess: () => sheetRef.current?.dismiss() }
    );
  };

  const unit = definition.unit(resolved);

  return (
    <CustomModal
      ref={sheetRef}
      title={definition.label(t)}
      onDismiss={onClose}
    >
      <View className="px-5 pb-2">
        <Text className="text-text-secondary text-sm mb-3">
          {t('measurements.recordHint', {
            defaultValue: 'Saved against the day you are looking at.',
          })}
        </Text>
        <PillInput
          // Inside a sheet the input has to be the sheet's own, or the
          // keyboard covers the field it just focused.
          InputComponent={BottomSheetTextInput}
          autoFocus
          accessibilityLabel={definition.label(t)}
          value={value}
          onChangeText={setValue}
          unit={unit}
          reserveErrorSpace
          error={
            invalid
              ? t('measurements.recordRange', {
                  defaultValue: 'Enter a number up to {{max}}.',
                  max: formatLocalizedNumber(definition.max),
                })
              : undefined
          }
          keyboardType="decimal-pad"
          maxLength={8}
          editable={!upsert.isPending}
          onSubmitEditing={save}
        />
        <Button
          onPress={save}
          disabled={invalid || upsert.isPending}
          loading={upsert.isPending}
        >
          {t('common.save', { defaultValue: 'Save' })}
        </Button>
      </View>
    </CustomModal>
  );
}
