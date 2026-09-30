import type { TFunction } from 'i18next';

/**
 * The message that asks MarkAI to work out a daily calorie goal, from the
 * facts the asking screen knows ("Age: 30 years old"). Written in the app's
 * language, as the user would type it; MarkAI answers with its calculation
 * and a goal the user can apply.
 */
export function calorieGoalPrompt(t: TFunction, facts: string[]): string {
  const ask = t('markai.goalPrompt.calories', {
    defaultValue:
      'Work out my daily calorie goal from my details below. Show the calculation, then propose one daily calorie goal I can apply.',
  });
  return facts.length
    ? `${ask}\n\n${facts.map((fact) => `- ${fact}`).join('\n')}`
    : ask;
}
