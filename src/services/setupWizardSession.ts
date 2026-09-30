import type { SetupAnswers } from './personalSetup';
import type { IconName } from '../components/Icon';

export type SetupOption = { value: string; label: string; icon?: IconName };

export interface SetupField {
  id: string;
  label: string;
  /** Icon shown before the field's label. */
  icon?: IconName;
  options?: SetupOption[];
  /**
   * Options that depend on other answers — the stores of the region picked
   * a step earlier. Resolved into `options` by `visibleFields`.
   */
  optionsFor?: (answers: SetupAnswers) => SetupOption[];
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
  /**
   * Part of the first round, answered before anything optional: no Skip,
   * and Continue waits for an answer. Only while that round was not
   * already complete when the wizard opened; see `firstRound`.
   */
  required?: boolean;
}

/** What the full-screen flash shows once the first round is answered. */
export interface SetupFlash {
  eyebrow: string;
  value: string;
  title?: string;
  caption?: string;
  tint?: string;
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

/**
 * The fields of a step that apply given the answers so far, with options
 * that depend on those answers resolved.
 */
export function visibleFields(step: SetupStep, answers: SetupAnswers) {
  return step.fields
    .filter((field) => !field.showWhen || field.showWhen(answers))
    .map((field) =>
      field.optionsFor
        ? { ...field, options: field.optionsFor(answers) }
        : field
    );
}

/**
 * True when every applicable question is answered or explicitly skipped.
 * Dismissing the wizard does not mark untouched questions as skipped.
 */
export function isSetupComplete(steps: SetupStep[], answers: SetupAnswers) {
  return steps.every((step) =>
    visibleFields(step, answers).every(
      (field) =>
        answerValues(answers, '__skipped').includes(field.id) ||
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
  /**
   * A result worked out from the required steps. When they were not all
   * answered on opening, the last one's action reads `label`, and its
   * answer is followed by a flash of `flash(answers)` before the tour goes on.
   */
  firstRound?: {
    label: string;
    flash: (answers: SetupAnswers) => SetupFlash | null;
  };
}

/** True when every visible field of the required steps has an answer. */
export function isFirstRoundAnswered(
  steps: SetupStep[],
  answers: SetupAnswers
) {
  return steps
    .filter((step) => step.required)
    .every((step) =>
      visibleFields(step, answers).every((field) =>
        answerValues(answers, field.id).some((value) => value.trim() !== '')
      )
    );
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
