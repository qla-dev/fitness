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

export interface SetupWizardSession {
  steps: SetupStep[];
  initial: SetupAnswers;
  onSave: (answers: SetupAnswers, done: boolean) => Promise<void>;
  onClose: () => void;
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
