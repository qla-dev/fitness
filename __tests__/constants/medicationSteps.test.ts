import type { TFunction } from 'i18next';
import {
  MEDICATION_SETUP_INITIAL,
  medicationFromAnswers,
  medicationSteps,
} from '../../src/constants/medicationSteps';

// Answers the English default, the way the app does without a translation.
const englishT = ((_key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? _key) as unknown as TFunction;

it('asks the name first and requires only that', () => {
  const steps = medicationSteps(englishT);
  expect(steps[0].fields[0].id).toBe('name');
  expect(steps.filter((step) => step.required).map((step) => step.id)).toEqual([
    'name',
  ]);
});

it('turns answers into a new active medication', () => {
  expect(
    medicationFromAnswers(
      {
        ...MEDICATION_SETUP_INITIAL,
        name: '  Ibuprofen ',
        strengthValue: '2,5',
        doseAmount: '1',
        reason: '',
        notes: 'With food',
      },
      englishT
    )
  ).toEqual({
    name: 'Ibuprofen',
    type_id: 'pill',
    strength_value: 2.5,
    strength_unit: 'mg',
    dose_amount: 1,
    dose_unit: 'pill',
    reason_text: null,
    prescriber: null,
    pharmacy: null,
    notes: 'With food',
    is_active: true,
  });
});

it('leaves skipped amounts empty rather than zero', () => {
  const medication = medicationFromAnswers({ name: 'Vitamin D' }, englishT);
  expect(medication.strength_value).toBeNull();
  expect(medication.dose_amount).toBeNull();
  expect(medication.type_id).toBe('pill');
  expect(medication.dose_unit).toBeNull();
});

it('counts the dose in the unit of the form picked', () => {
  const medication = medicationFromAnswers(
    { name: 'Salbutamol', type: 'inhaler', doseAmount: '2' },
    englishT
  );
  expect(medication.dose_unit).toBe('puff');
});
