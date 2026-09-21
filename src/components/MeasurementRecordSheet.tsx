import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import NativePromptSheet from './ui/NativePromptSheet';
import Button from './ui/Button';
import { MeasurementIcons } from './icons/measurements';
import PillInput from './ui/PillInput';
import { useUpsertCheckIn } from '../hooks/useUpsertCheckIn';
import { formatLocalizedNumber } from '../localization';
import { formatDottedDay } from '../utils/dateUtils';
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
  const { t } = useTranslation();

  const upsert = useUpsertCheckIn();
  const [accentPrimary, iconDecorative] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
  ]) as [string, string];
  const resolved: MeasurementUnits = { ...DEFAULT_MEASUREMENT_UNITS, ...units };
  const definition = useMemo(() => measurementFieldById(field), [field]);

  const [value, setValue] = useState(() =>
    current === null ? '' : definition.toInput(current, resolved)
  );

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
        // Keyed by the field's API name, which is not always its storage id
        // — see MeasurementApiKey. An emptied input clears the value rather
        // than leaving the old one: null is the check-in's explicit "no value",
        // undefined means "unchanged", and emptying a field means the former.
        [definition.apiKey]: filled
          ? definition.toStorage(parsed, resolved)
          : null,
      },
      // Closing is the caller's business now: the sheet is open for as long
      // as it is rendered, so a successful save unmounts it.
      { onSuccess: onClose }
    );
  };

  const unit = definition.unit(resolved);
  const DrawnIcon = MeasurementIcons[definition.kind];

  return (
    <NativePromptSheet
      open
      onClose={onClose}
      hasTextInput
      dismissOnBackdropPress={false}
      title={definition.label(t)}
      description={t('measurements.recordHintFor', {
        defaultValue: 'This measurement is going to be logged for {{date}}',
        date: formatDottedDay(date),
      })}
      footer={
        <Button
          onPress={save}
          disabled={invalid || upsert.isPending}
          loading={upsert.isPending}
        >
          {t('common.save', { defaultValue: 'Save' })}
        </Button>
      }
    >
      <View className="items-center mb-5">
        <DrawnIcon
          size={96}
          color={iconDecorative}
          accentColor={accentPrimary}
        />
      </View>
      <PillInput
        // Inside a sheet the input has to be the sheet's own, or the keyboard
        // covers the field it just focused.
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
    </NativePromptSheet>
  );
}
