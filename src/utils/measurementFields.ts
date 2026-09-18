import type { UpsertCheckInVars } from '../hooks/useUpsertCheckIn';
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

/**
 * The name this field goes by on `upsertCheckIn`, which is camelCase while the
 * stored column — and so this registry's `id` — is snake_case.
 *
 * Stated per field rather than derived, because the two only coincide for some
 * of them. Writing the id straight into the mutation silently dropped every
 * field where they differ: body fat, muscle mass, bone mass and body water were
 * accepted by the form and never saved, while neck and waist worked, which is
 * exactly how the bug hid.
 */
export type MeasurementApiKey = Exclude<keyof UpsertCheckInVars, 'entryDate'>;

export interface MeasurementField {
  id: MeasurementFieldId;
  /** What `upsertCheckIn` calls this field. */
  apiKey: MeasurementApiKey;
  /** Which drawn icon the tile uses. Every field has one — see MeasurementIcons. */
  kind: MeasurementKind;
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
  apiKey: MeasurementApiKey,
  kind: MeasurementKind,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  apiKey,
  kind,
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
  apiKey: MeasurementApiKey,
  kind: MeasurementKind,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  apiKey,
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
  apiKey: MeasurementApiKey,
  kind: MeasurementKind,
  label: (t: TFunction) => string
): MeasurementField => ({
  id,
  apiKey,
  kind,
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
    apiKey: 'weight',
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
  percentField(
    'body_fat_percentage',
    'bodyFatPercentage',
    'body_fat_percentage',
    (t) =>
      t('measurements.fields.bodyFatPercentage', { defaultValue: 'Body fat %' })
  ),
  {
    id: 'height',
    apiKey: 'height',
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
  lengthField('neck', 'neck', 'neck', (t) =>
    t('measurements.fields.neck', { defaultValue: 'Neck' })
  ),
  lengthField('waist', 'waist', 'waist', (t) =>
    t('measurements.fields.waist', { defaultValue: 'Waist' })
  ),
  lengthField('hips', 'hips', 'hips', (t) =>
    t('measurements.fields.hips', { defaultValue: 'Hips' })
  ),
  {
    id: 'steps',
    apiKey: 'steps',
    kind: 'steps',
    label: (t) => t('measurements.fields.steps', { defaultValue: 'Steps' }),
    unit: () => '',
    format: (value) => String(Math.round(value)),
    toInput: (value) => String(Math.round(value)),
    toStorage: (input) => Math.round(input),
    max: 200000,
    deltaUnit: () => '',
  },
  massField('muscle_mass_kg', 'muscleMassKg', 'muscle_mass', (t) =>
    t('measurements.fields.muscleMass', { defaultValue: 'Muscle mass' })
  ),
  massField('bone_mass_kg', 'boneMassKg', 'bone_mass', (t) =>
    t('measurements.fields.boneMass', { defaultValue: 'Bone mass' })
  ),
  percentField(
    'body_water_percentage',
    'bodyWaterPercentage',
    'body_water',
    (t) =>
      t('measurements.fields.bodyWaterPercentage', {
        defaultValue: 'Body water %',
      })
  ),
  {
    id: 'bmr',
    apiKey: 'bmr',
    kind: 'bmr',
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

/**
 * Fields that belong to the person rather than to a day, and so are shown on
 * the profile instead of among the check-in tiles. They are still stored on the
 * check-in — height is a measurement like any other — but nobody records their
 * height on a Tuesday the way they record their weight, and a tile for it in
 * the daily list only ever read as clutter.
 */
export const PROFILE_FIELDS: readonly MeasurementFieldId[] = ['height'];

/**
 * Fields the measurements sheet does not offer, and why.
 *
 * Height is a standing fact shown on the profile. Steps are counted by the
 * phone rather than entered by hand, and they already have a card of their own
 * on the Activities screen — offering a text box for them here invited a
 * number that would be overwritten by the next sync.
 *
 * Both keep their icons: the field is still real, still stored, and still
 * drawn wherever it is shown.
 */
export const FIELDS_OFF_THE_SHEET: readonly MeasurementFieldId[] = [
  ...PROFILE_FIELDS,
  'steps',
];
