import type { TFunction } from 'i18next';
import type { SetupStep } from '../components/SetupWizard';
import type { SetupAnswers } from '../services/personalSetup';

export function profileSteps(
  t: TFunction,
  existing: SetupAnswers
): SetupStep[] {
  const steps: SetupStep[] = [
    {
      id: 'focus',
      heading: t('setup.focusHeading', {
        defaultValue: 'Make room for your goals',
      }),
      hint: t('setup.focusHint', {
        defaultValue:
          'Start with what matters to you. Every question is optional.',
      }),
      fields: [
        {
          id: 'focus',
          label: t('setup.focus', { defaultValue: 'Your focus' }),
          options: [
            {
              value: 'lose',
              label: t('setup.lose', { defaultValue: 'Lose weight' }),
            },
            {
              value: 'maintain',
              label: t('setup.maintain', { defaultValue: 'Maintain weight' }),
            },
            {
              value: 'muscle',
              label: t('setup.muscle', { defaultValue: 'Build muscle' }),
            },
            {
              value: 'fitness',
              label: t('setup.fitness', { defaultValue: 'Improve fitness' }),
            },
            {
              value: 'track',
              label: t('setup.track', { defaultValue: 'Just track' }),
            },
          ],
        },
      ],
    },
    {
      id: 'body',
      heading: t('setup.bodyHeading', { defaultValue: 'A little about you' }),
      hint: t('setup.bodyHint', {
        defaultValue:
          'We keep details you already entered. These measurements use kilograms and centimetres.',
      }),
      fields: [
        {
          id: 'age',
          label: t('setup.age', { defaultValue: 'Age (years, 13–120)' }),
          numeric: true,
          min: 13,
          max: 120,
          integer: true,
        },
        {
          id: 'height',
          label: t('setup.height', { defaultValue: 'Height (cm, 50–250)' }),
          numeric: true,
          min: 50,
          max: 250,
        },
        {
          id: 'weight',
          label: t('setup.weight', {
            defaultValue: 'Current weight (kg, 20–400)',
          }),
          numeric: true,
          min: 20,
          max: 400,
        },
      ].filter((field) => !existing[field.id]),
    },
    {
      id: 'activity',
      heading: t('setup.activityHeading', {
        defaultValue: 'What does your day look like?',
      }),
      hint: t('setup.activityHint', {
        defaultValue: 'Think about your usual routine outside workouts.',
      }),
      fields: [
        {
          id: 'activity',
          label: t('setup.activity', { defaultValue: 'Daily activity' }),
          options: [
            {
              value: 'sitting',
              label: t('setup.sitting', { defaultValue: 'Mostly sitting' }),
            },
            {
              value: 'walking',
              label: t('setup.walking', { defaultValue: 'Some walking' }),
            },
            {
              value: 'moving',
              label: t('setup.moving', { defaultValue: 'Often moving' }),
            },
            {
              value: 'physical',
              label: t('setup.physical', {
                defaultValue: 'Physically demanding',
              }),
            },
          ],
        },
      ],
    },
    {
      id: 'target',
      heading: t('setup.targetHeading', {
        defaultValue: 'Your next milestone',
      }),
      hint: t('setup.targetHint', {
        defaultValue:
          'Choose a target that matters to you, or leave it for later. No deadline required.',
      }),
      fields: [
        {
          id: 'targetWeight',
          label: t('setup.targetWeight', {
            defaultValue: 'Target weight (kg, 20–400)',
          }),
          numeric: true,
          min: 20,
          max: 400,
          showWhen: (a) =>
            ['lose', 'maintain', 'muscle'].includes(String(a.focus)),
        },
        {
          id: 'sessions',
          label: t('setup.sessions', {
            defaultValue: 'Training days per week (0–7)',
          }),
          numeric: true,
          min: 0,
          max: 7,
          integer: true,
          showWhen: (a) => a.focus !== 'track',
        },
      ],
    },
    ...[
      {
        id: 'steps',
        label: t('setup.steps', { defaultValue: 'Daily steps (0–100,000)' }),
        max: 100000,
      },
      {
        id: 'water_goal_ml',
        label: t('setup.water', { defaultValue: 'Daily water (ml, 0–10,000)' }),
        max: 10000,
      },
      {
        id: 'sleep',
        label: t('setup.sleep', { defaultValue: 'Sleep goal (hours, 0–24)' }),
        max: 24,
      },
      {
        id: 'calories',
        label: t('setup.calories', {
          defaultValue: 'Daily calorie goal (kcal, 1–10,000)',
        }),
        min: 1,
        max: 10000,
      },
      {
        id: 'protein',
        label: t('setup.protein', {
          defaultValue: 'Daily protein goal (g, 0–500)',
        }),
        max: 500,
      },
    ].map((field) => ({
      id: field.id,
      heading: field.label,
      hint: t('setup.goalHint', {
        defaultValue:
          'Set your own goal or skip this one. You can edit goals later in Profile.',
      }),
      fields: [{ ...field, numeric: true }],
    })),
  ];
  return steps.filter((step) => step.fields.length > 0);
}

export function grocerySteps(t: TFunction): SetupStep[] {
  return [
    {
      id: 'household',
      heading: t('groceries.householdHeading', {
        defaultValue: 'A week that fits your table',
      }),
      hint: t('groceries.householdHint', {
        defaultValue:
          'We will plan one main meal per day. Breakfast and snacks can be added to your list.',
      }),
      fields: [
        {
          id: 'servings',
          label: t('groceries.servings', {
            defaultValue: 'People / servings (1–12)',
          }),
          numeric: true,
          integer: true,
          min: 1,
          max: 12,
        },
        {
          id: 'days',
          label: t('groceries.days', { defaultValue: 'Days to plan (1–7)' }),
          numeric: true,
          integer: true,
          min: 1,
          max: 7,
        },
      ],
    },
    {
      id: 'diet',
      heading: t('groceries.dietHeading', { defaultValue: 'Eat your way' }),
      hint: t('groceries.dietHint', {
        defaultValue:
          'Choose an eating style and ingredients you would rather leave out.',
      }),
      fields: [
        {
          id: 'diet',
          label: t('groceries.diet', { defaultValue: 'Eating style' }),
          options: [
            {
              value: 'any',
              label: t('groceries.any', { defaultValue: 'No preference' }),
            },
            {
              value: 'vegetarian',
              label: t('groceries.vegetarian', { defaultValue: 'Vegetarian' }),
            },
            {
              value: 'vegan',
              label: t('groceries.vegan', { defaultValue: 'Vegan' }),
            },
            {
              value: 'pescatarian',
              label: t('groceries.pescatarian', {
                defaultValue: 'Pescatarian',
              }),
            },
          ],
        },
        {
          id: 'dislikes',
          label: t('groceries.dislikes', {
            defaultValue: 'Disliked ingredients (separate with commas)',
          }),
        },
      ],
    },
    {
      id: 'allergies',
      heading: t('groceries.allergiesHeading', {
        defaultValue: 'Anything we should leave out?',
      }),
      hint: t('groceries.allergiesHint', {
        defaultValue:
          'Allergies are different from dislikes. Skipping leaves this unknown. Always check ingredient labels.',
      }),
      fields: [
        {
          id: 'allergies',
          label: t('groceries.allergies', {
            defaultValue: 'Allergies and restrictions',
          }),
          multiple: true,
          options: [
            {
              value: 'none',
              label: t('groceries.none', { defaultValue: 'None' }),
            },
            {
              value: 'milk',
              label: t('groceries.milk', { defaultValue: 'Milk' }),
            },
            {
              value: 'eggs',
              label: t('groceries.eggs', { defaultValue: 'Eggs' }),
            },
            {
              value: 'peanuts',
              label: t('groceries.peanuts', { defaultValue: 'Peanuts' }),
            },
            {
              value: 'nuts',
              label: t('groceries.nuts', { defaultValue: 'Tree nuts' }),
            },
            {
              value: 'soy',
              label: t('groceries.soy', { defaultValue: 'Soy' }),
            },
            {
              value: 'gluten',
              label: t('groceries.gluten', { defaultValue: 'Wheat / gluten' }),
            },
            {
              value: 'fish',
              label: t('groceries.fish', { defaultValue: 'Fish' }),
            },
            {
              value: 'shellfish',
              label: t('groceries.shellfish', { defaultValue: 'Shellfish' }),
            },
            {
              value: 'sesame',
              label: t('groceries.sesame', { defaultValue: 'Sesame' }),
            },
          ],
        },
        {
          id: 'otherAllergies',
          label: t('groceries.otherAllergies', {
            defaultValue: 'Other allergies (separate with commas)',
          }),
        },
      ],
    },
    {
      id: 'budget',
      heading: t('groceries.budgetHeading', {
        defaultValue: 'Make your budget go further',
      }),
      hint: t('groceries.budgetHint', {
        defaultValue:
          'Your weekly budget covers the whole household. Leave it blank for no limit. Prices are sample estimates.',
      }),
      fields: [
        {
          id: 'budget',
          label: t('groceries.budget', {
            defaultValue: 'Weekly grocery budget',
          }),
          numeric: true,
          min: 1,
          max: 100000,
        },
        {
          id: 'currency',
          label: t('groceries.currency', { defaultValue: 'Currency' }),
          options: [
            { value: 'BAM', label: 'BAM' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
            { value: 'GBP', label: 'GBP' },
          ],
        },
      ],
    },
    {
      id: 'store',
      heading: t('groceries.storeHeading', {
        defaultValue: 'Where do you usually shop?',
      }),
      hint: t('groceries.storeHint', {
        defaultValue:
          'Save your favourite store with your list. These are sample choices, not live store prices or stock.',
      }),
      fields: [
        {
          id: 'store',
          label: t('groceries.store', { defaultValue: 'Store' }),
          options: [
            ...['Bingo', 'Konzum', 'Lidl'].map((name) => ({
              value: name,
              label: name,
            })),
            {
              value: 'market',
              label: t('groceries.market', { defaultValue: 'Local market' }),
            },
            {
              value: 'any',
              label: t('groceries.any', { defaultValue: 'No preference' }),
            },
          ],
        },
        {
          id: 'customStore',
          label: t('groceries.customStore', {
            defaultValue: 'Or enter another store',
          }),
        },
      ],
    },
    {
      id: 'kitchen',
      heading: t('groceries.kitchenHeading', {
        defaultValue: 'What is in your kitchen?',
      }),
      hint: t('groceries.kitchenHint', {
        defaultValue:
          'Pick every appliance you can use. No appliances means no-cook recipes; skip to leave equipment unspecified.',
      }),
      fields: [
        {
          id: 'appliances',
          label: t('groceries.appliances', {
            defaultValue: 'Available appliances',
          }),
          multiple: true,
          options: [
            {
              value: 'stove',
              label: t('groceries.stove', { defaultValue: 'Stovetop' }),
            },
            {
              value: 'oven',
              label: t('groceries.oven', { defaultValue: 'Oven' }),
            },
            {
              value: 'microwave',
              label: t('groceries.microwave', { defaultValue: 'Microwave' }),
            },
            {
              value: 'airfryer',
              label: t('groceries.airfryer', { defaultValue: 'Air fryer' }),
            },
            {
              value: 'blender',
              label: t('groceries.blender', { defaultValue: 'Blender' }),
            },
            {
              value: 'slowcooker',
              label: t('groceries.slowcooker', { defaultValue: 'Slow cooker' }),
            },
            {
              value: 'multicooker',
              label: t('groceries.multicooker', {
                defaultValue: 'Pressure cooker / multicooker',
              }),
            },
            {
              value: 'grill',
              label: t('groceries.grill', { defaultValue: 'Grill' }),
            },
            {
              value: 'none',
              label: t('groceries.noAppliances', {
                defaultValue: 'No cooking appliances',
              }),
            },
          ],
        },
        {
          id: 'otherAppliances',
          label: t('groceries.otherAppliances', {
            defaultValue: 'Other appliances (saved as a note)',
          }),
        },
      ],
    },
    {
      id: 'cooking',
      heading: t('groceries.cookingHeading', {
        defaultValue: 'How much cooking fits your week?',
      }),
      hint: t('groceries.cookingHint', {
        defaultValue: 'Simple meals can still make a great week.',
      }),
      fields: [
        {
          id: 'minutes',
          label: t('groceries.minutes', { defaultValue: 'Time per meal' }),
          options: [
            {
              value: '15',
              label: t('groceries.quick', {
                defaultValue: '15 minutes or less',
              }),
            },
            {
              value: '30',
              label: t('groceries.thirty', {
                defaultValue: 'Up to 30 minutes',
              }),
            },
            {
              value: '120',
              label: t('groceries.flexible', { defaultValue: 'Flexible' }),
            },
          ],
        },
        {
          id: 'leftovers',
          label: t('groceries.leftovers', {
            defaultValue: 'Cook once, eat twice?',
          }),
          options: [
            {
              value: 'yes',
              label: t('groceries.yesLeftovers', {
                defaultValue: 'Yes, repeat meals',
              }),
            },
            {
              value: 'no',
              label: t('groceries.noLeftovers', {
                defaultValue: 'Prefer variety',
              }),
            },
          ],
        },
      ],
    },
  ];
}
