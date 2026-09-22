import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import PromptScreen from '../components/ui/PromptScreen';
import { MeasurementIcons } from '../components/icons/measurements';
import PillInput from '../components/ui/PillInput';
import { useUpsertCheckIn } from '../hooks/useUpsertCheckIn';
import { formatLocalizedNumber } from '../localization';
import { formatDottedDay } from '../utils/dateUtils';
import {
  measurementFieldById,
  DEFAULT_MEASUREMENT_UNITS,
  type MeasurementUnits,
} from '../utils/measurementFields';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * One measurement, one input — the setup wizard's question step, reached by
 * tapping a tile instead of walking a flow. The full form exists for the day
 * you sit down and record everything; this is for the far commoner case of
 * changing the one number you actually stepped on the scale for.
 */
export default function MeasurementEditScreen({
  navigation,
  route,
}: RootStackScreenProps<'MeasurementEdit'>) {
  const { field, date, current, units } = route.params;
  const { t } = useTranslation();

  const upsert = useUpsertCheckIn();
  const [accentPrimary, iconDecorative] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
  ]) as [string, string];
  const resolved: MeasurementUnits = { ...DEFAULT_MEASUREMENT_UNITS, ...units };
  const definition = useMemo(() => measurementFieldById(field), [field]);

  const [value, setValue] = useState(() =>
    current === null || current === undefined
      ? ''
      : definition.toInput(current, resolved)
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
      { onSuccess: () => navigation.goBack() }
    );
  };

  const unit = definition.unit(resolved);
  const DrawnIcon = MeasurementIcons[definition.kind];

  return (
    <PromptScreen
      hasTextInput
      headerTitle={t('measurements.title', { defaultValue: 'Measurements' })}
      title={definition.label(t)}
      description={t('measurements.recordHintFor', {
        defaultValue: 'This measurement is going to be logged for {{date}}',
        date: formatDottedDay(date),
      })}
      footerLabel={t('common.save', { defaultValue: 'Save' })}
      onFooterPress={save}
      footerDisabled={invalid || upsert.isPending}
      footerLoading={upsert.isPending}
    >
      <View className="items-center mb-5">
        <DrawnIcon
          size={96}
          color={iconDecorative}
          accentColor={accentPrimary}
        />
      </View>
      <PillInput
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
    </PromptScreen>
  );
}
