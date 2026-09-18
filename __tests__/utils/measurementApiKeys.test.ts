import { MEASUREMENT_FIELDS } from '../../src/utils/measurementFields';

/**
 * The record sheet writes `{ [field.apiKey]: value }` straight into
 * `upsertCheckIn`, whose parameters are camelCase while the stored columns —
 * and so the registry's ids — are snake_case.
 *
 * Writing the id instead was accepted by the form and silently dropped by the
 * mutation for every field where the two differ. Body fat, muscle mass, bone
 * mass and body water never saved; neck, waist and weight did, because their
 * id and parameter happen to be the same word. The type stops an apiKey that
 * is not a parameter at all; this stops one pointing at the wrong parameter.
 */
describe('measurement field API keys', () => {
  const expected: Record<string, string> = {
    weight: 'weight',
    body_fat_percentage: 'bodyFatPercentage',
    height: 'height',
    neck: 'neck',
    waist: 'waist',
    hips: 'hips',
    steps: 'steps',
    muscle_mass_kg: 'muscleMassKg',
    bone_mass_kg: 'boneMassKg',
    body_water_percentage: 'bodyWaterPercentage',
    bmr: 'bmr',
  };

  test('every field maps to the parameter that actually stores it', () => {
    const actual = Object.fromEntries(
      MEASUREMENT_FIELDS.map((field) => [field.id, field.apiKey])
    );
    expect(actual).toEqual(expected);
  });

  test('the registry covers every field the check-in accepts', () => {
    expect(MEASUREMENT_FIELDS).toHaveLength(Object.keys(expected).length);
  });
});
