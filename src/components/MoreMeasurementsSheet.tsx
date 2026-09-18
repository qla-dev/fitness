import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import CustomModal, { type CustomModalRef } from './CustomModal';
import {
  buildMeasurementTiles,
  MeasurementTileCard,
  type MeasurementUnits,
} from './measurementTiles';
import type { MeasurementFieldId } from '../utils/measurementFields';
import type { MeasurementHistory } from '../hooks/useMeasurementHistory';
import type { CheckInMeasurement } from '../types/measurements';
import type { CustomMeasurementEntry } from '../types/customMeasurements';

interface MoreMeasurementsSheetProps {
  measurements: CheckInMeasurement | undefined;
  history?: MeasurementHistory;
  customMeasurements?: CustomMeasurementEntry[];
  units?: Partial<MeasurementUnits>;
  /** Opens the full form, for the custom measurements this sheet cannot edit. */
  onOpenFullForm: () => void;
  /**
   * The owner unmounts the sheet on this, and opens the record sheet for the
   * field when one was picked. Handing the choice back rather than stacking a
   * second sheet on top of this one: two bottom sheets open together flash and
   * fight for the same gesture.
   */
  onClose: (picked: MeasurementFieldId | null) => void;
}

/**
 * Every measurement the check-in can hold, as cards — the two the diary shows
 * first, then the rest, then whatever custom measurements were logged by hand.
 * The diary card is deliberately short, since it sits above a long meal list,
 * so this is where the full picture lives; a field with nothing recorded still
 * gets a card, because seeing the gap is the point.
 *
 * There is no footer action: the list itself is the action. Tapping a card
 * records that one measurement, which is what a footer "log everything" button
 * would have made the user go the long way round for.
 *
 * Mounted only while open, and it presents itself: the summary renders on every
 * diary day, and a sheet that mounted with it would build the bottom-sheet
 * modal and its backdrop on every one of them for a tap most days never get.
 */
export default function MoreMeasurementsSheet({
  measurements,
  history,
  customMeasurements,
  units,
  onOpenFullForm,
  onClose,
}: MoreMeasurementsSheetProps) {
  const sheetRef = useRef<CustomModalRef>(null);
  const { t } = useTranslation();
  // Read on the way out, in onDismiss: the pick has to survive the close
  // animation, and state set during it would re-render a sheet that is leaving.
  const pickedRef = useRef<MeasurementFieldId | null>(null);
  const [accentPrimary, iconColor, mutedColor, dangerColor, successColor] =
    useCSSVariable([
      '--color-accent-primary',
      '--color-icon-decorative',
      '--color-text-muted',
      '--color-icon-danger',
      '--color-icon-success',
    ]) as [string, string, string, string, string];

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const tiles = useMemo(
    () =>
      buildMeasurementTiles({
        measurements,
        history,
        customMeasurements,
        units,
        t,
        includeEmpty: true,
      }),
    [measurements, history, customMeasurements, units, t]
  );

  return (
    <CustomModal
      ref={sheetRef}
      title={t('measurements.title', { defaultValue: 'Measurements' })}
      onDismiss={() => onClose(pickedRef.current)}
    >
      <Text className="px-5 pb-3 text-sm text-text-secondary">
        {t('measurements.pickToRecord', {
          defaultValue: 'Tap a measurement to record it.',
        })}
      </Text>
      {/* BottomSheetScrollView, not the plain one: the sheet sizes itself to
          its content, and an RN ScrollView inside that measures as a collapsed
          box — the sheet flashed open and settled on nothing. */}
      <BottomSheetScrollView
        style={{ maxHeight: 440 }}
        contentContainerClassName="px-4 pb-2"
      >
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
                onSheet
                t={t}
                onPress={() => {
                  if (tile.fieldId) {
                    pickedRef.current = tile.fieldId;
                    sheetRef.current?.dismiss();
                    return;
                  }
                  // Custom measurements carry their own categories and data
                  // types; the full form owns them.
                  sheetRef.current?.dismiss();
                  onOpenFullForm();
                }}
              />
            </View>
          ))}
        </View>
      </BottomSheetScrollView>
    </CustomModal>
  );
}
