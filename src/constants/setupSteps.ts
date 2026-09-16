import type { TFunction } from 'i18next';
import {
  answerValues,
  type SetupField,
  type SetupStep,
} from '../services/setupWizardSession';

/** A one-question step headed by the field's own label. */
function questionStep(field: SetupField, hint: string): SetupStep {
  return { id: field.id, heading: field.label, hint, fields: [field] };
}

export function profileSteps(t: TFunction): SetupStep[] {
  return [
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
          multiple: true,
          options: [
            {
              value: 'lose',
              label: t('setup.lose', { defaultValue: 'Lose weight' }),
              icon: 'trend-down',
            },
            {
              value: 'maintain',
              label: t('setup.maintain', { defaultValue: 'Maintain weight' }),
              icon: 'scale',
            },
            {
              value: 'muscle',
              label: t('setup.muscle', { defaultValue: 'Build muscle' }),
              icon: 'exercise-weights',
            },
            {
              value: 'fitness',
              label: t('setup.fitness', { defaultValue: 'Improve fitness' }),
              icon: 'heart-rate',
            },
            {
              value: 'track',
              label: t('setup.track', { defaultValue: 'Just track' }),
              icon: 'chart-bar',
            },
          ],
        },
      ],
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
              icon: 'desk',
            },
            {
              value: 'walking',
              label: t('setup.walking', { defaultValue: 'Some walking' }),
              icon: 'exercise-walking',
            },
            {
              value: 'moving',
              label: t('setup.moving', { defaultValue: 'Often moving' }),
              icon: 'flame',
            },
            {
              value: 'physical',
              label: t('setup.physical', {
                defaultValue: 'Physically demanding',
              }),
              icon: 'hammer',
            },
          ],
        },
      ],
    },
    questionStep(
      {
        id: 'age',
        label: t('setup.age', { defaultValue: 'Age' }),
        icon: 'calendar',
        unit: t('setup.unitYears', { defaultValue: 'years old' }),
        numeric: true,
        min: 13,
        max: 120,
        integer: true,
      },
      t('setup.ageHint', {
        defaultValue:
          'Your age helps us estimate how much energy your body needs each day.',
      })
    ),
    questionStep(
      {
        id: 'height',
        label: t('setup.height', { defaultValue: 'Height' }),
        icon: 'measurements',
        unit: 'cm',
        numeric: true,
        min: 50,
        max: 250,
      },
      t('setup.heightHint', {
        defaultValue:
          'We use it with your weight to set sensible goals. Already measured? It is filled in for you.',
      })
    ),
    questionStep(
      {
        id: 'weight',
        label: t('setup.weight', { defaultValue: 'Current weight' }),
        icon: 'scale',
        unit: 'kg',
        numeric: true,
        min: 20,
        max: 400,
      },
      t('setup.weightHint', {
        defaultValue:
          'This is your starting point, not a judgement. You can log a new weight any time.',
      })
    ),
    questionStep(
      {
        id: 'targetWeight',
        label: t('setup.targetWeight', { defaultValue: 'Target weight' }),
        icon: 'trophy',
        unit: 'kg',
        // Start from the weight entered a step earlier.
        suggestion: (a) => {
          const weight = Number(String(a.weight ?? '').replace(',', '.'));
          return weight > 0 ? weight : 70;
        },
        numeric: true,
        min: 20,
        max: 400,
        showWhen: (a) =>
          answerValues(a, 'focus').some((focus) =>
            ['lose', 'maintain', 'muscle'].includes(focus)
          ),
      },
      t('setup.targetWeightHint', {
        defaultValue:
          'Choose a weight that feels right for you. There is no deadline.',
      })
    ),
    questionStep(
      {
        id: 'sessions',
        label: t('setup.sessions', { defaultValue: 'Training days/week' }),
        icon: 'exercise-weights',
        unit: t('setup.unitDays', { defaultValue: 'days' }),
        suggestion: 3,
        numeric: true,
        min: 0,
        max: 7,
        integer: true,
        // Hidden only when "Just track" is the sole focus.
        showWhen: (a) =>
          answerValues(a, 'focus').some((focus) => focus !== 'track') ||
          answerValues(a, 'focus').length === 0,
      },
      t('setup.sessionsHint', {
        defaultValue:
          'Count the days you plan to work out. Even two or three makes a real difference.',
      })
    ),
    questionStep(
      {
        id: 'steps',
        label: t('setup.steps', { defaultValue: 'Daily steps' }),
        icon: 'exercise-walking',
        unit: t('setup.unitSteps', { defaultValue: 'steps' }),
        suggestion: 8000,
        numeric: true,
        max: 100000,
      },
      t('setup.stepsHint', {
        defaultValue:
          'Walking adds up quickly. Start with a number that feels easy to hit.',
      })
    ),
    questionStep(
      {
        id: 'water_goal_ml',
        label: t('setup.water', { defaultValue: 'Daily water' }),
        icon: 'hydration',
        unit: 'ml',
        suggestion: 2000,
        numeric: true,
        max: 10000,
      },
      t('setup.waterHint', {
        defaultValue:
          'Most adults feel good around two litres. Drink more on hot or active days.',
      })
    ),
    questionStep(
      {
        id: 'sleep',
        label: t('setup.sleep', { defaultValue: 'Sleep goal' }),
        icon: 'sleep-bedtime',
        unit: t('setup.unitHours', { defaultValue: 'hours' }),
        suggestion: 8,
        numeric: true,
        max: 24,
      },
      t('setup.sleepHint', {
        defaultValue:
          'Most adults feel their best with seven to nine hours a night.',
      })
    ),
    questionStep(
      {
        id: 'calories',
        label: t('setup.calories', { defaultValue: 'Daily calorie goal' }),
        icon: 'flame',
        unit: 'kcal',
        suggestion: 2000,
        numeric: true,
        max: 10000,
      },
      t('setup.caloriesHint', {
        defaultValue:
          'The energy you want to eat each day. Not sure yet? Skip it and set it later in Profile.',
      })
    ),
    questionStep(
      {
        id: 'protein',
        label: t('setup.protein', { defaultValue: 'Daily protein goal' }),
        icon: 'food',
        unit: 'g',
        suggestion: 120,
        numeric: true,
        max: 500,
      },
      t('setup.proteinHint', {
        defaultValue:
          'Protein helps your muscles recover and keeps you fuller for longer.',
      })
    ),
  ];
}

export function grocerySteps(t: TFunction): SetupStep[] {
  return [
    questionStep(
      {
        id: 'servings',
        label: t('groceries.servings', { defaultValue: 'People / servings' }),
        unit: t('groceries.unitPeople', { defaultValue: 'people' }),
        numeric: true,
        integer: true,
        min: 1,
        max: 12,
      },
      t('groceries.servingsHint', {
        defaultValue: 'Count everyone who eats from this shop, including you.',
      })
    ),
    questionStep(
      {
        id: 'days',
        label: t('groceries.days', { defaultValue: 'Days to plan' }),
        unit: t('setup.unitDays', { defaultValue: 'days' }),
        numeric: true,
        integer: true,
        min: 1,
        max: 7,
      },
      t('groceries.daysHint', {
        defaultValue:
          'We plan one main meal for each day. Breakfast and snacks can go straight on your list.',
      })
    ),
    questionStep(
      {
        id: 'diet',
        label: t('groceries.diet', { defaultValue: 'Eating style' }),
        options: [
          {
            value: 'any',
            label: t('groceries.any', { defaultValue: 'No preference' }),
            icon: 'food',
          },
          {
            value: 'vegetarian',
            label: t('groceries.vegetarian', { defaultValue: 'Vegetarian' }),
            icon: 'leaf',
          },
          {
            value: 'vegan',
            label: t('groceries.vegan', { defaultValue: 'Vegan' }),
            icon: 'carrot',
          },
          {
            value: 'pescatarian',
            label: t('groceries.pescatarian', { defaultValue: 'Pescatarian' }),
            icon: 'fish',
          },
        ],
      },
      t('groceries.dietStyleHint', {
        defaultValue: 'We only suggest recipes that fit the way you eat.',
      })
    ),
    questionStep(
      {
        id: 'dislikes',
        label: t('groceries.dislikes', {
          defaultValue: 'Disliked ingredients',
        }),
      },
      t('groceries.dislikesHint', {
        defaultValue:
          'Separate ingredients with commas, like olives, mushrooms, coriander.',
      })
    ),
    questionStep(
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
      t('groceries.allergiesHint', {
        defaultValue:
          'Allergies are different from dislikes. Skipping leaves this unknown. Always check ingredient labels.',
      })
    ),
    questionStep(
      {
        id: 'otherAllergies',
        label: t('groceries.otherAllergies', {
          defaultValue: 'Other allergies',
        }),
      },
      t('groceries.otherAllergiesHint', {
        defaultValue:
          'Not in the list? Add it here, separated by commas, and we will leave it out.',
      })
    ),
    questionStep(
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
      t('groceries.currencyHint', {
        defaultValue: 'Your budget and price estimates will use this currency.',
      })
    ),
    questionStep(
      {
        id: 'budget',
        label: t('groceries.budget', {
          defaultValue: 'Weekly grocery budget',
        }),
        unit: (answers) =>
          typeof answers.currency === 'string' ? answers.currency : undefined,
        numeric: true,
        min: 1,
        max: 100000,
      },
      t('groceries.budgetHint', {
        defaultValue:
          'Your weekly budget covers the whole household. Leave it blank for no limit. Prices are sample estimates.',
      })
    ),
    questionStep(
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
      t('groceries.storeHint', {
        defaultValue:
          'Save your favourite store with your list. These are sample choices, not live store prices or stock.',
      })
    ),
    questionStep(
      {
        id: 'customStore',
        label: t('groceries.customStore', { defaultValue: 'Another store' }),
      },
      t('groceries.customStoreHint', {
        defaultValue:
          'Shop somewhere else? Type its name and we will save it with your list.',
      })
    ),
    questionStep(
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
      t('groceries.kitchenHint', {
        defaultValue:
          'Pick every appliance you can use. No appliances means no-cook recipes; skip to leave equipment unspecified.',
      })
    ),
    questionStep(
      {
        id: 'otherAppliances',
        label: t('groceries.otherAppliances', {
          defaultValue: 'Other appliances',
        }),
      },
      t('groceries.otherAppliancesHint', {
        defaultValue:
          'Anything else you cook with. We save it as a note for now.',
      })
    ),
    questionStep(
      {
        id: 'minutes',
        label: t('groceries.minutes', { defaultValue: 'Time per meal' }),
        options: [
          {
            value: '15',
            label: t('groceries.quick', {
              defaultValue: '15 minutes or less',
            }),
            icon: 'timer',
          },
          {
            value: '30',
            label: t('groceries.thirty', { defaultValue: 'Up to 30 minutes' }),
            icon: 'clock',
          },
          {
            value: '120',
            label: t('groceries.flexible', { defaultValue: 'Flexible' }),
            icon: 'hourglass',
          },
        ],
      },
      t('groceries.minutesHint', {
        defaultValue:
          'Think about a busy weekday. Quick meals can still be really good.',
      })
    ),
    questionStep(
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
            icon: 'repeat',
          },
          {
            value: 'no',
            label: t('groceries.noLeftovers', {
              defaultValue: 'Prefer variety',
            }),
            icon: 'shuffle',
          },
        ],
      },
      t('groceries.leftoversHint', {
        defaultValue:
          'Cooking extra saves time. Pick variety if you would rather eat something new each day.',
      })
    ),
  ];
}
