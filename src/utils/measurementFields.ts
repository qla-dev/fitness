import type { TFunction } from 'i18next';
import type { CheckInMeasurement } from '../types/measurements';
import type { MeasurementKind } from '../components/icons/measurements';
import {
  formatWeightDisplay,
  weightFromKg,
  weightToKg,
  lengthFromCm,
  lengthToCm,
  cmToFeetInches,
} from './unitConversions';

/**
 * Every measurement the check-in holds, in one registry: the tiles, the trend
 * against yesterday and the single-field record sheet all read from here, so a
 * field added to the check-in surfaces everywhere at once instead of being
 * hand-copied into three lists.
 */
export type MeasurementFieldId =
  | 'weight'
  | 'body_fat_percentage'
  | 'height'
  | 'neck'
  | 'waist'
  | 'hips'
  | 'steps'
  | 'muscle_mass_kg'
  | 'bone_mass_kg'
  | 'body_water_percentage'
  | 'bmr';

export interface MeasurementUnits {
  weightMode: 'kg' | 'lbs' | 'st_lbs';
  bodyUnit: 'cm' | 'inches';
  heightMode: 'cm' | 'inches' | 'ft_in';
}

export const DEFAULT_MEASUREMENT_UNITS: MeasurementUnits = {
  weightMode: 'kg',
  bodyUnit: 'cm',
  heightMode: 'cm',
};

export interface MeasurementField {
  id: MeasurementFieldId;
  /** Which drawn icon to use; ids without one fall back to a generic glyph. */
  kind: MeasurementKind | 'other';
  label: (t: TFunction) => string;
  /** Unit shown beside the input and after the value. */
  unit: (units: MeasurementUnits) => string;
  /** Storage value → what the user reads. */
  format: (value: number, units: MeasurementUnits) => string;
  /** Storage value → what the input starts with (plain number, no unit). */
  toInput: (value: number, units: MeasurementUnits) => string;
  /** What the user typed → what the check-in stores. */
  toStorage: (input: number, units: MeasurementUnits) => number;
  /** Sanity ceiling for the input, in the unit the user is typing in. */
  max: number;
  /** Difference the trend chip reports, in the user's unit. */
  deltaUnit: (units: MeasurementUnits) => string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const asNumber = (value: number) => String(round1(value));

const massUnit = (units: MeasurementUnits) =>
  units.weightMode === 'kg' ? 'kg' : 'lbs';

const lengthUnit = (units: MeasurementUnits) =>
  units.bodyUnit === 'cm' ? 'cm' : 'in';

/**
 * Mass fields other than body weight follow the weight preference, except
 * st/lbs: stones is a body-weight convention, not a unit anyone reads a bone
 * mass in, so those fall back to pounds.
 */
const massFormat = (kg: number, units: MeasurementUnits) =>
  units.weightMode === 'kg'
    ? `${asNumber(kg)} kg`
    : `${asNumber(weightFromKg(kg, 'lbs'))} lbs`;

const massInput = (kg: number, units: MeasurementUnits) =>
  units.weightMode === 'kg' ? asNumber(kg) : asNumber(weightFromKg(kg, 'lbs'));

const massStorage = (input: number, units: MeasurementUnits) =>
  units.weightMode === 'kg' ? input : weightToKg(input, 'lbs');

const percentField = (
  id: MeasurementFieldId,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  kind: id === 'body_fat_percentage' ? 'body_fat_percentage' : 'other',
  label,
  unit: () => '%',
  format: (value) => `${asNumber(value)}%`,
  toInput: (value) => asNumber(value),
  toStorage: (input) => input,
  max: 100,
  deltaUnit: () => '%',
});

const lengthField = (
  id: MeasurementFieldId,
  kind: MeasurementKind,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  kind,
  label,
  unit: lengthUnit,
  format: (value, units) =>
    `${asNumber(lengthFromCm(value, units.bodyUnit))} ${lengthUnit(units)}`,
  toInput: (value, units) => asNumber(lengthFromCm(value, units.bodyUnit)),
  toStorage: (input, units) => lengthToCm(input, units.bodyUnit),
  max: 300,
  deltaUnit: lengthUnit,
});

const massField = (
  id: MeasurementFieldId,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  kind: 'other',
  label,
  unit: massUnit,
  format: massFormat,
  toInput: massInput,
  toStorage: massStorage,
  max: 500,
  deltaUnit: massUnit,
});

export const MEASUREMENT_FIELDS: MeasurementField[] = [
  {
    id: 'weight',
    kind: 'weight',
    label: (t) => t('measurements.fields.weight', { defaultValue: 'Weight' }),
    // st/lbs reads as a compound value, but it is typed as one number: a
    // second input for stones belongs in the full form, not a one-field sheet.
    unit: (units) => (units.weightMode === 'kg' ? 'kg' : 'lbs'),
    format: (value, units) => formatWeightDisplay(value, units.weightMode),
    toInput: (value, units) =>
      units.weightMode === 'kg'
        ? asNumber(value)
        : asNumber(weightFromKg(value, 'lbs')),
    toStorage: (input, units) =>
      units.weightMode === 'kg' ? input : weightToKg(input, 'lbs'),
    max: 1000,
    deltaUnit: (units) => (units.weightMode === 'kg' ? 'kg' : 'lbs'),
  },
  percentField('body_fat_percentage', (t) =>
    t('measurements.fields.bodyFatPercentage', { defaultValue: 'Body fat %' })
  ),
  {
    id: 'height',
    kind: 'height',
    label: (t) => t('measurements.fields.height', { defaultValue: 'Height' }),
    // ft_in is two numbers in the full form; here the single input is inches.
    unit: (units) => (units.heightMode === 'cm' ? 'cm' : 'in'),
    format: (value, units) => {
      if (units.heightMode === 'ft_in') {
        const { feet, inches } = cmToFeetInches(value);
        return `${feet}'${asNumber(inches)}"`;
      }
      return `${asNumber(lengthFromCm(value, units.heightMode))} ${
        units.heightMode === 'cm' ? 'cm' : 'in'
      }`;
    },
    toInput: (value, units) =>
      units.heightMode === 'cm'
        ? asNumber(value)
        : asNumber(lengthFromCm(value, 'inches')),
    toStorage: (input, units) =>
      units.heightMode === 'cm' ? input : lengthToCm(input, 'inches'),
    max: 300,
    deltaUnit: (units) => (units.heightMode === 'cm' ? 'cm' : 'in'),
  },
  lengthField('neck', 'neck', (t) =>
    t('measurements.fields.neck', { defaultValue: 'Neck' })
  ),
  lengthField('waist', 'waist', (t) =>
    t('measurements.fields.waist', { defaultValue: 'Waist' })
  ),
  lengthField('hips', 'hips', (t) =>
    t('measurements.fields.hips', { defaultValue: 'Hips' })
  ),
  {
    id: 'steps',
    kind: 'steps',
    label: (t) => t('measurements.fields.steps', { defaultValue: 'Steps' }),
    unit: () => '',
    format: (value) => String(Math.round(value)),
    toInput: (value) => String(Math.round(value)),
    toStorage: (input) => Math.round(input),
    max: 200000,
    deltaUnit: () => '',
  },
  massField('muscle_mass_kg', (t) =>
    t('measurements.fields.muscleMass', { defaultValue: 'Muscle mass' })
  ),
  massField('bone_mass_kg', (t) =>
    t('measurements.fields.boneMass', { defaultValue: 'Bone mass' })
  ),
  percentField('body_water_percentage', (t) =>
    t('measurements.fields.bodyWaterPercentage', {
      defaultValue: 'Body water %',
    })
  ),
  {
    id: 'bmr',
    kind: 'other',
    label: (t) => t('measurements.fields.bmr', { defaultValue: 'BMR' }),
    unit: () => 'kcal',
    format: (value) => `${Math.round(value)} kcal`,
    toInput: (value) => String(Math.round(value)),
    toStorage: (input) => Math.round(input),
    max: 20000,
    deltaUnit: () => 'kcal',
  },
];

export const measurementFieldById = (
  id: MeasurementFieldId
): MeasurementField => {
  const field = MEASUREMENT_FIELDS.find((entry) => entry.id === id);
  // Total by construction: the id type is the registry's own key set.
  if (!field) throw new Error(`Unknown measurement field: ${id}`);
  return field;
};

/** The stored value for a field, or null when that day has none. */
export const measurementValue = (
  measurements: CheckInMeasurement | undefined,
  id: MeasurementFieldId
): number | null => {
  const value = measurements?.[id];
  return typeof value === 'number' ? value : null;
};

/**
 * The two the diary always shows, in this order, whether or not the day has
 * them: the day you have not weighed yourself is exactly the day the prompt is
 * worth something.
 */
export const ALWAYS_SHOWN_FIELDS: readonly MeasurementFieldId[] = [
  'weight',
  'body_fat_percentage',
];
