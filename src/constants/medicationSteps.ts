import type { TFunction } from 'i18next';
import type { CreateMedicationInput } from '@workspace/shared';
import type { SetupStep } from '../services/setupWizardSession';
import type { SetupAnswers } from '../services/personalSetup';
import { MEDICATION_TYPES } from '../types/medications';
import { medicationTypeLabel } from '../utils/medicationLocalization';

/**
 * Adding a medication as a questionnaire, one question a screen, in the setup
 * wizard. Only the name is required; editing an existing medication keeps the
 * full form (MedicationFormScreen).
 */
export function medicationSteps(t: TFunction): SetupStep[] {
  return [
    {
      id: 'name',
      required: true,
      heading: t('medicationSetup.nameHeading', {
        defaultValue: 'What is it called?',
      }),
      hint: t('medicationSetup.nameHint', {
        defaultValue: 'The name on the package, so you recognise it later.',
      }),
      fields: [
        {
          id: 'name',
          label: t('medications.form.nameLabel', { defaultValue: 'Name' }),
          icon: 'medication',
          placeholder: t('medicationSetup.namePlaceholder', {
            defaultValue: 'Enter the medication name',
          }),
        },
      ],
    },
    {
      id: 'type',
      heading: t('medicationSetup.typeHeading', {
        defaultValue: 'What form does it come in?',
      }),
      hint: t('medicationSetup.typeHint', {
        defaultValue: 'Pick the closest one.',
      }),
      fields: [
        {
          id: 'type',
          label: t('medications.form.type', { defaultValue: 'Type' }),
          options: MEDICATION_TYPES.map((id) => ({
            value: id,
            label: medicationTypeLabel(id, t),
          })),
        },
      ],
    },
    {
      id: 'strength',
      heading: t('medicationSetup.strengthHeading', {
        defaultValue: 'How strong is it?',
      }),
      hint: t('medicationSetup.strengthHint', {
        defaultValue: 'The amount of active ingredient, like 10 mg.',
      }),
      fields: [
        {
          id: 'strengthValue',
          label: t('medications.form.strength', { defaultValue: 'Strength' }),
          icon: 'scale',
          numeric: true,
          min: 0,
          max: 100000,
          placeholder: t('medicationSetup.strengthPlaceholder', {
            defaultValue: 'Enter the strength',
          }),
        },
        {
          id: 'strengthUnit',
          label: t('medications.form.unit', { defaultValue: 'Unit' }),
          placeholder: t('medications.form.strengthUnitPlaceholder', {
            defaultValue: 'mg',
          }),
        },
      ],
    },
    {
      id: 'dose',
      heading: t('medicationSetup.doseHeading', {
        defaultValue: 'How much do you take at a time?',
      }),
      hint: t('medicationSetup.doseHint', {
        defaultValue: 'For example 1 tablet or 5 ml.',
      }),
      fields: [
        {
          id: 'doseAmount',
          label: t('medications.form.dose', { defaultValue: 'Dose' }),
          icon: 'medication',
          numeric: true,
          min: 0,
          max: 10000,
          placeholder: t('medicationSetup.dosePlaceholder', {
            defaultValue: 'Enter the dose',
          }),
        },
        {
          id: 'doseUnit',
          label: t('medications.form.unit', { defaultValue: 'Unit' }),
          placeholder: t('medications.form.doseUnitPlaceholder', {
            defaultValue: 'tablet',
          }),
        },
      ],
    },
    {
      id: 'details',
      heading: t('medicationSetup.detailsHeading', {
        defaultValue: 'Anything else to note?',
      }),
      hint: t('medicationSetup.detailsHint', {
        defaultValue: 'All optional. You can add these later.',
      }),
      fields: [
        {
          id: 'reason',
          label: t('medications.form.reason', { defaultValue: 'Reason' }),
          icon: 'document-text',
          placeholder: t('medications.form.reasonPlaceholder', {
            defaultValue: 'Blood pressure',
          }),
        },
        {
          id: 'prescriber',
          label: t('medications.form.prescriber', {
            defaultValue: 'Prescriber',
          }),
          placeholder: t('medications.form.prescriberPlaceholder', {
            defaultValue: 'Dr. Ipsum',
          }),
        },
        {
          id: 'pharmacy',
          label: t('medications.form.pharmacy', { defaultValue: 'Pharmacy' }),
          placeholder: t('medications.form.pharmacyPlaceholder', {
            defaultValue: 'Sunny Pharmacy',
          }),
        },
        {
          id: 'notes',
          label: t('medications.form.notes', { defaultValue: 'Notes' }),
          placeholder: t('medicationSetup.notesPlaceholder', {
            defaultValue: 'Add a note',
          }),
        },
      ],
    },
  ];
}

/** Prefilled answers: the same defaults the form starts from. */
export const MEDICATION_SETUP_INITIAL: SetupAnswers = {
  type: 'pill',
  strengthUnit: 'mg',
  doseUnit: 'tablet',
};

function text(answers: SetupAnswers, id: string): string {
  const value = answers[id];
  return typeof value === 'string' ? value.trim() : '';
}

function number(answers: SetupAnswers, id: string): number | null {
  const value = text(answers, id).replace(',', '.');
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The questionnaire's answers as a new, active medication. */
export function medicationFromAnswers(
  answers: SetupAnswers
): CreateMedicationInput {
  return {
    name: text(answers, 'name'),
    type_id: text(answers, 'type') || 'pill',
    strength_value: number(answers, 'strengthValue'),
    strength_unit: text(answers, 'strengthUnit') || null,
    dose_amount: number(answers, 'doseAmount'),
    dose_unit: text(answers, 'doseUnit') || null,
    reason_text: text(answers, 'reason') || null,
    prescriber: text(answers, 'prescriber') || null,
    pharmacy: text(answers, 'pharmacy') || null,
    notes: text(answers, 'notes') || null,
    is_active: true,
  };
}
