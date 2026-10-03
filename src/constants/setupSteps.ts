import type { TFunction } from 'i18next';
import {
  answerValues,
  ASSIST_LINK,
  type SetupAssist,
  type SetupField,
  type SetupStep,
} from '../services/setupWizardSession';
import { regionName, SHOPPING_CURRENCIES, SHOPPING_REGIONS } from './regions';
import type { Vendor } from '../services/online/prices';
import {
  calorieGoalPrompt,
  calorieGoalLabel,
  macroPlanLabel,
  macroPlanPrompt,
  proteinGoalLabel,
  proteinGoalPrompt,
} from '../services/markaiGoalPrompt';
import { MARKAI_TASK_COINS } from '../services/online/markai';

/** A one-question step headed by the field's own label. */
function questionStep(field: SetupField, hint: string): SetupStep {
  return { id: field.id, heading: field.label, hint, fields: [field] };
}

/**
 * The first round of the profile tour: enough to work out a BMI, and the
 * goal and routine it is read against. Asked before anything optional.
 */
export const FIRST_ROUND_STEPS = [
  'focus',
  'activity',
  'age',
  'height',
  'weight',
  'targetWeight',
  'sessions',
];

export function profileSteps(t: TFunction): SetupStep[] {
  return profileQuestions(t).map((step) =>
    FIRST_ROUND_STEPS.includes(step.id) ? { ...step, required: true } : step
  );
}

function profileQuestions(t: TFunction): SetupStep[] {
  // Offered on every macro question: one priced request that answers
  // calories, protein, carbs and fat together, filling all four questions.
  const allMacros: SetupAssist = {
    sentence: t('setup.assistAllMacros', {
      defaultValue:
        'Or {{link}}: calories, protein, carbs and fat in one go, for {{coins}} coins.',
      link: ASSIST_LINK,
      coins: MARKAI_TASK_COINS.all_macros,
    }),
    link: t('setup.assistAllMacrosLink', {
      defaultValue: 'plan all your macros',
    }),
    prompt: (facts) => macroPlanPrompt(t, facts),
    label: macroPlanLabel(t),
    task: 'all_macros',
  };
  // Carbs and fat have no single-goal assist, so the plan is the only offer
  // there and opens the paragraph rather than following another one.
  const allMacrosOnly: SetupAssist = {
    ...allMacros,
    sentence: t('setup.assistAllMacrosOnly', {
      defaultValue:
        'Not sure? {{link}}: calories, protein, carbs and fat in one go, for {{coins}} coins.',
      link: ASSIST_LINK,
      coins: MARKAI_TASK_COINS.all_macros,
    }),
  };
  const markaiLink = t('setup.assistMarkaiLink', {
    defaultValue: 'Let MarkAI work it out',
  });
  return [
    {
      id: 'focus',
      heading: t('setup.focusHeading', {
        defaultValue: 'Make room for your goals',
      }),
      hint: t('setup.focusHintBmi', {
        defaultValue:
          'Start with what matters to you. This first round of questions works out your BMI; everything after it is optional.',
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
        placeholder: t('setup.placeholders.age', {
          defaultValue: 'Enter your age',
        }),
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
        placeholder: t('setup.placeholders.height', {
          defaultValue: 'Enter your height',
        }),
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
        placeholder: t('setup.placeholders.weight', {
          defaultValue: 'Enter your current weight',
        }),
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
        placeholder: t('setup.placeholders.targetWeight', {
          defaultValue: 'Enter your target weight',
        }),
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
        placeholder: t('setup.placeholders.sessions', {
          defaultValue: 'Enter training days per week',
        }),
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
        placeholder: t('setup.placeholders.steps', {
          defaultValue: 'Enter a daily step goal',
        }),
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
        placeholder: t('setup.placeholders.water', {
          defaultValue: 'Enter a daily water goal',
        }),
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
        placeholder: t('setup.placeholders.sleep', {
          defaultValue: 'Enter hours of sleep a night',
        }),
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
        placeholder: t('setup.placeholders.calories', {
          defaultValue: 'Enter a daily calorie goal',
        }),
        label: t('setup.calories', { defaultValue: 'Daily calorie goal' }),
        icon: 'flame',
        unit: 'kcal',
        suggestion: 2000,
        numeric: true,
        min: 1,
        max: 10000,
        assists: [
          {
            sentence: t('setup.assistCalories', {
              defaultValue: 'Not sure? {{link}} from your answers, for 1 coin.',
              link: ASSIST_LINK,
            }),
            link: markaiLink,
            prompt: (facts) => calorieGoalPrompt(t, facts),
            label: calorieGoalLabel(t),
          },
          allMacros,
        ],
      },
      t('setup.caloriesHintShort', {
        defaultValue:
          'The energy you want to eat each day. You can also skip it and set it later in Profile.',
      })
    ),
    questionStep(
      {
        id: 'protein',
        placeholder: t('setup.placeholders.protein', {
          defaultValue: 'Enter a daily protein goal',
        }),
        label: t('setup.protein', { defaultValue: 'Daily protein goal' }),
        icon: 'food',
        unit: 'g',
        suggestion: 120,
        numeric: true,
        max: 500,
        assists: [
          {
            sentence: t('setup.assistProtein', {
              defaultValue: 'Not sure? {{link}} from your answers, for 1 coin.',
              link: ASSIST_LINK,
            }),
            link: markaiLink,
            prompt: (facts) => proteinGoalPrompt(t, facts),
            label: proteinGoalLabel(t),
          },
          allMacros,
        ],
      },
      t('setup.proteinHintShort', {
        defaultValue:
          'Protein helps your muscles recover and keeps you fuller for longer.',
      })
    ),
    questionStep(
      {
        id: 'carbs',
        placeholder: t('setup.placeholders.carbs', {
          defaultValue: 'Enter a daily carbs goal',
        }),
        label: t('setup.carbs', { defaultValue: 'Daily carbs goal' }),
        icon: 'leaf',
        unit: 'g',
        suggestion: 250,
        numeric: true,
        max: 1000,
        assists: [allMacrosOnly],
      },
      t('setup.carbsHintShort', {
        defaultValue:
          'Carbs are your main fuel for training and everyday energy.',
      })
    ),
    questionStep(
      {
        id: 'fat',
        placeholder: t('setup.placeholders.fat', {
          defaultValue: 'Enter a daily fat goal',
        }),
        label: t('setup.fat', { defaultValue: 'Daily fat goal' }),
        icon: 'hydration',
        unit: 'g',
        suggestion: 70,
        numeric: true,
        max: 500,
        assists: [allMacrosOnly],
      },
      t('setup.fatHintShort', {
        defaultValue:
          'Fat supports your hormones and helps your body use vitamins.',
      })
    ),
  ];
}

/**
 * The kitchen questionnaire. `vendorsFor` gives the stores of a region as
 * the backend lists them from cijene.dev; a region without published
 * prices has none, and the store question offers only the local market,
 * no preference and a store typed by hand.
 */
export function grocerySteps(
  t: TFunction,
  vendorsFor: (region: string) => Vendor[] = () => []
): SetupStep[] {
  return [
    questionStep(
      {
        id: 'servings',
        placeholder: t('groceries.placeholders.servings', {
          defaultValue: 'Enter how many people eat',
        }),
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
        placeholder: t('groceries.placeholders.days', {
          defaultValue: 'Enter how many days to plan',
        }),
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
        placeholder: t('groceries.placeholders.dislikes', {
          defaultValue: 'Enter ingredients you avoid',
        }),
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
        placeholder: t('groceries.placeholders.otherAllergies', {
          defaultValue: 'Enter any other allergies',
        }),
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
        id: 'region',
        label: t('groceries.region', { defaultValue: 'Where do you shop?' }),
        options: SHOPPING_REGIONS.map((region) => ({
          value: region.code,
          label: regionName(t, region.code),
        })),
      },
      t('groceries.regionHint', {
        defaultValue:
          'Meal plans are priced for this country. In Croatia they use real store prices, updated daily.',
      })
    ),
    questionStep(
      {
        id: 'currency',
        label: t('groceries.currency', { defaultValue: 'Currency' }),
        options: SHOPPING_CURRENCIES.map((code) => ({
          value: code,
          label: code,
        })),
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
        optionsFor: (answers) => [
          ...vendorsFor(String(answers.region || 'HR')).map((vendor) => ({
            value: vendor.code,
            label: vendor.name,
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
          'Where you usually shop. Stores come from the published shelf prices of your region, and a list from a meal plan compares them all.',
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
