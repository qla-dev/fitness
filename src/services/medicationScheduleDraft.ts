import type { CreateScheduleInput } from '@workspace/shared';

/**
 * A schedule set up before its medication exists, from the add-medication
 * questionnaire. The schedule form leaves it here on Save instead of saving
 * it; the questionnaire takes it when it regains focus, and the schedule is
 * created with the medication.
 */
let pending: CreateScheduleInput | null = null;

export function offerMedicationScheduleDraft(schedule: CreateScheduleInput) {
  pending = schedule;
}

/** The schedule waiting to be picked up, once. */
export function takeMedicationScheduleDraft(): CreateScheduleInput | null {
  const schedule = pending;
  pending = null;
  return schedule;
}
