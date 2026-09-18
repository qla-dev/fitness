import { buildMeasurementTiles } from '../../src/components/measurementTiles';
import type { MeasurementHistory } from '../../src/hooks/useMeasurementHistory';

const t = ((key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? key) as unknown as Parameters<
  typeof buildMeasurementTiles
>[0]['t'];

const history = (
  partial: Partial<
    Record<string, { shown: number | null; shownDate: string | null; previous: number | null }>
  >
): MeasurementHistory =>
  ({
    weight: { shown: null, shownDate: null, previous: null },
    body_fat_percentage: { shown: null, shownDate: null, previous: null },
    height: { shown: null, shownDate: null, previous: null },
    neck: { shown: null, shownDate: null, previous: null },
    waist: { shown: null, shownDate: null, previous: null },
    hips: { shown: null, shownDate: null, previous: null },
    steps: { shown: null, shownDate: null, previous: null },
    muscle_mass_kg: { shown: null, shownDate: null, previous: null },
    bone_mass_kg: { shown: null, shownDate: null, previous: null },
    body_water_percentage: { shown: null, shownDate: null, previous: null },
    bmr: { shown: null, shownDate: null, previous: null },
    ...partial,
  }) as MeasurementHistory;

const tileById = (
  tiles: ReturnType<typeof buildMeasurementTiles>,
  id: string
) => tiles.find((tile) => tile.id === id);

test('weight and body fat stand even on a day with nothing recorded', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    t,
    includeEmpty: false,
  });

  expect(tiles.map((tile) => tile.id)).toEqual([
    'weight',
    'body_fat_percentage',
  ]);
  expect(tiles.every((tile) => tile.value === null)).toBe(true);
});

// A body measurement is a standing fact, not an event: a dash on a day you did
// not step on the scale tells the user nothing they did not know.
test('falls back to the last recorded value and says which day it is not', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18' },
    history: history({
      weight: { shown: 81, shownDate: '2026-09-12', previous: null },
    }),
    t,
    includeEmpty: false,
  });

  const weight = tileById(tiles, 'weight');
  expect(weight?.value).toBe('81 kg');
  expect(weight?.staleFrom).toBe('2026-09-12');
});

test("the day's own value is never marked stale", () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    history: history({
      weight: { shown: 80, shownDate: '2026-09-18', previous: 78 },
    }),
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.staleFrom).toBeNull();
});

test('a heavier day than yesterday trends up by the difference', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    history: history({
      weight: { shown: 80, shownDate: '2026-09-18', previous: 78 },
    }),
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.trend).toEqual({
    direction: 'up',
    label: '2 kg',
  });
});

test('a lighter day than yesterday trends down', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 78 },
    history: history({
      weight: { shown: 78, shownDate: '2026-09-18', previous: 80 },
    }),
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.trend).toEqual({
    direction: 'down',
    label: '2 kg',
  });
});

// Nothing to compare against and no change both draw the flat rule: the chip
// says "no movement to report", which covers either.
test('no value yesterday leaves a flat trend with no number', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    history: history({
      weight: { shown: 80, shownDate: '2026-09-18', previous: null },
    }),
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.trend).toEqual({
    direction: 'flat',
    label: '',
  });
});

// The delta is read in the user's unit: 1 kg is 2.2 lbs, and rounding the
// stored difference would print the wrong number to anyone on pounds.
test('the difference is reported in the unit the user reads', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 81 },
    history: history({
      weight: { shown: 81, shownDate: '2026-09-18', previous: 80 },
    }),
    units: { weightMode: 'lbs' },
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.trend).toEqual({
    direction: 'up',
    label: '2.2 lbs',
  });
});

test('the full list carries every field except the two kept off it', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    t,
    includeEmpty: true,
  });

  expect(tiles).toHaveLength(9);
  expect(tileById(tiles, 'bmr')?.value).toBeNull();
  expect(tileById(tiles, 'weight')?.value).toBe('80 kg');
  // Steps are counted by the phone and already have their own Activities
  // card, so the sheet does not offer a box to type one into.
  expect(tileById(tiles, 'steps')).toBeUndefined();
  // Height is a standing fact about the person, so it is shown on the profile
  // rather than among the measurements recorded day by day.
  expect(tileById(tiles, 'height')).toBeUndefined();
});

test('restrictTo takes exactly the fields named, and no custom entries', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80, steps: 9000 },
    customMeasurements: [
      {
        id: 'e1',
        category_id: 'c1',
        value: '120',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          id: 'c1',
          name: 'Blood Pressure',
          measurement_type: 'mmHg',
          frequency: 'Daily',
        },
      },
    ] as Parameters<typeof buildMeasurementTiles>[0]['customMeasurements'],
    t,
    includeEmpty: false,
    restrictTo: ['weight', 'body_fat_percentage'],
  });

  expect(tiles.map((tile) => tile.id)).toEqual([
    'weight',
    'body_fat_percentage',
  ]);
  // A value recorded that day is still not a reason to add a tile: the diary
  // card has to be the same height every day.
  expect(tileById(tiles, 'steps')).toBeUndefined();
});

test('restrictTo can name a profile field the daily list leaves out', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', height: 180 },
    t,
    includeEmpty: true,
    restrictTo: ['height'],
  });

  expect(tiles).toHaveLength(1);
  expect(tileById(tiles, 'height')?.value).toBe('180 cm');
});

test('recordedToday separates a value from today, an older one, and none', () => {
  const today = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    t,
    includeEmpty: false,
  });
  expect(tileById(today, 'weight')?.recordedToday).toBe(true);

  const older = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18' },
    history: history({
      weight: { shown: 80, shownDate: '2026-09-10', previous: null },
    }),
    t,
    includeEmpty: false,
  });
  expect(tileById(older, 'weight')?.recordedToday).toBe(false);
  expect(tileById(older, 'weight')?.value).toBe('80 kg');

  // Nothing ever recorded still answers "did I measure this today" with no,
  // which is what the tile says out loud.
  const never = buildMeasurementTiles({
    measurements: undefined,
    t,
    includeEmpty: false,
  });
  expect(tileById(never, 'body_fat_percentage')?.recordedToday).toBe(false);
  expect(tileById(never, 'body_fat_percentage')?.value).toBeNull();
});

test('custom entries keep manual-only filtering and exact numeric text', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    customMeasurements: [
      {
        id: 'manual',
        category_id: 'c1',
        value: '1.23456789',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          name: 'Glucose',
          display_name: null,
          measurement_type: 'mg/dL',
          frequency: 'Daily',
          data_type: 'numeric',
        },
      },
      {
        id: 'blank',
        category_id: 'c2',
        value: '   ',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          name: 'Blank',
          display_name: null,
          measurement_type: 'm',
          frequency: 'Daily',
          data_type: 'numeric',
        },
      },
      {
        id: 'synced',
        category_id: 'c3',
        value: '75',
        entry_date: '2026-09-18',
        source: 'healthkit',
        custom_categories: {
          name: 'Resting Heart Rate',
          measurement_type: 'bpm',
          frequency: 'Daily',
        },
      },
    ] as Parameters<typeof buildMeasurementTiles>[0]['customMeasurements'],
    t,
    includeEmpty: false,
  });

  const custom = tiles.filter((tile) => tile.fieldId === null);
  expect(custom.map((tile) => tile.label)).toEqual(['Glucose', 'Blank']);
  // Precision is preserved, and whitespace never becomes a zero.
  expect(custom[0]?.value).toBe('1.23456789 mg/dL');
  expect(custom[1]?.value).toBe('    m');
});

test('custom measurements carry no field id, so they route to the full form', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    customMeasurements: [
      {
        id: 'e1',
        category_id: 'c1',
        value: '120',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          id: 'c1',
          name: 'Blood Pressure',
          measurement_type: 'mmHg',
          frequency: 'Daily',
        },
      },
    ] as Parameters<typeof buildMeasurementTiles>[0]['customMeasurements'],
    t,
    includeEmpty: false,
  });

  const custom = tiles.find((tile) => tile.fieldId === null);
  expect(custom?.label).toBe('Blood Pressure');
  expect(custom?.value).toBe('120 mmHg');
});

test('a real zero and a boolean false are values, not blanks', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    customMeasurements: [
      {
        id: 'zero',
        category_id: 'c1',
        value: '0',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          name: 'Zero',
          measurement_type: '',
          frequency: 'Daily',
          data_type: 'numeric',
        },
      },
      {
        id: 'flag',
        category_id: 'c2',
        value: 'false',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          name: 'Flag',
          measurement_type: '',
          frequency: 'Daily',
          data_type: 'boolean',
        },
      },
    ] as Parameters<typeof buildMeasurementTiles>[0]['customMeasurements'],
    t,
    includeEmpty: false,
  });

  const custom = tiles.filter((tile) => tile.fieldId === null);
  expect(custom.map((tile) => tile.value)).toEqual(['0', 'false']);
});

test('previousValue carries the day-before reading the trend is measured against', () => {
  const tiles = buildMeasurementTiles({
    measurements: { entry_date: '2026-09-18', weight: 80 },
    history: history({
      weight: { shown: 80, shownDate: '2026-09-18', previous: 79 },
    }),
    t,
    includeEmpty: false,
  });

  expect(tileById(tiles, 'weight')?.previousValue).toBe('79 kg');
  // Nothing before it: the corner has to say so rather than show a blank.
  expect(tileById(tiles, 'body_fat_percentage')?.previousValue).toBeNull();
});

test('custom entries stand outside the history model', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    customMeasurements: [
      {
        id: 'e1',
        category_id: 'c1',
        value: '120',
        entry_date: '2026-09-18',
        source: 'manual',
        custom_categories: {
          id: 'c1',
          name: 'Blood Pressure',
          measurement_type: 'mmHg',
          frequency: 'Daily',
        },
      },
    ] as Parameters<typeof buildMeasurementTiles>[0]['customMeasurements'],
    t,
    includeEmpty: false,
  });

  const custom = tiles.find((tile) => tile.fieldId === null);
  expect(custom?.previousValue).toBeNull();
  expect(custom?.recordedToday).toBe(true);
});

test('a tile with no reading still reports the flat rule', () => {
  const tiles = buildMeasurementTiles({
    measurements: undefined,
    t,
    includeEmpty: false,
  });

  // An empty corner read as a tile that had not finished loading, beside
  // siblings that had; the rule says "no change to report" instead.
  expect(tileById(tiles, 'body_fat_percentage')?.value).toBeNull();
  expect(tileById(tiles, 'body_fat_percentage')?.trend).toEqual({
    direction: 'flat',
    label: '',
  });
});
