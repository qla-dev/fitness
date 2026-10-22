import i18n from 'i18next';
import {
  MEDICATION_SETUP_INITIAL,
  medicationFromAnswers,
  medicationSteps,
} from '../../src/constants/medicationSteps';

it('asks the name first and requires only that', () => {
  const steps = medicationSteps(i18n.t.bind(i18n));
  expect(steps[0].fields[0].id).toBe('name');
  expect(steps.filter((step) => step.required).map((step) => step.id)).toEqual([
    'name',
  ]);
});

it('turns answers into a new active medication', () => {
  expect(
    medicationFromAnswers({
      ...MEDICATION_SETUP_INITIAL,
      name: '  Ibuprofen ',
      strengthValue: '2,5',
      doseAmount: '1',
      reason: '',
      notes: 'With food',
    })
  ).toEqual({
    name: 'Ibuprofen',
    type_id: 'pill',
    strength_value: 2.5,
    strength_unit: 'mg',
    dose_amount: 1,
    dose_unit: 'tablet',
    reason_text: null,
    prescriber: null,
    pharmacy: null,
    notes: 'With food',
    is_active: true,
  });
});

it('leaves skipped amounts empty rather than zero', () => {
  const medication = medicationFromAnswers({ name: 'Vitamin D' });
  expect(medication.strength_value).toBeNull();
  expect(medication.dose_amount).toBeNull();
  expect(medication.type_id).toBe('pill');
});
