import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TFunction } from 'i18next';
import Icon from './Icon';
import TileIconSlot from './TileIconSlot';
import { MeasurementIcons } from './icons/measurements';
import {
  MEASUREMENT_FIELDS,
  ALWAYS_SHOWN_FIELDS,
  PROFILE_FIELDS,
  DEFAULT_MEASUREMENT_UNITS,
  measurementValue,
  type MeasurementFieldId,
  type MeasurementUnits,
} from '../utils/measurementFields';
import type { MeasurementHistory } from '../hooks/useMeasurementHistory';
import type { CheckInMeasurement } from '../types/measurements';
import type { CustomMeasurementEntry } from '../types/customMeasurements';
import { isManualSource } from '../utils/customMeasurementsForm';

export type { MeasurementUnits };

/** Direction of the change against the day before. */
export type TrendDirection = 'up' | 'down' | 'flat';

export interface MeasurementTile {
  /** Stable within one build, so it can key a list. */
  id: string;
  /** Registry field, or null for a custom measurement. */
  fieldId: MeasurementFieldId | null;
  label: string;
  /** null when nothing has ever been recorded for it. */
  value: string | null;
  /** Set when the shown value is older than the selected day. */
  staleFrom: string | null;
  /**
   * Whether the selected day itself holds a value for this field. False both
   * when the tile is showing an older reading and when there is nothing at all,
   * because in each case the answer to "did I measure this today" is no.
   */
  recordedToday: boolean;
  /**
   * The day-before reading, formatted, or null when there is none. The same
   * value the trend chip measures against, so the corner note and the chip
   * can never disagree about what "previous" means.
   */
  previousValue: string | null;
  trend: { direction: TrendDirection; label: string } | null;
}

const formatCustomValue = (
  value: string,
  dataType: string | null | undefined
): string => {
  if (dataType !== 'numeric') return value;
  const trimmed = value.trim();
  if (trimmed === '') return value;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? String(numeric) : value;
};

interface BuildArgs {
  measurements: CheckInMeasurement | undefined;
  /** Per-field history for the selected day; absent until it loads. */
  history?: MeasurementHistory;
  customMeasurements?: CustomMeasurementEntry[];
  units?: Partial<MeasurementUnits>;
  t: TFunction;
  /** true for the full list behind More: every field, valued or not. */
  includeEmpty: boolean;
  /**
   * Restricts the tiles to exactly these fields, in registry order, and drops
   * the custom measurements with them. The diary summary passes the two
   * standing fields; leaving it unset keeps the full list.
   */
  restrictTo?: readonly MeasurementFieldId[];
}

export function buildMeasurementTiles({
  measurements,
  history,
  customMeasurements,
  units,
  t,
  includeEmpty,
  restrictTo,
}: BuildArgs): MeasurementTile[] {
  const resolved: MeasurementUnits = { ...DEFAULT_MEASUREMENT_UNITS, ...units };
  const tiles: MeasurementTile[] = [];

  for (const field of MEASUREMENT_FIELDS) {
    if (restrictTo) {
      if (!restrictTo.includes(field.id)) continue;
    } else if (PROFILE_FIELDS.includes(field.id)) {
      // Shown on the profile instead; see PROFILE_FIELDS.
      continue;
    }
    const today = measurementValue(measurements, field.id);
    const entry = history?.[field.id];
    // A tile shows the day's value when there is one and the last recorded
    // value otherwise: a body measurement is a standing fact, not an event, so
    // a dash on a day you did not step on the scale tells the user nothing.
    const shown = today ?? entry?.shown ?? null;
    const shownDate = today !== null ? null : (entry?.shownDate ?? null);

    if (
      shown === null &&
      !includeEmpty &&
      !ALWAYS_SHOWN_FIELDS.includes(field.id)
    ) {
      continue;
    }

    const previous = entry?.previous ?? null;
    // Flat with no number when there is nothing to compare against — the
    // straight line says "no change to report", not "no change". A tile with no
    // reading at all lands here too: leaving its corner empty made it look like
    // a tile that had not finished loading, next to siblings that had.
    let trend: MeasurementTile['trend'] = { direction: 'flat', label: '' };
    if (shown !== null) {
      if (previous === null) {
        trend = { direction: 'flat', label: '' };
      } else {
        // Compared in the unit the user reads, not the stored one: a 0.4 kg
        // move is 0.9 lbs, and rounding the stored delta would report the
        // wrong number to anyone on pounds.
        const rounded =
          Math.round(
            (Number(field.toInput(shown, resolved)) -
              Number(field.toInput(previous, resolved))) *
              10
          ) / 10;
        const unit = field.deltaUnit(resolved);
        trend =
          rounded === 0
            ? { direction: 'flat', label: '' }
            : {
                direction: rounded > 0 ? 'up' : 'down',
                label: `${Math.abs(rounded)}${unit ? ` ${unit}` : ''}`,
              };
      }
    }

    tiles.push({
      id: field.id,
      fieldId: field.id,
      label: field.label(t),
      value: shown === null ? null : field.format(shown, resolved),
      staleFrom: shown === null ? null : shownDate,
      recordedToday: today !== null,
      previousValue:
        previous === null ? null : field.format(previous, resolved),
      trend,
    });
  }

  // Diary tiles only show MANUAL custom entries (strict source contract).
  // Health-synced entries never render as editable summary tiles.
  let customIndex = 0;
  for (const entry of restrictTo ? [] : (customMeasurements ?? [])) {
    if (!isManualSource(entry.source)) continue;
    const category = entry.custom_categories;
    const suffix = category?.measurement_type
      ? ` ${category.measurement_type}`
      : '';
    tiles.push({
      id: `custom-${customIndex}`,
      fieldId: null,
      label:
        category?.display_name ??
        category?.name ??
        t('measurements.title', { defaultValue: 'Measurements' }),
      value: `${formatCustomValue(entry.value, category?.data_type)}${suffix}`,
      staleFrom: null,
      // A custom entry only exists because it was logged on this day.
      recordedToday: true,
      // Custom entries are not part of the check-in history model, so there is
      // no day-before reading to compare one against — which is exactly what
      // the flat rule reports.
      previousValue: null,
      trend: { direction: 'flat', label: '' },
    });
    customIndex += 1;
  }

  return tiles;
}

/** Placeholder for a field nothing has ever been recorded for. */
export const EMPTY_TILE_VALUE = '—';

const TrendChip: React.FC<{
  trend: NonNullable<MeasurementTile['trend']>;
  upColor: string;
  downColor: string;
  flatColor: string;
}> = ({ trend, upColor, downColor, flatColor }) => {
  if (trend.direction === 'flat') {
    // A plain rule rather than a zero: nothing to compare against reads
    // differently from "the same as yesterday", and both land here.
    return (
      <View
        style={{ width: 10, height: 2, backgroundColor: flatColor }}
        accessibilityElementsHidden
      />
    );
  }
  const up = trend.direction === 'up';
  const color = up ? upColor : downColor;
  return (
    <View className="flex-row items-center gap-0.5">
      <Icon name={up ? 'chevron-up' : 'chevron-down'} size={10} color={color} />
      <Text className="text-xs font-semibold" style={{ color }}>
        {trend.label}
      </Text>
    </View>
  );
};

export const MeasurementTileCard: React.FC<{
  tile: MeasurementTile;
  iconColor: string;
  accentColor: string;
  mutedColor: string;
  dangerColor: string;
  successColor: string;
  onPress?: () => void;
  /**
   * Inside a sheet there is no page background behind the card: the sheet
   * itself is the surface, so a surface-coloured card disappears into it and
   * the raised fill is what separates the two. No border with it — the fill
   * already does the separating, and the outline just drew a box around every
   * tile.
   */
  onSheet?: boolean;
  t: TFunction;
}> = ({
  tile,
  iconColor,
  accentColor,
  mutedColor,
  dangerColor,
  successColor,
  onPress,
  onSheet = false,
  t,
}) => {
  const DrawnIcon =
    tile.fieldId === null
      ? null
      : (MeasurementIcons[
          MEASUREMENT_FIELDS.find((f) => f.id === tile.fieldId)
            ?.kind as keyof typeof MeasurementIcons
        ] ?? null);
  const empty = tile.value === null;

  // Custom entries stand outside the check-in history model, so they are the
  // one case with nothing to say here.
  const cornerNote =
    tile.fieldId === null
      ? null
      : !tile.recordedToday
        ? t('measurements.notRecordedToday', {
            defaultValue: 'No today record',
          })
        : tile.previousValue !== null
          ? t('measurements.previousValue', {
              value: tile.previousValue,
              defaultValue: 'Previous: {{value}}',
            })
          : t('measurements.noHistory', { defaultValue: 'No history data' });

  const body = (
    <View
      className={
        onSheet
          ? 'bg-raised rounded-xl py-3 px-3'
          : 'bg-surface rounded-xl py-3 px-3'
      }
    >
      {/* Both corners of one row: the trend on the right and, on the left, how
          the shown number stands in time. Neither belongs beside the value —
          the value is the thing being read, and anything on its baseline moves
          it off centre by however wide the number happens to be.

          The left corner always says something, because an empty corner reads
          as a tile that has not finished loading. It says which of three things
          is true: the day holds no reading of its own, so the number above (if
          any) belongs to an earlier day; the day has one and there is a
          day-before reading to set it against; or the day has one and nothing
          came before it. */}
      <View
        className="flex-row items-center justify-between"
        style={{ minHeight: 16 }}
      >
        {cornerNote === null ? (
          // Holds the left of the row so the trend stays in its corner.
          <View className="flex-1" />
        ) : (
          <Text
            className="text-[10px] text-text-muted flex-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {cornerNote}
          </Text>
        )}
        {tile.trend && (
          <TrendChip
            trend={tile.trend}
            upColor={successColor}
            downColor={dangerColor}
            flatColor={mutedColor}
          />
        )}
      </View>
      <View className="flex-row items-center">
        {/* Fixed slot, not a fixed icon size: the drawn figures and the symbol
            fall-back are different families and read at different sizes, so the
            box is what is shared. */}
        <TileIconSlot>
          {DrawnIcon ? (
            <DrawnIcon size={56} color={iconColor} accentColor={accentColor} />
          ) : (
            <Icon name="chart-bar" size={32} color={accentColor} />
          )}
        </TileIconSlot>
        <View className="flex-1 ml-2 items-center">
          <Text
            className={`text-lg font-bold ${
              empty ? 'text-text-muted' : 'text-text-primary'
            }`}
            numberOfLines={1}
          >
            {tile.value ?? EMPTY_TILE_VALUE}
          </Text>
          <Text className="text-sm text-text-secondary" numberOfLines={1}>
            {tile.label}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
    >
      {body}
    </Pressable>
  );
};
