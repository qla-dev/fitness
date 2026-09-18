import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import MoreMeasurementsSheet from './MoreMeasurementsSheet';
import MeasurementRecordSheet from './MeasurementRecordSheet';
import {
  buildMeasurementTiles,
  MeasurementTileCard,
  type MeasurementUnits,
} from './measurementTiles';
import {
  measurementValue,
  ALWAYS_SHOWN_FIELDS,
  type MeasurementFieldId,
} from '../utils/measurementFields';
import type { MeasurementHistory } from '../hooks/useMeasurementHistory';
import type { CheckInMeasurement } from '../types/measurements';
import type { CustomMeasurementEntry } from '../types/customMeasurements';

interface MeasurementsSummaryProps extends Partial<MeasurementUnits> {
  measurements: CheckInMeasurement | undefined;
  /** Per-field history for the day: last recorded value and yesterday's. */
  history?: MeasurementHistory;
  /** The day the tiles belong to; what a record sheet writes against. */
  date: string;
  onPress?: () => void;
  customMeasurements?: CustomMeasurementEntry[];
}

const MeasurementsSummary: React.FC<MeasurementsSummaryProps> = ({
  measurements,
  history,
  date,
  weightMode = 'kg',
  bodyUnit = 'cm',
  heightMode = 'cm',
  onPress,
  customMeasurements,
}) => {
  const [accentPrimary, iconColor, mutedColor, dangerColor, successColor] =
    useCSSVariable([
      '--color-accent-primary',
      '--color-icon-decorative',
      '--color-text-muted',
      '--color-icon-danger',
      '--color-icon-success',
    ]) as [string, string, string, string, string];

  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [recording, setRecording] = useState<MeasurementFieldId | null>(null);

  const units = useMemo(
    () => ({ weightMode, bodyUnit, heightMode }),
    [weightMode, bodyUnit, heightMode]
  );

  // Weight and body fat, and nothing else — not the fields that happen to hold
  // a value today, and not the custom entries either. This card sits above the
  // meal list, so its height has to be the same every day; letting it grow with
  // whatever was logged pushed the meals down by an amount that changed daily.
  // Everything it leaves out is one tap away behind More.
  const tiles = useMemo(
    () =>
      buildMeasurementTiles({
        measurements,
        history,
        units,
        t,
        includeEmpty: false,
        restrictTo: ALWAYS_SHOWN_FIELDS,
      }),
    [measurements, history, units, t]
  );

  // The header sits outside the tiles: a More button nested inside a pressable
  // that opens the logging form is two targets in one, and the inner one is
  // three millimetres from the edge of the outer.
  const header = (
    <View className="flex-row items-center gap-2 mb-2 px-1">
      <Text className="text-base font-bold text-text-secondary flex-1">
        {t('measurements.title', { defaultValue: 'Measurements' })}
      </Text>
      <Pressable
        onPress={() => setMoreOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('measurements.more', { defaultValue: 'More' })}
        hitSlop={8}
        className="flex-row items-center gap-1"
      >
        <Text className="text-sm font-semibold text-accent-primary">
          {t('measurements.more', { defaultValue: 'More' })}
        </Text>
        <Icon name="chevron-forward" size={12} color={accentPrimary} />
      </Pressable>
    </View>
  );

  return (
    <View className="mb-2" testID="measurements-summary">
      {header}
      <View className="flex-row flex-wrap justify-between">
        {tiles.map((tile) => (
          <View key={tile.id} className="w-[48%] mb-2">
            <MeasurementTileCard
              tile={tile}
              iconColor={iconColor}
              accentColor={accentPrimary}
              mutedColor={mutedColor}
              dangerColor={dangerColor}
              successColor={successColor}
              t={t}
              onPress={() =>
                tile.fieldId ? setRecording(tile.fieldId) : onPress?.()
              }
            />
          </View>
        ))}
      </View>
      {moreOpen && (
        <MoreMeasurementsSheet
          measurements={measurements}
          history={history}
          customMeasurements={customMeasurements}
          units={units}
          onOpenFullForm={() => onPress?.()}
          // The record sheet opens only once this one has finished closing:
          // two bottom sheets on screen together flash and share a gesture.
          onClose={(picked) => {
            setMoreOpen(false);
            if (picked) setRecording(picked);
          }}
        />
      )}
      {recording && (
        <MeasurementRecordSheet
          field={recording}
          date={date}
          current={measurementValue(measurements, recording)}
          units={units}
          onClose={() => setRecording(null)}
        />
      )}
    </View>
  );
};

export default MeasurementsSummary;
