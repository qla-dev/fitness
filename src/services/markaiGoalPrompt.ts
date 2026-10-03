import type { TFunction } from 'i18next';

/**
 * The message that asks MarkAI to work out a daily calorie goal, from the
 * facts the asking screen knows ('Age: 30 years old'). Written in the app's
 * language, as the user would type it; MarkAI answers with its calculation
 * and a goal the user can apply.
 */
export function calorieGoalPrompt(t: TFunction, facts: string[]): string {
  return withFacts(
    t('markai.goalPrompt.calories', {
      defaultValue:
        'Work out my daily calorie goal from my details below. Show the calculation, then propose one daily calorie goal I can apply.',
    }),
    facts
  );
}

/** The same, for a daily protein goal in grams. */
export function proteinGoalPrompt(t: TFunction, facts: string[]): string {
  return withFacts(
    t('markai.goalPrompt.protein', {
      defaultValue:
        'Work out my daily protein goal in grams from my details below. Show the calculation, then propose one daily protein goal I can apply.',
    }),
    facts
  );
}

/**
 * The paid macro plan: calories first, then protein, carbs and fat from
 * them. A calorie goal already among the facts is worked from, not replaced
 * without reason.
 */
export function macroPlanPrompt(t: TFunction, facts: string[]): string {
  return withFacts(
    t('markai.goalPrompt.macros', {
      defaultValue:
        'Calculate all my daily macros from my details below: calories, protein, carbs and fat. If I already gave a calorie goal, work from it. Show the calculation step by step.',
    }),
    facts
  );
}

/**
 * What the chat shows in place of the prompts above. The user did not write
 * those, and reading their own details back to them as a wall of text is
 * noise; the facts still reach the model.
 */
export const calorieGoalLabel = (t: TFunction): string =>
  t('markai.goalLabel.calories', {
    defaultValue: 'Work out my ideal calorie intake',
  });

export const proteinGoalLabel = (t: TFunction): string =>
  t('markai.goalLabel.protein', {
    defaultValue: 'Work out my ideal protein intake',
  });

export const macroPlanLabel = (t: TFunction): string =>
  t('markai.goalLabel.macros', { defaultValue: 'Work out all my macros' });

const withFacts = (ask: string, facts: string[]) =>
  facts.length
    ? `${ask}\n\n${facts.map((fact) => `- ${fact}`).join('\n')}`
    : ask;
