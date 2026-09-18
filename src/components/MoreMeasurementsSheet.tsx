import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import CustomModal, { type CustomModalRef } from './CustomModal';
import {
  buildMeasurementTiles,
  MeasurementTileCard,
  type MeasurementUnits,
} from './measurementTiles';
import type { MeasurementFieldId } from '../utils/measurementFields';
import { CARD_GAP } from '../constants/layout';
import WaterTile from './WaterTile';
import { formatDottedDay } from '../utils/dateUtils';
import type { MeasurementHistory } from '../hooks/useMeasurementHistory';
import type { CheckInMeasurement } from '../types/measurements';
import type { CustomMeasurementEntry } from '../types/customMeasurements';

interface MoreMeasurementsSheetProps {
  measurements: CheckInMeasurement | undefined;
  /** The day a pick will be recorded against; named outright in the hint. */
  date: string;
  history?: MeasurementHistory;
  customMeasurements?: CustomMeasurementEntry[];
  units?: Partial<MeasurementUnits>;
  /**
   * The day's hydration. Water is not a check-in field, so it does not come out
   * of the registry with the others — but it is a measurement the user records,
   * so the full list would be lying by leaving it out.
   */
  water: { consumedMl: number; goalMl: number };
  /** Opens the full form, for the custom measurements this sheet cannot edit. */
  onOpenFullForm: () => void;
  /**
   * The owner unmounts the sheet on this, and opens the record sheet for the
   * field when one was picked. Handing the choice back rather than stacking a
   * second sheet on top of this one: two bottom sheets open together flash and
   * fight for the same gesture.
   */
  onClose: (picked: MeasurementFieldId | 'water' | null) => void;
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
  date,
  water,
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
  const pickedRef = useRef<MeasurementFieldId | 'water' | null>(null);
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

  const pick = (choice: MeasurementFieldId | 'water') => {
    pickedRef.current = choice;
    sheetRef.current?.dismiss();
  };

  // Rows of two, the same shape the diary grid uses, so the gap between the
  // columns is the one between the rows rather than whatever is left over.
  // Water leads: it is the one here that changes several times a day.
  const cells: React.ReactNode[] = [
    <WaterTile
      key="water"
      consumedMl={water.consumedMl}
      goalMl={water.goalMl}
      onPress={() => pick('water')}
    />,
    ...tiles.map((tile) => (
      <MeasurementTileCard
        key={tile.id}
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
            pick(tile.fieldId);
            return;
          }
          // Custom measurements carry their own categories and data types;
          // the full form owns them.
          sheetRef.current?.dismiss();
          onOpenFullForm();
        }}
      />
    )),
  ];
  const rows: React.ReactNode[][] = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(cells.slice(index, index + 2));
  }

  return (
    <CustomModal
      ref={sheetRef}
      // The day, not the word "Measurements": the sheet is already reached
      // from a row that says so, and which day a pick lands on is the one
      // thing the user cannot otherwise see from here.
      title={formatDottedDay(date)}
      onDismiss={() => onClose(pickedRef.current)}
    >
      <Text className="px-5 pb-3 text-sm text-text-secondary">
        {t('measurements.pickInvitation', {
          defaultValue: 'Please pick what you would like to record and track.',
        })}
      </Text>
      {/* No scrollable here, by design: the sheet sizes itself to its content
          and a scrollable never reports a content height to it, so whatever
          flex gave it became the sheet's height — a fixed box with the list cut
          off inside. The ring calendar has always been plain views inside this
          same modal for exactly this reason, and this is now the same.

          Which means the list has to fit, and the registry is a fixed set of
          ten that does. Manual custom measurements are the one thing that can
          push past it — two of them still fit a tall phone, four will not, and
          the sheet clips rather than scrolls. Worth a cap here if anyone starts
          logging a lot of them. */}
      <View className="px-4 pb-2" style={{ gap: CARD_GAP }}>
        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            className="flex-row"
            style={{ gap: CARD_GAP }}
          >
            {row.map((cell, cellIndex) => (
              <View key={`cell-${cellIndex}`} className="flex-1">
                {cell}
              </View>
            ))}
            {/* An odd last row keeps its tile at half width. */}
            {row.length === 1 && <View className="flex-1" />}
          </View>
        ))}
      </View>
    </CustomModal>
  );
}
