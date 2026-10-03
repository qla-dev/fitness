import type { SetupAnswers } from './personalSetup';
import type { IconName } from '../components/Icon';
import type { FlashMeter, FlashStat } from '../components/ui/FlashOverlay';

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
  /**
   * Hands the question to MarkAI: the wizard writes each assist as a sentence
   * under the input whose link opens a chat with `prompt(facts)`, the facts
   * being the answers given so far as
   * "Label: value" lines. A value MarkAI proposes comes back through
   * `offerSetupAnswer` and fills the field for review.
   */
  assists?: SetupAssist[];
}

/** Stands in for an assist's link inside its translated sentence. */
export const ASSIST_LINK = '\u0000';

/**
 * One way MarkAI can answer a question. `task` marks a priced request: the
 * macro plan answers several questions at once, and works from every
 * answer, this question's included.
 */
export interface SetupAssist {
  /**
   * The whole sentence, translated as one, with `ASSIST_LINK` passed as its
   * `{{link}}` where `link` is drawn as the tappable words.
   */
  sentence: string;
  link: string;
  prompt: (facts: string[]) => string;
  /** What the chat shows for that prompt; see `calorieGoalLabel`. */
  label: string;
  task?: 'all_macros';
}
export interface SetupStep {
  id: string;
  heading: string;
  hint: string;
  fields: SetupField[];
  /**
   * Part of the first round, answered before anything optional: no Skip,
   * and Continue waits for an answer, whether or not the round was already
   * answered when the wizard opened; see `firstRound`.
   */
  required?: boolean;
}

/** What the full-screen flash shows once the first round is answered. */
export interface SetupFlash {
  /** The badge's icon; a scale by default, for the BMI. */
  icon?: IconName;
  eyebrow: string;
  value: string;
  title?: string;
  caption?: string;
  tint?: string;
  meter?: FlashMeter;
  stats?: FlashStat[];
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
  /**
   * Answers handed back from elsewhere (MarkAI), applied rather than left in
   * their question: the wizard saves them and flashes `flash`. A whole
   * macro plan `finish`es the tour — saved as done and closed, instead of
   * going on through questions it already answered; a single goal moves on
   * to the next question. Null leaves the answers in place for review.
   */
  applyOffered?: (
    offered: SetupAnswers
  ) => { flash: SetupFlash; finish: boolean } | null;
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

// An answer worked out elsewhere (MarkAI) for the open wizard, taken the
// next time the wizard is focused. Module state for the same reason as the
// session: route params cannot carry it back into a modal behind a chat.
let offeredAnswers: SetupAnswers = {};

export function offerSetupAnswer(id: string, value: string) {
  offeredAnswers = { ...offeredAnswers, [id]: value };
}

export function takeOfferedSetupAnswers(): SetupAnswers {
  const taken = offeredAnswers;
  offeredAnswers = {};
  return taken;
}
