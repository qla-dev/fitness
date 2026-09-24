import type { SetupAnswers } from './personalSetup';
import type { IconName } from '../components/Icon';

export interface SetupField {
  id: string;
  label: string;
  /** Icon shown before the field's label. */
  icon?: IconName;
  options?: { value: string; label: string; icon?: IconName }[];
  multiple?: boolean;
  numeric?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Suffix inside the input, e.g. "kg"; may depend on other answers. */
  unit?: string | ((answers: SetupAnswers) => string | undefined);
  /**
   * Suggested value shown as the placeholder instead of the min–max range.
   * Only a hint: nothing is saved unless the user types it.
   */
  suggestion?: number | ((answers: SetupAnswers) => number | undefined);
  /**
   * What the empty input says, written as an instruction ("Enter your target
   * weight"). A bare number there read as a value already filled in.
   */
  placeholder?: string;
  showWhen?: (answers: SetupAnswers) => boolean;
}
export interface SetupStep {
  id: string;
  heading: string;
  hint: string;
  fields: SetupField[];
}

/**
 * An answer as a list of selected values. Single-choice answers saved before a
 * question became multiple-choice are plain strings, so both shapes count.
 */
export function answerValues(answers: SetupAnswers, id: string): string[] {
  const value = answers[id];
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? [value] : [];
}

/** The fields of a step that apply given the answers so far. */
export function visibleFields(step: SetupStep, answers: SetupAnswers) {
  return step.fields.filter(
    (field) => !field.showWhen || field.showWhen(answers)
  );
}

/**
 * True when every question that applies has an answer. A skipped question
 * counts as unanswered, so the startup protocol keeps offering the wizard.
 */
export function isSetupComplete(steps: SetupStep[], answers: SetupAnswers) {
  return steps.every((step) =>
    visibleFields(step, answers).every((field) =>
      answerValues(answers, field.id).some((value) => value.trim() !== '')
    )
  );
}

export interface SetupWizardSession {
  steps: SetupStep[];
  initial: SetupAnswers;
  onSave: (answers: SetupAnswers, done: boolean) => Promise<void>;
  onClose: () => void;
  /**
   * Opens on this one step and saves from it: the footer reads Save, Back
   * closes, and there is no Skip. For editing a single answer from wherever
   * it is shown — the Age tile on the Profile — without the rest of the tour.
   */
  singleStep?: string;
}

// Route params must stay serializable, so the opener parks its callbacks here
// before navigating to `SetupWizard` (same handoff as mealBuilderSelection).
let activeSession: SetupWizardSession | null = null;

export function openSetupWizardSession(session: SetupWizardSession) {
  activeSession = session;
}

export function getSetupWizardSession() {
  return activeSession;
}

export function isSetupWizardOpen() {
  return activeSession !== null;
}

export function clearSetupWizardSession(session: SetupWizardSession | null) {
  if (activeSession === session) activeSession = null;
}
