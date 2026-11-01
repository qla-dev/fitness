import type { TFunction } from 'i18next';
import type {
  CreateMedicationInput,
  CreateScheduleInput,
} from '@workspace/shared';
import type { SetupStep } from '../services/setupWizardSession';
import type { SetupAnswers } from '../services/personalSetup';
import type { IconName } from '../components/Icon';
import { MEDICATION_TYPES, type MedicationTypeId } from '../types/medications';
import { medicationTypeLabel } from '../utils/medicationLocalization';
import { fetchMedicationSuggestions } from '../services/online/medicationSuggestions';
import { takeMedicationScheduleDraft } from '../services/medicationScheduleDraft';
import { localizedDescribeSchedule } from '../utils/medicationScheduleLocalization';

/** Each medication form's glyph: the form picker's, and the Tracker card's. */
const MEDICATION_TYPE_ICONS: Record<MedicationTypeId, IconName> = {
  pill: 'med-pill',
  tablet: 'med-tablet',
  capsule: 'med-capsule',
  liquid: 'med-liquid',
  injection: 'med-injection',
  patch: 'med-patch',
  inhaler: 'med-inhaler',
  drops: 'med-drops',
  nasal_spray: 'med-nasal-spray',
  cream: 'med-cream',
  suppository: 'med-suppository',
  other: 'med-other',
};

/** A saved medication's glyph, from its form; the generic pills otherwise. */
export const medicationTypeIcon = (typeId: string | null): IconName =>
  MEDICATION_TYPE_ICONS[typeId as MedicationTypeId] ?? 'medication';

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
          // A pick fills the name and, when the catalogue says how it is
          // taken, the form on the next step.
          suggest: async (query, signal) =>
            (await fetchMedicationSuggestions(query, signal)).map((match) => ({
              label: match.label,
              value: match.name,
              answers: match.type ? { type: match.type } : undefined,
            })),
          suggestSource: t('medicationSetup.suggestSource', {
            defaultValue:
              'Suggestions from the U.S. National Library of Medicine',
          }),
        },
      ],
    },
    {
      id: 'type',
      heading: t('medicationSetup.typeHeading', {
        defaultValue: 'What form is it?',
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
            icon: MEDICATION_TYPE_ICONS[id],
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
      // The amount and its unit are one answer, so they share a row.
      row: true,
      fields: [
        {
          id: 'strengthValue',
          flex: 2,
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
        defaultValue: 'How much per dose?',
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
          // The unit follows from the form picked a step earlier, so it is a
          // suffix here rather than a second question.
          unit: (answers) => doseUnitFor(t, text(answers, 'type')),
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
    {
      // Set on the schedule form itself, opened as a draft: the medication
      // does not exist yet, so the schedule comes back here and is created
      // with it. Skippable; a medication without one is logged as needed.
      id: 'schedule',
      heading: t('medicationSetup.scheduleHeading', {
        defaultValue: 'When do you take it?',
      }),
      hint: t('medicationSetup.scheduleHint', {
        defaultValue:
          'Set a schedule for reminders, or skip to log doses as needed.',
      }),
      fields: [],
      action: {
        label: t('medicationSetup.adjustSchedule', {
          defaultValue: 'Adjust schedule',
        }),
        open: (navigation, answers) =>
          navigation.navigate('MedicationScheduleForm', {
            doseUnit: doseUnitFor(t, text(answers, 'type') || 'pill'),
          }),
        take: () => {
          const schedule = takeMedicationScheduleDraft();
          return schedule ? { schedule: JSON.stringify(schedule) } : null;
        },
        summary: (answers) => {
          const schedule = scheduleFromAnswers(answers);
          return schedule ? localizedDescribeSchedule(t, schedule) : undefined;
        },
      },
    },
  ];
}

/** The schedule set on the questionnaire's last step, if one was. */
export function scheduleFromAnswers(
  answers: SetupAnswers
): CreateScheduleInput | null {
  const raw = text(answers, 'schedule');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CreateScheduleInput;
  } catch {
    return null;
  }
}

/** Prefilled answers: the same defaults the form starts from. */
export const MEDICATION_SETUP_INITIAL: SetupAnswers = {
  type: 'pill',
  strengthUnit: 'mg',
};

/**
 * What one dose of each form is counted in. Saved as the dose unit, the way a
 * typed unit was, so it is written in the user's language.
 */
export function doseUnitFor(t: TFunction, type: string): string | undefined {
  switch (type) {
    case 'pill':
      return t('medicationSetup.doseUnit.pill', { defaultValue: 'pill' });
    case 'tablet':
      return t('medicationSetup.doseUnit.tablet', { defaultValue: 'tablet' });
    case 'capsule':
      return t('medicationSetup.doseUnit.capsule', {
        defaultValue: 'capsule',
      });
    case 'liquid':
    case 'injection':
      return t('medicationSetup.doseUnit.ml', { defaultValue: 'ml' });
    case 'patch':
      return t('medicationSetup.doseUnit.patch', { defaultValue: 'patch' });
    case 'inhaler':
      return t('medicationSetup.doseUnit.puff', { defaultValue: 'puff' });
    case 'drops':
      return t('medicationSetup.doseUnit.drop', { defaultValue: 'drop' });
    case 'nasal_spray':
      return t('medicationSetup.doseUnit.spray', { defaultValue: 'spray' });
    case 'cream':
      return t('medicationSetup.doseUnit.application', {
        defaultValue: 'application',
      });
    case 'suppository':
      return t('medicationSetup.doseUnit.suppository', {
        defaultValue: 'suppository',
      });
    default:
      return undefined;
  }
}

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
  answers: SetupAnswers,
  t: TFunction
): CreateMedicationInput {
  const doseAmount = number(answers, 'doseAmount');
  return {
    name: text(answers, 'name'),
    type_id: text(answers, 'type') || 'pill',
    strength_value: number(answers, 'strengthValue'),
    strength_unit: text(answers, 'strengthUnit') || null,
    dose_amount: doseAmount,
    dose_unit:
      doseAmount === null
        ? null
        : (doseUnitFor(t, text(answers, 'type') || 'pill') ?? null),
    reason_text: text(answers, 'reason') || null,
    prescriber: text(answers, 'prescriber') || null,
    pharmacy: text(answers, 'pharmacy') || null,
    notes: text(answers, 'notes') || null,
    is_active: true,
  };
}
