import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { CARD_GAP } from '../constants/layout';
import { useCSSVariable } from 'uniwind';
import MoreMeasurementsSheet from './MoreMeasurementsSheet';
import type { RootStackParamList } from '../types/navigation';
import TileMenu from './TileMenu';
import {
  buildMeasurementTiles,
  MeasurementTileCard,
  type MeasurementUnits,
} from './measurementTiles';
import {
  measurementValue,
  type MeasurementFieldId,
} from '../utils/measurementFields';

import type { MeasurementHistory } from '../hooks/useMeasurementHistory';
import type { CheckInMeasurement } from '../types/measurements';
import type { CustomMeasurementEntry } from '../types/customMeasurements';
/**
 * What the tracker grid draws from the measurement registry. The rest of its
 * four tiles are supplied by the screen: hydration, then the night.
 */
const TRACKER_GRID_FIELDS: readonly MeasurementFieldId[] = ['weight'];

interface MeasurementsSummaryProps extends Partial<MeasurementUnits> {
  measurements: CheckInMeasurement | undefined;
  /** Per-field history for the day: last recorded value and yesterday's. */
  history?: MeasurementHistory;
  /** The day the tiles belong to; what a record sheet writes against. */
  date: string;
  onPress?: () => void;
  customMeasurements?: CustomMeasurementEntry[];
  /**
   * Tiles that flow into the same grid after the measurements — the day's wake
   * and bedtime. Rendered here rather than as cards of their own above and
   * below the meal list, because they answer the same question the weight tile
   * does ("what did my body do today") and reading them meant scrolling past
   * everything in between. The caller supplies them already rendered, so this
   * component keeps knowing nothing about sleep; it only owns the grid.
   */
  trailingTiles?: React.ReactNode[];
  /**
   * The day's hydration, for the full list behind More. The grid's own water
   * tile comes in through `trailingTiles`, but the sheet builds its own cards
   * and needs the figures directly.
   */
  water: { consumedMl: number; goalMl: number };
  /**
   * Opens the hydration sheet. Water is not a check-in field, so it cannot go
   * through `MeasurementEdit` with the rest — the screen owns that one.
   */
  onOpenWater: () => void;
  /**
   * The full list is opened from the screen's own header, so its open state is
   * the screen's to hold. This component still owns the sheet itself, because
   * the sheet hands a picked field straight to the record sheet beside it and
   * only one of the two may be on screen at a time.
   */
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
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
  trailingTiles,
  water,
  onOpenWater,
  moreOpen = false,
  onMoreOpenChange,
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const units = useMemo(
    () => ({ weightMode, bodyUnit, heightMode }),
    [weightMode, bodyUnit, heightMode]
  );

  // A modal route rather than a sheet: only a route's header items are the
  // system's own buttons.
  const record = (field: MeasurementFieldId) =>
    navigation.navigate('MeasurementEdit', {
      field,
      date,
      current: measurementValue(measurements, field),
      units,
    });

  // Weight alone from the registry. Body fat moved behind More: the grid holds
  // four tiles, and hydration earns one of them more than a number most people
  // record once a month does. This card sits above the meal list, so its height
  // has to be the same every day — letting it grow with whatever was logged
  // pushed the meals down by an amount that changed daily.
  const tiles = useMemo(
    () =>
      buildMeasurementTiles({
        measurements,
        history,
        units,
        t,
        includeEmpty: false,
        restrictTo: TRACKER_GRID_FIELDS,
      }),
    [measurements, history, units, t]
  );

  // Laid out as explicit rows of two rather than a wrapping grid: a wrapped
  // row sets its columns with `justify-between`, which makes the horizontal gap
  // whatever is left over — near enough to the vertical one to look like a
  // mistake, never equal to it. Two flexed children and one gap are exact.
  const cells: React.ReactNode[] = [
    ...tiles.map((tile) => {
      const card = (
        <MeasurementTileCard
          key={tile.id}
          tile={tile}
          iconColor={iconColor}
          accentColor={accentPrimary}
          mutedColor={mutedColor}
          dangerColor={dangerColor}
          successColor={successColor}
          t={t}
          onPress={() => (tile.fieldId ? record(tile.fieldId) : onPress?.())}
        />
      );
      // Weight holds the way water does: a tap records, a hold offers the
      // goal and the history behind the number.
      if (tile.fieldId !== 'weight') return card;
      return (
        <TileMenu
          key={tile.id}
          actions={[
            {
              id: 'goal',
              title: t('measurements.weightChangeGoal', {
                defaultValue: 'Change goal',
              }),
              image: 'target',
              onSelect: () =>
                navigation.navigate('GoalEdit', { goalKey: 'target_weight' }),
            },
            {
              id: 'history',
              title: t('measurements.weightHistory', {
                defaultValue: 'History',
              }),
              image: 'chart.line.uptrend.xyaxis',
              onSelect: () =>
                navigation.navigate('GoalDetail', { metric: 'weight', date }),
            },
          ]}
        >
          {card}
        </TileMenu>
      );
    }),
    ...(trailingTiles ?? []),
  ];
  const rows: React.ReactNode[][] = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(cells.slice(index, index + 2));
  }

  return (
    <View testID="measurements-summary" style={{ gap: CARD_GAP }}>
      {/* No heading: the screen's own title already names what this is, and a
          second one directly under it only repeated the word. */}
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
          {/* An odd last row keeps its tile at half width rather than letting
              it stretch across the screen. */}
          {row.length === 1 && <View className="flex-1" />}
        </View>
      ))}
      {moreOpen && (
        <MoreMeasurementsSheet
          measurements={measurements}
          date={date}
          water={water}
          history={history}
          customMeasurements={customMeasurements}
          units={units}
          onOpenFullForm={() => onPress?.()}
          // The record sheet opens only once this one has finished closing:
          // two bottom sheets on screen together flash and share a gesture.
          onClose={(picked) => {
            onMoreOpenChange?.(false);
            if (picked === 'water') onOpenWater();
            else if (picked) record(picked);
          }}
        />
      )}
    </View>
  );
};

export default MeasurementsSummary;
