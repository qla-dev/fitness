import type { IconName } from '../components/Icon';
import type { TFunction } from 'i18next';
import type {
  ExerciseProgram,
  ProgramCategoryId,
  ProgramLevel,
} from '../types/exerciseProgram';

/**
 * The twenty starter programs behind the Exercises store.
 *
 * Exercise names deliberately match the naming the library and the external
 * providers use, so a session lines up with something the user can already
 * search for and log.
 */
export const PROGRAM_CATEGORIES: ProgramCategoryId[] = [
  'glutes',
  'core',
  'upper',
  'legs',
  'fullBody',
  'strength',
  'fatLoss',
  'mobility',
  'beginner',
];

const PROGRAM_CATEGORY_ICONS: Record<ProgramCategoryId, IconName> = {
  glutes: 'exercise-weights',
  core: 'exercise-yoga',
  upper: 'exercise-weights',
  legs: 'exercise-running-filled',
  fullBody: 'exercise',
  strength: 'exercise-weights',
  fatLoss: 'flame',
  mobility: 'exercise-yoga',
  beginner: 'star',
};

export function getProgramCategoryIcon(category: ProgramCategoryId): IconName {
  return PROGRAM_CATEGORY_ICONS[category];
}

export function getProgramCategoryLabel(
  t: TFunction,
  category: ProgramCategoryId
): string {
  switch (category) {
    case 'glutes':
      return t('programs.categories.glutes', { defaultValue: 'Glutes' });
    case 'core':
      return t('programs.categories.core', { defaultValue: 'Core' });
    case 'upper':
      return t('programs.categories.upper', { defaultValue: 'Upper body' });
    case 'legs':
      return t('programs.categories.legs', { defaultValue: 'Legs' });
    case 'fullBody':
      return t('programs.categories.fullBody', { defaultValue: 'Full body' });
    case 'strength':
      return t('programs.categories.strength', { defaultValue: 'Strength' });
    case 'fatLoss':
      return t('programs.categories.fatLoss', { defaultValue: 'Fat loss' });
    case 'mobility':
      return t('programs.categories.mobility', { defaultValue: 'Mobility' });
    case 'beginner':
      return t('programs.categories.beginner', { defaultValue: 'Beginner' });
  }
}

export function getProgramLevelLabel(
  t: TFunction,
  level: ProgramLevel
): string {
  switch (level) {
    case 'beginner':
      return t('programs.levels.beginner', { defaultValue: 'Beginner' });
    case 'intermediate':
      return t('programs.levels.intermediate', {
        defaultValue: 'Intermediate',
      });
    case 'advanced':
      return t('programs.levels.advanced', { defaultValue: 'Advanced' });
  }
}

export const EXERCISE_PROGRAMS: ExerciseProgram[] = [
  {
    id: 'glutes-for-days',
    name: 'Glutes for Days',
    tagline: 'Build the shelf. Keep the strength.',
    coach: 'Sparky Strength Lab',
    category: 'glutes',
    level: 'intermediate',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 4,
    minutesPerSession: 55,
    rating: 4.9,
    ratingCount: 2841,
    accentVar: '--color-cat-pink',
    icon: 'exercise-weights',
    summary:
      'Eight weeks built around heavy hip extension and honest volume. Two heavy days drive the hip thrust and squat up, two pump days chase blood flow and time under tension. Nothing here is a gimmick — you get stronger, and the shape follows.',
    highlights: [
      'Hip thrust progression from bar-only to bodyweight-loaded',
      'Two heavy days, two pump days, zero junk volume',
      'Every session under an hour',
    ],
    sessions: [
      {
        day: 1,
        name: 'Heavy Hips',
        focus: 'Hip thrust strength',
        minutes: 55,
        exercises: [
          { name: 'Barbell Hip Thrust', sets: 4, reps: '6-8', restSec: 150 },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSec: 120 },
          {
            name: 'Bulgarian Split Squat',
            sets: 3,
            reps: '8 each leg',
            restSec: 90,
          },
          { name: 'Cable Kickback', sets: 3, reps: '12-15', restSec: 60 },
          { name: 'Back Extension', sets: 3, reps: '12-15', restSec: 60 },
          { name: 'Seated Abduction', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Quad & Core',
        focus: 'Squat pattern',
        minutes: 50,
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6-8', restSec: 150 },
          { name: 'Walking Lunge', sets: 3, reps: '10 each leg', restSec: 90 },
          { name: 'Leg Press', sets: 3, reps: '12-15', restSec: 90 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 45 },
          { name: 'Standing Calf Raise', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Glute Pump',
        focus: 'Volume and blood flow',
        minutes: 45,
        exercises: [
          {
            name: 'Barbell Hip Thrust',
            sets: 4,
            reps: '15-20',
            restSec: 75,
            note: 'Lighter than day 1. Pause a full second at the top.',
          },
          { name: 'Goblet Squat', sets: 3, reps: '15', restSec: 60 },
          { name: 'Glute Bridge', sets: 3, reps: '20', restSec: 45 },
          {
            name: 'Banded Lateral Walk',
            sets: 3,
            reps: '20 steps',
            restSec: 45,
          },
          { name: 'Frog Pump', sets: 2, reps: '25', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Posterior Chain',
        focus: 'Hamstrings and back',
        minutes: 50,
        exercises: [
          { name: 'Conventional Deadlift', sets: 4, reps: '5', restSec: 180 },
          { name: 'Hip Thrust Machine', sets: 3, reps: '12', restSec: 90 },
          { name: 'Seated Leg Curl', sets: 3, reps: '12-15', restSec: 60 },
          {
            name: 'Single-Leg Romanian Deadlift',
            sets: 3,
            reps: '10 each leg',
            restSec: 60,
          },
          { name: 'Cable Pull-Through', sets: 3, reps: '15', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Eat to build. Muscle is not free.',
      calories: '+250 kcal over maintenance',
      proteinPerKg: 1.8,
      carbs: '4-5 g/kg on training days',
      fat: '0.8-1 g/kg',
      tips: [
        'Put 30-40 g of protein within two hours of every session.',
        'Carbs go around training — the heavy days earn the biggest plates.',
        'Weigh yourself weekly, not daily. Aim for 0.25-0.4 kg a month.',
      ],
    },
  },
  {
    id: 'core-of-steel',
    name: 'Core of Steel',
    tagline: 'A midsection that braces, not just poses.',
    coach: 'Sparky Strength Lab',
    category: 'core',
    level: 'intermediate',
    weeks: 6,
    priceEur: 7.99,
    daysPerWeek: 4,
    minutesPerSession: 35,
    rating: 4.7,
    ratingCount: 1962,
    accentVar: '--color-cat-orange',
    icon: 'exercise-pilates',
    summary:
      'Trains the core the way it actually works: resisting movement. Anti-extension, anti-rotation and loaded carries do the heavy lifting, with direct flexion work as a finisher rather than the whole session.',
    highlights: [
      'Anti-rotation and carry work most programs skip',
      '35 minutes, stackable after any lifting day',
      'Progressions from knees to full-body tension',
    ],
    sessions: [
      {
        day: 1,
        name: 'Anti-Extension',
        focus: 'Resisting the arch',
        minutes: 35,
        exercises: [
          { name: 'Ab Wheel Rollout', sets: 4, reps: '8-10', restSec: 90 },
          { name: 'Hollow Body Hold', sets: 3, reps: '30 s', restSec: 60 },
          { name: 'Dead Bug', sets: 3, reps: '10 each side', restSec: 45 },
          { name: 'Plank', sets: 3, reps: '60 s', restSec: 45 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Anti-Rotation',
        focus: 'Resisting the twist',
        minutes: 35,
        exercises: [
          { name: 'Pallof Press', sets: 4, reps: '12 each side', restSec: 60 },
          {
            name: 'Half-Kneeling Cable Chop',
            sets: 3,
            reps: '12 each side',
            restSec: 60,
          },
          { name: 'Side Plank', sets: 3, reps: '40 s each side', restSec: 45 },
          { name: 'Bird Dog', sets: 3, reps: '10 each side', restSec: 45 },
          { name: 'Russian Twist', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Loaded Carries',
        focus: 'Bracing under load',
        minutes: 30,
        exercises: [
          { name: 'Farmer Carry', sets: 4, reps: '40 m', restSec: 90 },
          {
            name: 'Suitcase Carry',
            sets: 3,
            reps: '30 m each side',
            restSec: 75,
          },
          { name: 'Overhead Carry', sets: 3, reps: '25 m', restSec: 75 },
          { name: 'Front Rack Hold', sets: 3, reps: '30 s', restSec: 60 },
          { name: 'Reverse Crunch', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Flexion & Finish',
        focus: 'Direct abdominal work',
        minutes: 30,
        exercises: [
          { name: 'Cable Crunch', sets: 4, reps: '12-15', restSec: 60 },
          { name: 'Hanging Leg Raise', sets: 3, reps: '10', restSec: 75 },
          { name: 'Decline Sit-Up', sets: 3, reps: '15', restSec: 60 },
          { name: 'Mountain Climber', sets: 3, reps: '30 s', restSec: 45 },
          { name: 'Plank', sets: 2, reps: '90 s', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Abs are built here and revealed in the kitchen.',
      calories: 'Maintenance, or -200 kcal if you want them visible',
      proteinPerKg: 2,
      carbs: '3-4 g/kg',
      fat: '0.8 g/kg',
      tips: [
        'Protein at every meal keeps you full while the deficit is small.',
        'Do not cut carbs to zero — bracing hard needs glycogen.',
        'Sodium and water stay normal. Dehydration does not show abs.',
      ],
    },
  },
  {
    id: 'shoulder-boulder',
    name: 'Boulder Shoulder Blueprint',
    tagline: 'Three heads. All of them.',
    coach: 'Coach Mara Ilić',
    category: 'upper',
    level: 'intermediate',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 3,
    minutesPerSession: 50,
    rating: 4.8,
    ratingCount: 3120,
    accentVar: '--color-cat-blue',
    icon: 'exercise-weights',
    summary:
      'Most shoulder training is all front delt and no rear. This one presses heavy twice a week, then spends real volume on the side and rear heads — the two that actually change your silhouette.',
    highlights: [
      'Overhead press strength block',
      'Double the usual rear-delt volume',
      'Built-in cuff work so the joint keeps up',
    ],
    sessions: [
      {
        day: 1,
        name: 'Heavy Press',
        focus: 'Overhead strength',
        minutes: 50,
        exercises: [
          { name: 'Overhead Press', sets: 5, reps: '5', restSec: 180 },
          {
            name: 'Seated Dumbbell Press',
            sets: 3,
            reps: '8-10',
            restSec: 120,
          },
          { name: 'Lateral Raise', sets: 4, reps: '12-15', restSec: 60 },
          { name: 'Face Pull', sets: 4, reps: '15', restSec: 60 },
          {
            name: 'Cable External Rotation',
            sets: 3,
            reps: '15 each side',
            restSec: 45,
          },
          { name: 'Front Raise', sets: 3, reps: '12', restSec: 45 },
          { name: 'Shrug', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Volume Delts',
        focus: 'Side and rear heads',
        minutes: 45,
        exercises: [
          { name: 'Arnold Press', sets: 4, reps: '10-12', restSec: 90 },
          { name: 'Cable Lateral Raise', sets: 4, reps: '15', restSec: 60 },
          { name: 'Reverse Pec Deck', sets: 4, reps: '15', restSec: 60 },
          { name: 'Upright Row', sets: 3, reps: '12', restSec: 60 },
          { name: 'Bent-Over Lateral Raise', sets: 3, reps: '15', restSec: 45 },
          { name: 'Machine Shoulder Press', sets: 3, reps: '12', restSec: 60 },
          { name: 'Rear Delt Row', sets: 3, reps: '15', restSec: 60 },
        ],
      },
      {
        day: 3,
        name: 'Press & Pull',
        focus: 'Balance the joint',
        minutes: 50,
        exercises: [
          { name: 'Push Press', sets: 4, reps: '6', restSec: 150 },
          { name: 'Incline Bench Press', sets: 3, reps: '8-10', restSec: 120 },
          { name: 'Chest-Supported Row', sets: 4, reps: '10-12', restSec: 90 },
          {
            name: 'Lateral Raise',
            sets: 3,
            reps: '20',
            restSec: 45,
            note: 'Light. Chase the burn, not the weight.',
          },
          { name: 'Band Pull-Apart', sets: 3, reps: '25', restSec: 45 },
          { name: 'Overhead Press', sets: 3, reps: '8', restSec: 120 },
          { name: 'Cable Rear Delt Fly', sets: 3, reps: '20', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'A small surplus, held for eight weeks.',
      calories: '+200 kcal over maintenance',
      proteinPerKg: 1.8,
      carbs: '4 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'Overhead work is neurally expensive — do not train it fasted.',
        'Creatine at 5 g daily is the one supplement worth the money here.',
        'Sleep is the actual growth window. Seven hours is the floor.',
      ],
    },
  },
  {
    id: 'bulletproof-back',
    name: 'Bulletproof Back',
    tagline: 'Wide, thick, and it stops hurting.',
    coach: 'Coach Mara Ilić',
    category: 'upper',
    level: 'intermediate',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 3,
    minutesPerSession: 55,
    rating: 4.8,
    ratingCount: 2410,
    accentVar: '--color-cat-teal',
    icon: 'exercise-weights',
    summary:
      'Vertical pulling for width, horizontal pulling for thickness, and spinal work so the lower back stops being the thing that limits every other lift.',
    highlights: [
      'Pull-up progression that actually adds reps',
      'Equal vertical and horizontal pulling volume',
      'Lower-back work that builds rather than aggravates',
    ],
    sessions: [
      {
        day: 1,
        name: 'Vertical Pull',
        focus: 'Lat width',
        minutes: 55,
        exercises: [
          { name: 'Pull-Up', sets: 5, reps: 'AMRAP', restSec: 150 },
          { name: 'Lat Pulldown', sets: 4, reps: '10-12', restSec: 90 },
          { name: 'Straight-Arm Pulldown', sets: 3, reps: '15', restSec: 60 },
          { name: 'Dumbbell Pullover', sets: 3, reps: '12', restSec: 60 },
          { name: 'Hammer Curl', sets: 3, reps: '12', restSec: 60 },
          { name: 'Chin-Up', sets: 3, reps: 'AMRAP', restSec: 90 },
          { name: 'Cable Row', sets: 3, reps: '15', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Horizontal Pull',
        focus: 'Mid-back thickness',
        minutes: 55,
        exercises: [
          { name: 'Barbell Row', sets: 4, reps: '6-8', restSec: 150 },
          { name: 'Seated Cable Row', sets: 4, reps: '10-12', restSec: 90 },
          { name: 'Chest-Supported Row', sets: 3, reps: '12', restSec: 75 },
          { name: 'Face Pull', sets: 3, reps: '15', restSec: 60 },
          { name: 'Barbell Curl', sets: 3, reps: '10', restSec: 60 },
          { name: 'T-Bar Row', sets: 3, reps: '10', restSec: 90 },
          { name: 'Shrug', sets: 3, reps: '15', restSec: 60 },
        ],
      },
      {
        day: 3,
        name: 'Hinge & Erectors',
        focus: 'Spinal strength',
        minutes: 50,
        exercises: [
          { name: 'Conventional Deadlift', sets: 4, reps: '5', restSec: 180 },
          { name: 'Rack Pull', sets: 3, reps: '6-8', restSec: 150 },
          { name: 'Back Extension', sets: 4, reps: '15', restSec: 60 },
          { name: 'Farmer Carry', sets: 3, reps: '40 m', restSec: 90 },
          { name: 'Bird Dog', sets: 3, reps: '10 each side', restSec: 45 },
          { name: 'Good Morning', sets: 3, reps: '10', restSec: 90 },
          { name: 'Reverse Hyperextension', sets: 3, reps: '15', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Feed the biggest muscle group you own.',
      calories: '+250 kcal over maintenance',
      proteinPerKg: 1.9,
      carbs: '4-5 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'Deadlift days need carbs the night before, not just the morning of.',
        'Hydrate to 35 ml/kg — grip and erectors fade fast when you are dry.',
        'If the low back is sore for more than 48 h, drop a set, not the day.',
      ],
    },
  },
  {
    id: 'iron-chest',
    name: 'Iron Chest Protocol',
    tagline: 'Press more. Look like it.',
    coach: 'Sparky Strength Lab',
    category: 'upper',
    level: 'advanced',
    weeks: 10,
    priceEur: 12.99,
    daysPerWeek: 3,
    minutesPerSession: 60,
    rating: 4.6,
    ratingCount: 1785,
    accentVar: '--color-cat-violet',
    icon: 'exercise-weights',
    summary:
      'A ten-week bench specialisation. One heavy day, one speed day, one hypertrophy day, with enough upper-back work to keep the shoulders where they belong.',
    highlights: [
      'Heavy / speed / volume weekly wave',
      'Incline and fly work for the upper chest',
      'Triceps volume tied to the press, not random',
    ],
    sessions: [
      {
        day: 1,
        name: 'Heavy Bench',
        focus: 'Top-end strength',
        minutes: 60,
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: '3-5', restSec: 210 },
          {
            name: 'Close-Grip Bench Press',
            sets: 3,
            reps: '6-8',
            restSec: 150,
          },
          { name: 'Weighted Dip', sets: 3, reps: '8', restSec: 120 },
          { name: 'Barbell Row', sets: 4, reps: '8', restSec: 90 },
          { name: 'Skull Crusher', sets: 3, reps: '10-12', restSec: 60 },
          { name: 'Cable Fly', sets: 3, reps: '15', restSec: 60 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Speed & Upper Chest',
        focus: 'Bar speed',
        minutes: 50,
        exercises: [
          {
            name: 'Barbell Bench Press',
            sets: 8,
            reps: '3',
            restSec: 60,
            note: '60% of your best single. Move it fast.',
          },
          { name: 'Incline Dumbbell Press', sets: 4, reps: '10', restSec: 90 },
          { name: 'Cable Fly', sets: 3, reps: '15', restSec: 60 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
          {
            name: 'Overhead Triceps Extension',
            sets: 3,
            reps: '12',
            restSec: 60,
          },
          { name: 'Dumbbell Pullover', sets: 3, reps: '12', restSec: 60 },
          { name: 'Triceps Pushdown', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Hypertrophy',
        focus: 'Volume and stretch',
        minutes: 55,
        exercises: [
          {
            name: 'Incline Barbell Press',
            sets: 4,
            reps: '8-10',
            restSec: 120,
          },
          { name: 'Dumbbell Bench Press', sets: 4, reps: '10-12', restSec: 90 },
          { name: 'Pec Deck', sets: 3, reps: '15', restSec: 60 },
          { name: 'Push-Up', sets: 3, reps: 'AMRAP', restSec: 60 },
          { name: 'Triceps Pushdown', sets: 4, reps: '12-15', restSec: 45 },
          { name: 'Chest Dip', sets: 3, reps: 'AMRAP', restSec: 90 },
          { name: 'Close-Grip Push-Up', sets: 2, reps: 'AMRAP', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Strength blocks are not the time to diet.',
      calories: '+300 kcal over maintenance',
      proteinPerKg: 2,
      carbs: '5 g/kg',
      fat: '1 g/kg',
      tips: [
        'Eat a real meal 2-3 h before the heavy day. Fasted benching is a waste.',
        'Ten weeks is long — take a deload in week 6 and eat at maintenance.',
        'Track the bar, not the scale. Weight moving up is the point.',
      ],
    },
  },
  {
    id: 'arm-day-every-day',
    name: 'Arm Day Every Day',
    tagline: 'Sleeves are optional after this.',
    coach: 'Coach Tomo Rakić',
    category: 'upper',
    level: 'beginner',
    weeks: 6,
    priceEur: 7.99,
    daysPerWeek: 3,
    minutesPerSession: 35,
    rating: 4.5,
    ratingCount: 4103,
    accentVar: '--color-cat-amber',
    icon: 'exercise-weights',
    summary:
      'Short, frequent arm sessions you can bolt onto any split. High frequency beats one brutal arm day a week, and every session fits in half an hour.',
    highlights: [
      'Three 35-minute sessions a week',
      'Biceps and triceps hit evenly',
      'Works with dumbbells and a cable stack alone',
    ],
    sessions: [
      {
        day: 1,
        name: 'Heavy Arms',
        focus: 'Loaded curls and extensions',
        minutes: 35,
        exercises: [
          { name: 'Barbell Curl', sets: 4, reps: '6-8', restSec: 90 },
          { name: 'Close-Grip Bench Press', sets: 4, reps: '8', restSec: 90 },
          { name: 'Hammer Curl', sets: 3, reps: '10', restSec: 60 },
          { name: 'Skull Crusher', sets: 3, reps: '10', restSec: 60 },
          { name: 'Wrist Curl', sets: 2, reps: '20', restSec: 45 },
          { name: 'Preacher Curl', sets: 3, reps: '10', restSec: 60 },
          { name: 'Triceps Kickback', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Cable Pump',
        focus: 'Constant tension',
        minutes: 30,
        exercises: [
          { name: 'Cable Curl', sets: 4, reps: '12-15', restSec: 60 },
          { name: 'Triceps Pushdown', sets: 4, reps: '12-15', restSec: 60 },
          { name: 'Incline Dumbbell Curl', sets: 3, reps: '12', restSec: 60 },
          {
            name: 'Overhead Cable Extension',
            sets: 3,
            reps: '15',
            restSec: 45,
          },
          { name: 'Reverse Curl', sets: 3, reps: '15', restSec: 45 },
          { name: 'Rope Hammer Curl', sets: 3, reps: '15', restSec: 45 },
          {
            name: 'Single-Arm Pushdown',
            sets: 3,
            reps: '15 each arm',
            restSec: 45,
          },
        ],
      },
      {
        day: 3,
        name: 'Bodyweight & Burnout',
        focus: 'Finish the week',
        minutes: 30,
        exercises: [
          { name: 'Chin-Up', sets: 4, reps: 'AMRAP', restSec: 90 },
          { name: 'Dip', sets: 4, reps: 'AMRAP', restSec: 90 },
          {
            name: 'Concentration Curl',
            sets: 3,
            reps: '12 each arm',
            restSec: 45,
          },
          { name: 'Diamond Push-Up', sets: 3, reps: 'AMRAP', restSec: 60 },
          { name: 'Preacher Curl', sets: 2, reps: '20', restSec: 45 },
          { name: 'Spider Curl', sets: 3, reps: '12', restSec: 45 },
          { name: 'Bench Dip', sets: 3, reps: 'AMRAP', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Arms are small. Your eating still is not.',
      calories: '+150 kcal over maintenance',
      proteinPerKg: 1.8,
      carbs: '3-4 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'Arms grow off the back and chest work too — do not skip the big lifts.',
        'Spread protein across four meals rather than two large ones.',
        'Six weeks is enough to add a centimetre. Do not expect five.',
      ],
    },
  },
  {
    id: 'legs-that-never-quit',
    name: 'Legs That Never Quit',
    tagline: 'Quads, hamstrings, calves. No skipping.',
    coach: 'Sparky Strength Lab',
    category: 'legs',
    level: 'advanced',
    weeks: 10,
    priceEur: 12.99,
    daysPerWeek: 4,
    minutesPerSession: 65,
    rating: 4.7,
    ratingCount: 1544,
    accentVar: '--color-cat-green',
    icon: 'exercise-weights',
    summary:
      'Four lower-body days a week for people who mean it. Squat and deadlift strength up front, unilateral work and calves in the back half, and enough hamstring volume to keep the knees honest.',
    highlights: [
      'Squat and deadlift progressions running in parallel',
      'Real calf volume, twice a week',
      'Unilateral day that fixes side-to-side gaps',
    ],
    sessions: [
      {
        day: 1,
        name: 'Squat Strength',
        focus: 'Heavy quads',
        minutes: 65,
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5', restSec: 210 },
          { name: 'Front Squat', sets: 3, reps: '6-8', restSec: 150 },
          { name: 'Leg Press', sets: 3, reps: '12', restSec: 90 },
          { name: 'Leg Extension', sets: 3, reps: '15', restSec: 60 },
          { name: 'Standing Calf Raise', sets: 4, reps: '12-15', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Hinge Strength',
        focus: 'Hamstrings and glutes',
        minutes: 60,
        exercises: [
          { name: 'Conventional Deadlift', sets: 5, reps: '3-5', restSec: 210 },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSec: 120 },
          { name: 'Lying Leg Curl', sets: 4, reps: '12', restSec: 60 },
          { name: 'Back Extension', sets: 3, reps: '15', restSec: 60 },
          { name: 'Seated Calf Raise', sets: 4, reps: '15-20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Unilateral',
        focus: 'One leg at a time',
        minutes: 55,
        exercises: [
          {
            name: 'Bulgarian Split Squat',
            sets: 4,
            reps: '8 each leg',
            restSec: 90,
          },
          { name: 'Walking Lunge', sets: 3, reps: '12 each leg', restSec: 90 },
          { name: 'Step-Up', sets: 3, reps: '10 each leg', restSec: 75 },
          {
            name: 'Single-Leg Romanian Deadlift',
            sets: 3,
            reps: '10 each leg',
            restSec: 60,
          },
          {
            name: 'Single-Leg Calf Raise',
            sets: 3,
            reps: '15 each leg',
            restSec: 45,
          },
        ],
      },
      {
        day: 4,
        name: 'Volume Legs',
        focus: 'Pump and capacity',
        minutes: 55,
        exercises: [
          { name: 'Hack Squat', sets: 4, reps: '12-15', restSec: 90 },
          { name: 'Goblet Squat', sets: 3, reps: '20', restSec: 60 },
          { name: 'Seated Leg Curl', sets: 4, reps: '15', restSec: 60 },
          { name: 'Leg Extension', sets: 3, reps: '20', restSec: 45 },
          { name: 'Standing Calf Raise', sets: 4, reps: '20', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Leg training is the biggest bill your body will send.',
      calories: '+350 kcal over maintenance',
      proteinPerKg: 2,
      carbs: '5-6 g/kg',
      fat: '1 g/kg',
      tips: [
        'Carbs are not optional here. Four leg days on low carb will bury you.',
        'Salt your food — heavy squat days sweat out more than you think.',
        'If you cannot walk on day three, you did day one wrong.',
      ],
    },
  },
  {
    id: 'shred-30',
    name: 'Shred 30',
    tagline: 'Thirty days. Thirty minutes. No excuses.',
    coach: 'Coach Tomo Rakić',
    category: 'fatLoss',
    level: 'beginner',
    weeks: 4,
    priceEur: 4.99,
    daysPerWeek: 5,
    minutesPerSession: 30,
    rating: 4.4,
    ratingCount: 8730,
    accentVar: '--color-cat-orange',
    icon: 'exercise-running',
    summary:
      'Five short circuits a week, built to burn while you keep the muscle you have. Every session pairs a strength move with a conditioning burst so the whole thing stays under thirty minutes.',
    highlights: [
      'Thirty minutes, five days a week',
      'Minimal equipment — dumbbells and a mat',
      'Strength paired with conditioning in every round',
    ],
    sessions: [
      {
        day: 1,
        name: 'Push Circuit',
        focus: 'Chest, shoulders, triceps',
        minutes: 30,
        exercises: [
          { name: 'Dumbbell Bench Press', sets: 4, reps: '12', restSec: 45 },
          { name: 'Push-Up', sets: 4, reps: 'AMRAP', restSec: 45 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '12', restSec: 45 },
          { name: 'Mountain Climber', sets: 4, reps: '40 s', restSec: 30 },
          { name: 'Triceps Pushdown', sets: 3, reps: '15', restSec: 30 },
        ],
      },
      {
        day: 2,
        name: 'Pull Circuit',
        focus: 'Back and biceps',
        minutes: 30,
        exercises: [
          { name: 'Dumbbell Row', sets: 4, reps: '12 each side', restSec: 45 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 45 },
          { name: 'Face Pull', sets: 3, reps: '15', restSec: 30 },
          { name: 'Battle Rope Wave', sets: 4, reps: '30 s', restSec: 30 },
          { name: 'Hammer Curl', sets: 3, reps: '15', restSec: 30 },
        ],
      },
      {
        day: 3,
        name: 'Lower Circuit',
        focus: 'Legs and glutes',
        minutes: 30,
        exercises: [
          { name: 'Goblet Squat', sets: 4, reps: '15', restSec: 45 },
          { name: 'Romanian Deadlift', sets: 4, reps: '12', restSec: 45 },
          { name: 'Walking Lunge', sets: 3, reps: '12 each leg', restSec: 45 },
          { name: 'Jump Squat', sets: 4, reps: '20 s', restSec: 40 },
          { name: 'Glute Bridge', sets: 3, reps: '20', restSec: 30 },
        ],
      },
      {
        day: 4,
        name: 'Conditioning',
        focus: 'Heart rate',
        minutes: 30,
        exercises: [
          { name: 'Rowing Machine', sets: 6, reps: '250 m', restSec: 60 },
          { name: 'Kettlebell Swing', sets: 5, reps: '20', restSec: 45 },
          { name: 'Burpee', sets: 4, reps: '10', restSec: 45 },
          { name: 'Jump Rope', sets: 4, reps: '60 s', restSec: 30 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 30 },
        ],
      },
      {
        day: 5,
        name: 'Full Body Finisher',
        focus: 'Everything, once more',
        minutes: 30,
        exercises: [
          { name: 'Dumbbell Thruster', sets: 4, reps: '12', restSec: 45 },
          { name: 'Renegade Row', sets: 3, reps: '10 each side', restSec: 45 },
          { name: 'Reverse Lunge', sets: 3, reps: '12 each leg', restSec: 45 },
          { name: 'Russian Twist', sets: 3, reps: '20', restSec: 30 },
          { name: 'Burpee', sets: 3, reps: '10', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'A deficit you can actually hold for a month.',
      calories: '-400 kcal under maintenance',
      proteinPerKg: 2.2,
      carbs: '2-3 g/kg',
      fat: '0.8 g/kg',
      tips: [
        'High protein is what keeps the weight you lose from being muscle.',
        'Vegetables and water do the heavy lifting on hunger.',
        'One planned meal out per week. Restriction you hate does not last.',
      ],
    },
  },
  {
    id: 'lean-machine',
    name: 'Lean Machine',
    tagline: 'Lose the fat. Keep the strength.',
    coach: 'Coach Mara Ilić',
    category: 'fatLoss',
    level: 'intermediate',
    weeks: 12,
    priceEur: 14.99,
    daysPerWeek: 4,
    minutesPerSession: 50,
    rating: 4.8,
    ratingCount: 5296,
    accentVar: '--color-hydration',
    icon: 'exercise-running',
    summary:
      'A twelve-week cut that keeps heavy compound lifting at the centre. Cardio is prescribed, not guessed, and the lifting stays heavy so what you lose is fat rather than the muscle underneath.',
    highlights: [
      'Heavy lifting maintained through the whole deficit',
      'Prescribed cardio, rising only when progress stalls',
      'Built-in diet break at week 6',
    ],
    sessions: [
      {
        day: 1,
        name: 'Upper Strength',
        focus: 'Keep the pressing',
        minutes: 50,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '5', restSec: 150 },
          { name: 'Barbell Row', sets: 4, reps: '6-8', restSec: 120 },
          { name: 'Overhead Press', sets: 3, reps: '8', restSec: 90 },
          { name: 'Lat Pulldown', sets: 3, reps: '12', restSec: 60 },
          { name: 'Incline Walk', sets: 1, reps: '15 min', restSec: 0 },
        ],
      },
      {
        day: 2,
        name: 'Lower Strength',
        focus: 'Keep the squat',
        minutes: 50,
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '5', restSec: 180 },
          { name: 'Romanian Deadlift', sets: 3, reps: '8', restSec: 120 },
          { name: 'Leg Press', sets: 3, reps: '12', restSec: 90 },
          { name: 'Seated Leg Curl', sets: 3, reps: '12', restSec: 60 },
          { name: 'Incline Walk', sets: 1, reps: '15 min', restSec: 0 },
        ],
      },
      {
        day: 3,
        name: 'Upper Volume',
        focus: 'Density work',
        minutes: 45,
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            sets: 4,
            reps: '10-12',
            restSec: 75,
          },
          { name: 'Seated Cable Row', sets: 4, reps: '12', restSec: 75 },
          { name: 'Lateral Raise', sets: 3, reps: '15', restSec: 45 },
          { name: 'Cable Curl', sets: 3, reps: '15', restSec: 45 },
          { name: 'Triceps Pushdown', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Conditioning',
        focus: 'Calories out',
        minutes: 45,
        exercises: [
          { name: 'Rowing Machine', sets: 8, reps: '300 m', restSec: 60 },
          { name: 'Kettlebell Swing', sets: 4, reps: '20', restSec: 60 },
          { name: 'Farmer Carry', sets: 4, reps: '40 m', restSec: 60 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
          { name: 'Incline Walk', sets: 1, reps: '20 min', restSec: 0 },
        ],
      },
    ],
    nutrition: {
      headline: 'Slow is the point. Fast cuts cost muscle.',
      calories: '-500 kcal under maintenance',
      proteinPerKg: 2.2,
      carbs: '3 g/kg, most of it around training',
      fat: '0.7-0.8 g/kg',
      tips: [
        'Target 0.5-0.7% of bodyweight lost per week. Faster is not better.',
        'Week 6 is a full diet break at maintenance — take it, do not skip it.',
        'If lifts drop two sessions running, eat more before adding cardio.',
      ],
    },
  },
  {
    id: 'powerhouse-5x5',
    name: 'Powerhouse 5×5',
    tagline: 'The oldest answer still works.',
    coach: 'Sparky Strength Lab',
    category: 'strength',
    level: 'beginner',
    weeks: 12,
    priceEur: 14.99,
    daysPerWeek: 3,
    minutesPerSession: 60,
    rating: 4.9,
    ratingCount: 9614,
    accentVar: '--color-cat-slate',
    icon: 'exercise-weights',
    summary:
      'Five sets of five on the lifts that matter, three days a week, adding weight every session you complete. Boring, proven, and the fastest strength you will ever buy as a novice.',
    highlights: [
      'Linear progression — add weight every session',
      'Two alternating workouts, three days a week',
      'Built-in deload rule when you stall twice',
    ],
    sessions: [
      {
        day: 1,
        name: 'Workout A',
        focus: 'Squat, bench, row',
        minutes: 60,
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5', restSec: 180 },
          { name: 'Barbell Bench Press', sets: 5, reps: '5', restSec: 180 },
          { name: 'Barbell Row', sets: 5, reps: '5', restSec: 150 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 60 },
          { name: 'Face Pull', sets: 3, reps: '15', restSec: 45 },
          { name: 'Triceps Pushdown', sets: 3, reps: '12', restSec: 60 },
          { name: 'Standing Calf Raise', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Workout B',
        focus: 'Squat, press, deadlift',
        minutes: 60,
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5', restSec: 180 },
          { name: 'Overhead Press', sets: 5, reps: '5', restSec: 180 },
          { name: 'Conventional Deadlift', sets: 1, reps: '5', restSec: 240 },
          { name: 'Chin-Up', sets: 3, reps: 'AMRAP', restSec: 90 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
          { name: 'Barbell Curl', sets: 3, reps: '10', restSec: 60 },
          { name: 'Back Extension', sets: 3, reps: '12', restSec: 60 },
        ],
      },
      {
        day: 3,
        name: 'Workout A (heavier)',
        focus: 'Repeat and add weight',
        minutes: 60,
        exercises: [
          {
            name: 'Barbell Back Squat',
            sets: 5,
            reps: '5',
            restSec: 180,
            note: '+2.5 kg on last session.',
          },
          {
            name: 'Barbell Bench Press',
            sets: 5,
            reps: '5',
            restSec: 180,
            note: '+2.5 kg on last session.',
          },
          { name: 'Barbell Row', sets: 5, reps: '5', restSec: 150 },
          { name: 'Dip', sets: 3, reps: 'AMRAP', restSec: 90 },
          { name: 'Back Extension', sets: 3, reps: '12', restSec: 60 },
          { name: 'Lateral Raise', sets: 3, reps: '15', restSec: 45 },
          { name: 'Farmer Carry', sets: 3, reps: '40 m', restSec: 75 },
        ],
      },
    ],
    nutrition: {
      headline: 'Novice strength runs on food and sleep.',
      calories: '+300 kcal over maintenance',
      proteinPerKg: 1.8,
      carbs: '4-5 g/kg',
      fat: '1 g/kg',
      tips: [
        'If the bar stops moving up, the first thing to check is your eating.',
        'Milk, rice, oats and eggs will get most novices where they need to be.',
        'Stall twice on a lift, drop it 10% and climb again.',
      ],
    },
  },
  {
    id: 'deadlift-domination',
    name: 'Deadlift Domination',
    tagline: 'Pull a number you will brag about.',
    coach: 'Coach Tomo Rakić',
    category: 'strength',
    level: 'advanced',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 3,
    minutesPerSession: 65,
    rating: 4.7,
    ratingCount: 1289,
    accentVar: '--color-pr',
    icon: 'exercise-weights',
    summary:
      'Eight weeks aimed at one number. Heavy pulls, deficit and paused variations for the positions you are weak in, and accessory work chosen to fix the failure point rather than fill time.',
    highlights: [
      'Weekly heavy single with an RPE cap',
      'Deficit and pause work for off-the-floor speed',
      'Peaking week with a planned test day',
    ],
    sessions: [
      {
        day: 1,
        name: 'Heavy Pull',
        focus: 'Top-end strength',
        minutes: 65,
        exercises: [
          { name: 'Conventional Deadlift', sets: 5, reps: '3', restSec: 240 },
          { name: 'Rack Pull', sets: 3, reps: '5', restSec: 180 },
          { name: 'Barbell Row', sets: 4, reps: '8', restSec: 120 },
          { name: 'Back Extension', sets: 3, reps: '12', restSec: 60 },
          { name: 'Farmer Carry', sets: 3, reps: '40 m', restSec: 90 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
          { name: 'Standing Calf Raise', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Position Work',
        focus: 'Off the floor',
        minutes: 60,
        exercises: [
          { name: 'Deficit Deadlift', sets: 4, reps: '5', restSec: 180 },
          {
            name: 'Paused Deadlift',
            sets: 3,
            reps: '3',
            restSec: 180,
            note: 'Two-second pause below the knee.',
          },
          { name: 'Front Squat', sets: 3, reps: '6', restSec: 150 },
          { name: 'Chest-Supported Row', sets: 3, reps: '12', restSec: 75 },
          { name: 'Pallof Press', sets: 3, reps: '12 each side', restSec: 60 },
          { name: 'Good Morning', sets: 3, reps: '8', restSec: 120 },
          { name: 'Hanging Leg Raise', sets: 3, reps: '10', restSec: 60 },
        ],
      },
      {
        day: 3,
        name: 'Volume & Grip',
        focus: 'Capacity',
        minutes: 55,
        exercises: [
          { name: 'Romanian Deadlift', sets: 4, reps: '8', restSec: 120 },
          { name: 'Barbell Hip Thrust', sets: 3, reps: '10', restSec: 90 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 75 },
          {
            name: 'Suitcase Carry',
            sets: 3,
            reps: '30 m each side',
            restSec: 75,
          },
          { name: 'Plate Pinch Hold', sets: 3, reps: '30 s', restSec: 60 },
          { name: 'Seated Leg Curl', sets: 3, reps: '12', restSec: 60 },
          { name: 'Ab Wheel Rollout', sets: 3, reps: '10', restSec: 60 },
        ],
      },
    ],
    nutrition: {
      headline: 'Peak weeks are fuelled, not fasted.',
      calories: 'Maintenance to +200 kcal',
      proteinPerKg: 1.9,
      carbs: '5 g/kg, higher the day before heavy pulls',
      fat: '1 g/kg',
      tips: [
        'Carb up the evening before the heavy day, not two hours before.',
        'Caffeine 200 mg, 45 minutes out, on heavy days only.',
        'Test day: eat normally. Novel foods on a PR day is a rookie error.',
      ],
    },
  },
  {
    id: 'first-pull-up',
    name: 'Your First Pull-Up',
    tagline: 'From zero to one. Then to ten.',
    coach: 'Coach Mara Ilić',
    category: 'beginner',
    level: 'beginner',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 3,
    minutesPerSession: 30,
    rating: 4.9,
    ratingCount: 6427,
    accentVar: '--color-cat-green',
    icon: 'exercise-weights',
    summary:
      'A structured path to the first strict pull-up: negatives to build the eccentric, band-assisted reps for volume, and scapular work so the shoulder learns the position before it takes the load.',
    highlights: [
      'Negatives, holds and assisted reps in a fixed progression',
      'Thirty minutes, three times a week',
      'Needs only a bar and one band',
    ],
    sessions: [
      {
        day: 1,
        name: 'Negatives',
        focus: 'Eccentric strength',
        minutes: 30,
        exercises: [
          {
            name: 'Pull-Up Negative',
            sets: 5,
            reps: '3 (5 s down)',
            restSec: 120,
          },
          { name: 'Scapular Pull-Up', sets: 3, reps: '8', restSec: 60 },
          { name: 'Inverted Row', sets: 3, reps: '10', restSec: 60 },
          { name: 'Dead Hang', sets: 3, reps: '30 s', restSec: 60 },
          { name: 'Hollow Body Hold', sets: 3, reps: '30 s', restSec: 45 },
          { name: 'Band Pull-Apart', sets: 3, reps: '20', restSec: 45 },
          { name: 'Dumbbell Row', sets: 3, reps: '10 each side', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Assisted Volume',
        focus: 'Groove the pattern',
        minutes: 30,
        exercises: [
          { name: 'Band-Assisted Pull-Up', sets: 4, reps: '6-8', restSec: 90 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 60 },
          { name: 'Seated Cable Row', sets: 3, reps: '12', restSec: 60 },
          { name: 'Hammer Curl', sets: 3, reps: '12', restSec: 45 },
          { name: 'Face Pull', sets: 3, reps: '15', restSec: 45 },
          { name: 'Straight-Arm Pulldown', sets: 3, reps: '15', restSec: 45 },
          { name: 'Plank', sets: 3, reps: '40 s', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Test & Support',
        focus: 'Try for the rep',
        minutes: 30,
        exercises: [
          {
            name: 'Pull-Up',
            sets: 5,
            reps: 'AMRAP',
            restSec: 150,
            note: 'Even if AMRAP is zero. Try every week.',
          },
          { name: 'Inverted Row', sets: 4, reps: '12', restSec: 60 },
          { name: 'Dumbbell Row', sets: 3, reps: '12 each side', restSec: 60 },
          { name: 'Dead Hang', sets: 3, reps: '40 s', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 45 },
          { name: 'Scapular Pull-Up', sets: 3, reps: '8', restSec: 60 },
          { name: 'Biceps Curl', sets: 3, reps: '12', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Strength-to-weight is the whole game.',
      calories: 'Maintenance, or a small deficit if you are carrying extra',
      proteinPerKg: 1.8,
      carbs: '3-4 g/kg',
      fat: '0.8 g/kg',
      tips: [
        'Every kilogram you are not carrying is a kilogram you do not pull.',
        'Do not crash diet — you need the strength you are building.',
        'Grip fails before the back does. Eat and sleep enough to recover it.',
      ],
    },
  },
  {
    id: 'couch-to-confident',
    name: 'Couch to Confident',
    tagline: 'Week one starts where you are.',
    coach: 'Coach Tomo Rakić',
    category: 'beginner',
    level: 'beginner',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 3,
    minutesPerSession: 35,
    rating: 4.8,
    ratingCount: 11208,
    accentVar: '--color-exercise',
    icon: 'exercise-walking',
    summary:
      'For a genuine first-timer. Machines and bodyweight before free weights, three sessions a week, and a walking target that builds the habit as much as the fitness.',
    highlights: [
      'No barbell until week five',
      'Every session under 35 minutes',
      'Daily step target alongside the lifting',
    ],
    sessions: [
      {
        day: 1,
        name: 'Full Body A',
        focus: 'Learn the patterns',
        minutes: 35,
        exercises: [
          { name: 'Goblet Squat', sets: 3, reps: '10', restSec: 90 },
          { name: 'Chest Press Machine', sets: 3, reps: '12', restSec: 75 },
          { name: 'Seated Cable Row', sets: 3, reps: '12', restSec: 75 },
          { name: 'Glute Bridge', sets: 3, reps: '15', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '20 s', restSec: 45 },
          { name: 'Standing Calf Raise', sets: 2, reps: '15', restSec: 45 },
          { name: 'Incline Walk', sets: 1, reps: '10 min', restSec: 0 },
        ],
      },
      {
        day: 2,
        name: 'Full Body B',
        focus: 'Add a little load',
        minutes: 35,
        exercises: [
          { name: 'Leg Press', sets: 3, reps: '12', restSec: 90 },
          { name: 'Lat Pulldown', sets: 3, reps: '12', restSec: 75 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10', restSec: 75 },
          {
            name: 'Romanian Deadlift',
            sets: 3,
            reps: '10',
            restSec: 75,
            note: 'Dumbbells. Light. Feel the hamstrings.',
          },
          { name: 'Dead Bug', sets: 3, reps: '8 each side', restSec: 45 },
          { name: 'Seated Abduction', sets: 3, reps: '15', restSec: 45 },
          { name: 'Plank', sets: 3, reps: '20 s', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Full Body C',
        focus: 'Put it together',
        minutes: 35,
        exercises: [
          { name: 'Dumbbell Bench Press', sets: 3, reps: '12', restSec: 75 },
          { name: 'Dumbbell Row', sets: 3, reps: '12 each side', restSec: 75 },
          { name: 'Step-Up', sets: 3, reps: '10 each leg', restSec: 60 },
          { name: 'Incline Walk', sets: 1, reps: '12 min', restSec: 0 },
          { name: 'Side Plank', sets: 3, reps: '20 s each side', restSec: 45 },
          { name: 'Leg Press', sets: 3, reps: '12', restSec: 75 },
          { name: 'Face Pull', sets: 3, reps: '15', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Change one thing at a time.',
      calories: 'Maintenance for the first four weeks',
      proteinPerKg: 1.6,
      carbs: 'No target — eat normally, just eat protein first',
      fat: 'No target',
      tips: [
        'Add protein before you subtract anything. It is the easiest first win.',
        'Aim for 7,000 steps a day before you worry about macros.',
        'Three sessions completed beats five planned. Consistency is the metric.',
      ],
    },
  },
  {
    id: 'desk-job-recovery',
    name: 'Desk Job Recovery',
    tagline: 'Undo eight hours in twenty minutes.',
    coach: 'Coach Mara Ilić',
    category: 'mobility',
    level: 'beginner',
    weeks: 6,
    priceEur: 7.99,
    daysPerWeek: 5,
    minutesPerSession: 20,
    rating: 4.6,
    ratingCount: 7311,
    accentVar: '--color-wellness-follicular',
    icon: 'exercise-yoga',
    summary:
      'Built for people whose hips and thoracic spine have been folded into a chair all day. Opens the front, strengthens the back, and takes twenty minutes you can do without changing clothes.',
    highlights: [
      'Twenty minutes, no equipment beyond a mat and a band',
      'Hip flexor and thoracic focus',
      'Can be done daily without interfering with lifting',
    ],
    sessions: [
      {
        day: 1,
        name: 'Hips',
        focus: 'Open the front',
        minutes: 20,
        exercises: [
          {
            name: 'Couch Stretch',
            sets: 2,
            reps: '60 s each side',
            restSec: 30,
          },
          {
            name: 'Half-Kneeling Hip Flexor Stretch',
            sets: 2,
            reps: '45 s each side',
            restSec: 30,
          },
          { name: '90/90 Hip Switch', sets: 3, reps: '10', restSec: 30 },
          { name: 'Glute Bridge', sets: 3, reps: '15', restSec: 30 },
          { name: 'Dead Bug', sets: 3, reps: '8 each side', restSec: 30 },
        ],
      },
      {
        day: 2,
        name: 'Thoracic Spine',
        focus: 'Rotate and extend',
        minutes: 20,
        exercises: [
          {
            name: 'Thoracic Extension over Foam Roller',
            sets: 3,
            reps: '10',
            restSec: 30,
          },
          {
            name: 'Open Book Rotation',
            sets: 3,
            reps: '10 each side',
            restSec: 30,
          },
          { name: 'Cat-Cow', sets: 3, reps: '10', restSec: 30 },
          { name: 'Band Pull-Apart', sets: 3, reps: '20', restSec: 30 },
          { name: 'Wall Slide', sets: 3, reps: '12', restSec: 30 },
        ],
      },
      {
        day: 3,
        name: 'Neck & Shoulders',
        focus: 'Undo the screen lean',
        minutes: 20,
        exercises: [
          { name: 'Chin Tuck', sets: 3, reps: '12', restSec: 30 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
          { name: 'Prone Y-Raise', sets: 3, reps: '12', restSec: 30 },
          {
            name: 'Doorway Pec Stretch',
            sets: 2,
            reps: '45 s each side',
            restSec: 30,
          },
          { name: 'Scapular Pull-Up', sets: 3, reps: '8', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Lower Back',
        focus: 'Calm and strengthen',
        minutes: 20,
        exercises: [
          { name: 'Bird Dog', sets: 3, reps: '10 each side', restSec: 30 },
          { name: 'Side Plank', sets: 3, reps: '30 s each side', restSec: 30 },
          { name: 'Back Extension', sets: 3, reps: '12', restSec: 45 },
          { name: 'Child’s Pose', sets: 2, reps: '60 s', restSec: 20 },
          {
            name: 'Knee-to-Chest Stretch',
            sets: 2,
            reps: '45 s each side',
            restSec: 20,
          },
        ],
      },
      {
        day: 5,
        name: 'Full Reset',
        focus: 'Everything, lightly',
        minutes: 20,
        exercises: [
          {
            name: 'World’s Greatest Stretch',
            sets: 3,
            reps: '5 each side',
            restSec: 30,
          },
          { name: 'Deep Squat Hold', sets: 3, reps: '45 s', restSec: 45 },
          {
            name: 'Open Book Rotation',
            sets: 2,
            reps: '10 each side',
            restSec: 30,
          },
          { name: 'Glute Bridge', sets: 3, reps: '15', restSec: 30 },
          { name: 'Dead Hang', sets: 3, reps: '30 s', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Mobility work does not need a diet. It needs water.',
      calories: 'Maintenance',
      proteinPerKg: 1.6,
      carbs: 'No target',
      fat: 'No target',
      tips: [
        'Dehydrated tissue moves badly. 35 ml per kg of bodyweight, daily.',
        'Magnesium in the evening helps if you cramp during long holds.',
        'Do not stretch hard first thing — give the spine an hour after waking.',
      ],
    },
  },
  {
    id: 'morning-mobility-reset',
    name: 'Morning Mobility Reset',
    tagline: 'Ten minutes before the day owns you.',
    coach: 'Coach Mara Ilić',
    category: 'mobility',
    level: 'beginner',
    weeks: 4,
    priceEur: 4.99,
    daysPerWeek: 6,
    minutesPerSession: 12,
    rating: 4.5,
    ratingCount: 3944,
    accentVar: '--color-macro-carbs',
    icon: 'exercise-yoga',
    summary:
      'Six short flows, one for each morning, that wake the hips, spine and shoulders without leaving you tired. Designed to be done in pyjamas before coffee.',
    highlights: [
      'Twelve minutes, no equipment at all',
      'Six different flows so it never gets stale',
      'Safe to do on rest days and training days alike',
    ],
    sessions: [
      {
        day: 1,
        name: 'Spine Flow',
        focus: 'Wake the back up',
        minutes: 12,
        exercises: [
          { name: 'Cat-Cow', sets: 2, reps: '12', restSec: 20 },
          {
            name: 'Open Book Rotation',
            sets: 2,
            reps: '8 each side',
            restSec: 20,
          },
          { name: 'Child’s Pose', sets: 2, reps: '45 s', restSec: 20 },
          { name: 'Bird Dog', sets: 2, reps: '8 each side', restSec: 20 },
          { name: 'Standing Forward Fold', sets: 2, reps: '30 s', restSec: 20 },
        ],
      },
      {
        day: 2,
        name: 'Hip Flow',
        focus: 'Loosen the hinge',
        minutes: 12,
        exercises: [
          { name: '90/90 Hip Switch', sets: 3, reps: '8', restSec: 20 },
          { name: 'Deep Squat Hold', sets: 2, reps: '45 s', restSec: 20 },
          {
            name: 'Half-Kneeling Hip Flexor Stretch',
            sets: 2,
            reps: '40 s each side',
            restSec: 20,
          },
          { name: 'Glute Bridge', sets: 2, reps: '15', restSec: 20 },
          { name: 'Leg Swing', sets: 2, reps: '12 each leg', restSec: 20 },
        ],
      },
      {
        day: 3,
        name: 'Shoulder Flow',
        focus: 'Overhead room',
        minutes: 12,
        exercises: [
          { name: 'Wall Slide', sets: 3, reps: '10', restSec: 20 },
          { name: 'Band Pull-Apart', sets: 3, reps: '20', restSec: 20 },
          {
            name: 'Doorway Pec Stretch',
            sets: 2,
            reps: '40 s each side',
            restSec: 20,
          },
          { name: 'Prone Y-Raise', sets: 2, reps: '12', restSec: 20 },
          {
            name: 'Arm Circle',
            sets: 2,
            reps: '15 each direction',
            restSec: 20,
          },
        ],
      },
      {
        day: 4,
        name: 'Ankle & Foot',
        focus: 'The base',
        minutes: 12,
        exercises: [
          {
            name: 'Ankle Dorsiflexion Rock',
            sets: 3,
            reps: '12 each side',
            restSec: 20,
          },
          {
            name: 'Calf Stretch',
            sets: 2,
            reps: '45 s each side',
            restSec: 20,
          },
          {
            name: 'Single-Leg Calf Raise',
            sets: 2,
            reps: '12 each leg',
            restSec: 30,
          },
          { name: 'Toe Yoga', sets: 2, reps: '10 each foot', restSec: 20 },
          { name: 'Deep Squat Hold', sets: 2, reps: '40 s', restSec: 20 },
        ],
      },
      {
        day: 5,
        name: 'Full Flow',
        focus: 'Head to toe',
        minutes: 12,
        exercises: [
          {
            name: 'World’s Greatest Stretch',
            sets: 3,
            reps: '5 each side',
            restSec: 20,
          },
          { name: 'Cat-Cow', sets: 2, reps: '10', restSec: 20 },
          { name: 'Deep Squat Hold', sets: 2, reps: '45 s', restSec: 20 },
          { name: 'Wall Slide', sets: 2, reps: '10', restSec: 20 },
          { name: 'Standing Forward Fold', sets: 2, reps: '30 s', restSec: 20 },
        ],
      },
      {
        day: 6,
        name: 'Easy Day',
        focus: 'Breathe and unwind',
        minutes: 10,
        exercises: [
          {
            name: 'Diaphragmatic Breathing',
            sets: 3,
            reps: '10 breaths',
            restSec: 20,
          },
          { name: 'Child’s Pose', sets: 2, reps: '60 s', restSec: 20 },
          {
            name: 'Supine Twist',
            sets: 2,
            reps: '45 s each side',
            restSec: 20,
          },
          { name: 'Legs-Up-the-Wall', sets: 1, reps: '3 min', restSec: 0 },
          {
            name: 'Knee-to-Chest Stretch',
            sets: 2,
            reps: '40 s each side',
            restSec: 20,
          },
        ],
      },
    ],
    nutrition: {
      headline: 'Nothing to change. Just drink before you caffeinate.',
      calories: 'Maintenance',
      proteinPerKg: 1.6,
      carbs: 'No target',
      fat: 'No target',
      tips: [
        'A glass of water before coffee — you wake up mildly dehydrated.',
        'Eat within two hours of waking on training days.',
        'This program is additive. It replaces nothing else you are doing.',
      ],
    },
  },
  {
    id: 'hourglass-sculpt',
    name: 'Hourglass Sculpt',
    tagline: 'Shoulders, waist, glutes. In proportion.',
    coach: 'Coach Mara Ilić',
    category: 'glutes',
    level: 'intermediate',
    weeks: 10,
    priceEur: 12.99,
    daysPerWeek: 4,
    minutesPerSession: 50,
    rating: 4.8,
    ratingCount: 5877,
    accentVar: '--color-wellness-pregnant',
    icon: 'exercise-weights',
    summary:
      'Shape is a ratio, not a number. This program builds the delts and glutes that widen the top and bottom, trains the waist for tightness rather than size, and leaves the obliques alone.',
    highlights: [
      'Delt and glute emphasis for the classic ratio',
      'Waist trained with vacuums and anti-rotation, not weighted twists',
      'Four sessions, all under an hour',
    ],
    sessions: [
      {
        day: 1,
        name: 'Glutes & Hamstrings',
        focus: 'The bottom of the shape',
        minutes: 50,
        exercises: [
          { name: 'Barbell Hip Thrust', sets: 4, reps: '8-10', restSec: 120 },
          { name: 'Romanian Deadlift', sets: 4, reps: '10', restSec: 90 },
          { name: 'Cable Kickback', sets: 3, reps: '15 each leg', restSec: 45 },
          { name: 'Seated Abduction', sets: 4, reps: '20', restSec: 45 },
          { name: 'Seated Leg Curl', sets: 3, reps: '12', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Shoulders & Back',
        focus: 'The top of the shape',
        minutes: 50,
        exercises: [
          { name: 'Seated Dumbbell Press', sets: 4, reps: '10', restSec: 90 },
          { name: 'Lateral Raise', sets: 5, reps: '15', restSec: 45 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 75 },
          { name: 'Reverse Pec Deck', sets: 3, reps: '15', restSec: 45 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Glute Volume',
        focus: 'More of the good stuff',
        minutes: 45,
        exercises: [
          {
            name: 'Bulgarian Split Squat',
            sets: 4,
            reps: '10 each leg',
            restSec: 75,
          },
          { name: 'Cable Pull-Through', sets: 4, reps: '15', restSec: 60 },
          { name: 'Glute Bridge', sets: 3, reps: '20', restSec: 45 },
          {
            name: 'Banded Lateral Walk',
            sets: 3,
            reps: '20 steps',
            restSec: 45,
          },
          { name: 'Step-Up', sets: 3, reps: '12 each leg', restSec: 60 },
        ],
      },
      {
        day: 4,
        name: 'Waist & Upper',
        focus: 'Tighten, do not thicken',
        minutes: 40,
        exercises: [
          { name: 'Stomach Vacuum', sets: 4, reps: '20 s', restSec: 45 },
          { name: 'Pallof Press', sets: 4, reps: '12 each side', restSec: 45 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '12', restSec: 60 },
          { name: 'Lateral Raise', sets: 4, reps: '20', restSec: 45 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Recomposition: eat at maintenance and be patient.',
      calories: 'Maintenance, +150 kcal on lower-body days',
      proteinPerKg: 2,
      carbs: '3-4 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'The scale will barely move. Use the tape measure and photos instead.',
        'Ten weeks is the minimum before you judge this. Do not bail at four.',
        'Heavy weighted side bends thicken the waist. They are not in here for a reason.',
      ],
    },
  },
  {
    id: 'athletes-engine',
    name: "Athlete's Engine",
    tagline: 'Last longer than everyone on the pitch.',
    coach: 'Coach Tomo Rakić',
    category: 'fullBody',
    level: 'advanced',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 5,
    minutesPerSession: 45,
    rating: 4.6,
    ratingCount: 1122,
    accentVar: '--color-calories',
    icon: 'exercise-running',
    summary:
      'Aerobic base, repeat-sprint ability and enough lifting to stay powerful. Built for field-sport athletes in the off-season who need the engine without losing the strength.',
    highlights: [
      'Zone 2 base work alongside sprint intervals',
      'Two lifting days kept heavy and short',
      'Weekly test to see the engine actually growing',
    ],
    sessions: [
      {
        day: 1,
        name: 'Aerobic Base',
        focus: 'Zone 2',
        minutes: 45,
        exercises: [
          {
            name: 'Rowing Machine',
            sets: 1,
            reps: '30 min',
            restSec: 0,
            note: 'Conversational pace. Nose breathing if you can.',
          },
          { name: 'Farmer Carry', sets: 3, reps: '50 m', restSec: 90 },
          { name: 'Plank', sets: 3, reps: '60 s', restSec: 45 },
          { name: 'Bird Dog', sets: 3, reps: '10 each side', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Lower Power',
        focus: 'Force and speed',
        minutes: 45,
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '4', restSec: 180 },
          { name: 'Box Jump', sets: 5, reps: '3', restSec: 90 },
          { name: 'Romanian Deadlift', sets: 3, reps: '8', restSec: 120 },
          { name: 'Nordic Hamstring Curl', sets: 3, reps: '6', restSec: 90 },
          { name: 'Standing Calf Raise', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Repeat Sprints',
        focus: 'Recover fast',
        minutes: 40,
        exercises: [
          { name: 'Sprint', sets: 10, reps: '30 m', restSec: 60 },
          { name: 'Sled Push', sets: 5, reps: '20 m', restSec: 90 },
          { name: 'Lateral Bound', sets: 4, reps: '8 each side', restSec: 60 },
          { name: 'Dead Bug', sets: 3, reps: '10 each side', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Upper Power',
        focus: 'Push and pull',
        minutes: 45,
        exercises: [
          { name: 'Push Press', sets: 4, reps: '4', restSec: 180 },
          { name: 'Weighted Pull-Up', sets: 4, reps: '5', restSec: 150 },
          { name: 'Medicine Ball Chest Pass', sets: 4, reps: '6', restSec: 90 },
          { name: 'Barbell Row', sets: 3, reps: '8', restSec: 90 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 5,
        name: 'Tempo & Test',
        focus: 'Measure the engine',
        minutes: 40,
        exercises: [
          {
            name: 'Rowing Machine',
            sets: 1,
            reps: '2000 m for time',
            restSec: 0,
            note: 'Log it. This is the weekly benchmark.',
          },
          { name: 'Kettlebell Swing', sets: 4, reps: '20', restSec: 60 },
          { name: 'Burpee', sets: 4, reps: '12', restSec: 60 },
          { name: 'Side Plank', sets: 3, reps: '45 s each side', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Five sessions a week is a lot of fuel.',
      calories: '+300 kcal over maintenance',
      proteinPerKg: 1.9,
      carbs: '6 g/kg',
      fat: '1 g/kg',
      tips: [
        'Carbs are the fuel for the sprint days. Under-eating them kills recovery.',
        'Electrolytes on sprint and rowing days, not just water.',
        'If the 2 km test slows two weeks running, you are under-recovered.',
      ],
    },
  },
  {
    id: 'home-gym-hero',
    name: 'Home Gym Hero',
    tagline: 'A bench, some dumbbells, no excuses.',
    coach: 'Coach Tomo Rakić',
    category: 'fullBody',
    level: 'beginner',
    weeks: 8,
    priceEur: 9.99,
    daysPerWeek: 4,
    minutesPerSession: 40,
    rating: 4.7,
    ratingCount: 6208,
    accentVar: '--color-cat-blue',
    icon: 'exercise-weights',
    summary:
      'Everything here needs one adjustable bench, a pair of dumbbells and a pull-up bar. Upper/lower split, four days a week, and progressions that keep working as the dumbbells get light.',
    highlights: [
      'Dumbbells and a bench are the entire equipment list',
      'Upper/lower split across four days',
      'Tempo and unilateral progressions when weight runs out',
    ],
    sessions: [
      {
        day: 1,
        name: 'Upper A',
        focus: 'Press and row',
        minutes: 40,
        exercises: [
          { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', restSec: 90 },
          { name: 'Dumbbell Row', sets: 4, reps: '10 each side', restSec: 75 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10', restSec: 75 },
          { name: 'Chin-Up', sets: 3, reps: 'AMRAP', restSec: 90 },
          { name: 'Hammer Curl', sets: 3, reps: '12', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Lower A',
        focus: 'Squat pattern',
        minutes: 40,
        exercises: [
          { name: 'Goblet Squat', sets: 4, reps: '12', restSec: 90 },
          {
            name: 'Bulgarian Split Squat',
            sets: 3,
            reps: '10 each leg',
            restSec: 75,
          },
          {
            name: 'Dumbbell Romanian Deadlift',
            sets: 4,
            reps: '10',
            restSec: 75,
          },
          { name: 'Glute Bridge', sets: 3, reps: '20', restSec: 45 },
          { name: 'Standing Calf Raise', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Upper B',
        focus: 'Volume and angles',
        minutes: 40,
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            sets: 4,
            reps: '10-12',
            restSec: 75,
          },
          { name: 'Pull-Up', sets: 4, reps: 'AMRAP', restSec: 90 },
          { name: 'Lateral Raise', sets: 4, reps: '15', restSec: 45 },
          { name: 'Dumbbell Fly', sets: 3, reps: '12', restSec: 60 },
          {
            name: 'Overhead Triceps Extension',
            sets: 3,
            reps: '12',
            restSec: 45,
          },
        ],
      },
      {
        day: 4,
        name: 'Lower B',
        focus: 'Hinge and single leg',
        minutes: 40,
        exercises: [
          {
            name: 'Dumbbell Romanian Deadlift',
            sets: 4,
            reps: '12',
            restSec: 90,
          },
          { name: 'Reverse Lunge', sets: 4, reps: '10 each leg', restSec: 75 },
          { name: 'Step-Up', sets: 3, reps: '12 each leg', restSec: 60 },
          {
            name: 'Single-Leg Calf Raise',
            sets: 3,
            reps: '15 each leg',
            restSec: 45,
          },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Home training fails on food, not on equipment.',
      calories: '+200 kcal over maintenance',
      proteinPerKg: 1.8,
      carbs: '3-4 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'Training at home means the fridge is ten steps away. Plan meals.',
        'Protein target first; the rest of the diet can stay flexible.',
        'When the dumbbells get light, slow the eccentric to five seconds.',
      ],
    },
  },
  {
    id: 'kettlebell-forge',
    name: 'Kettlebell Forge',
    tagline: 'One bell. Whole body. Forty minutes.',
    coach: 'Sparky Strength Lab',
    category: 'fullBody',
    level: 'intermediate',
    weeks: 6,
    priceEur: 7.99,
    daysPerWeek: 4,
    minutesPerSession: 40,
    rating: 4.6,
    ratingCount: 2033,
    accentVar: '--color-cat-amber',
    icon: 'exercise-weights',
    summary:
      'Swings, cleans, presses and get-ups. Conditioning and strength arrive together because the kettlebell does not let you separate them.',
    highlights: [
      'One or two kettlebells is the whole kit',
      'Swing volume built up across six weeks',
      'Turkish get-ups for shoulder health and control',
    ],
    sessions: [
      {
        day: 1,
        name: 'Swing & Press',
        focus: 'Hinge and overhead',
        minutes: 40,
        exercises: [
          { name: 'Kettlebell Swing', sets: 6, reps: '20', restSec: 60 },
          {
            name: 'Kettlebell Military Press',
            sets: 4,
            reps: '6 each side',
            restSec: 90,
          },
          { name: 'Turkish Get-Up', sets: 3, reps: '3 each side', restSec: 90 },
          {
            name: 'Kettlebell Row',
            sets: 3,
            reps: '12 each side',
            restSec: 60,
          },
          { name: 'Farmer Carry', sets: 3, reps: '40 m', restSec: 60 },
        ],
      },
      {
        day: 2,
        name: 'Squat & Carry',
        focus: 'Legs and grip',
        minutes: 40,
        exercises: [
          { name: 'Kettlebell Front Squat', sets: 4, reps: '10', restSec: 90 },
          { name: 'Goblet Squat', sets: 3, reps: '15', restSec: 60 },
          {
            name: 'Kettlebell Lunge',
            sets: 3,
            reps: '10 each leg',
            restSec: 60,
          },
          {
            name: 'Suitcase Carry',
            sets: 4,
            reps: '30 m each side',
            restSec: 60,
          },
          { name: 'Kettlebell Deadlift', sets: 3, reps: '12', restSec: 75 },
        ],
      },
      {
        day: 3,
        name: 'Clean & Complex',
        focus: 'Skill under fatigue',
        minutes: 40,
        exercises: [
          {
            name: 'Kettlebell Clean',
            sets: 5,
            reps: '8 each side',
            restSec: 75,
          },
          { name: 'Kettlebell Thruster', sets: 4, reps: '10', restSec: 75 },
          {
            name: 'Kettlebell Snatch',
            sets: 4,
            reps: '6 each side',
            restSec: 90,
          },
          { name: 'Renegade Row', sets: 3, reps: '8 each side', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '45 s', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Conditioning',
        focus: 'Density',
        minutes: 35,
        exercises: [
          {
            name: 'Kettlebell Swing',
            sets: 10,
            reps: '10 every minute',
            restSec: 0,
            note: 'Ten minutes. Swing on the minute, rest the remainder.',
          },
          {
            name: 'Kettlebell Halo',
            sets: 3,
            reps: '10 each direction',
            restSec: 45,
          },
          { name: 'Turkish Get-Up', sets: 3, reps: '2 each side', restSec: 90 },
          { name: 'Side Plank', sets: 3, reps: '40 s each side', restSec: 45 },
          {
            name: 'Kettlebell Windmill',
            sets: 3,
            reps: '6 each side',
            restSec: 60,
          },
        ],
      },
    ],
    nutrition: {
      headline: 'Conditioning-heavy weeks need carbs, not restriction.',
      calories: 'Maintenance',
      proteinPerKg: 1.8,
      carbs: '4 g/kg',
      fat: '0.9 g/kg',
      tips: [
        'Swings raise your heart rate more than you expect. Eat before, not after only.',
        'Grip and forearms recover slowly — chalk beats pushing through.',
        'Hydrate hard on the density day. It is the sweatiest session of the week.',
      ],
    },
  },
  {
    id: 'summer-six-pack',
    name: 'Summer Six-Pack',
    tagline: 'Twelve weeks out. Start now.',
    coach: 'Coach Tomo Rakić',
    category: 'core',
    level: 'intermediate',
    weeks: 12,
    priceEur: 14.99,
    daysPerWeek: 5,
    minutesPerSession: 45,
    rating: 4.3,
    ratingCount: 9871,
    accentVar: '--color-macro-protein',
    icon: 'exercise-pilates',
    summary:
      'An honest twelve-week cut with direct ab work attached. The abs get trained like any other muscle; the diet is what makes them visible, and this program is blunt about that.',
    highlights: [
      'Twelve-week structured deficit with weekly targets',
      'Direct ab training three times a week',
      'Lifting kept heavy so the loss is fat, not muscle',
    ],
    sessions: [
      {
        day: 1,
        name: 'Push & Abs',
        focus: 'Chest, shoulders, core',
        minutes: 45,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restSec: 120 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10', restSec: 90 },
          { name: 'Cable Fly', sets: 3, reps: '15', restSec: 60 },
          { name: 'Cable Crunch', sets: 4, reps: '15', restSec: 45 },
          { name: 'Hanging Knee Raise', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Pull & Abs',
        focus: 'Back, biceps, core',
        minutes: 45,
        exercises: [
          { name: 'Pull-Up', sets: 4, reps: 'AMRAP', restSec: 120 },
          { name: 'Barbell Row', sets: 4, reps: '8', restSec: 90 },
          { name: 'Seated Cable Row', sets: 3, reps: '12', restSec: 60 },
          { name: 'Ab Wheel Rollout', sets: 4, reps: '10', restSec: 60 },
          { name: 'Russian Twist', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Legs',
        focus: 'Keep the base',
        minutes: 45,
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6-8', restSec: 150 },
          { name: 'Romanian Deadlift', sets: 3, reps: '10', restSec: 90 },
          { name: 'Leg Press', sets: 3, reps: '15', restSec: 75 },
          { name: 'Seated Leg Curl', sets: 3, reps: '12', restSec: 60 },
          { name: 'Standing Calf Raise', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 4,
        name: 'Conditioning & Abs',
        focus: 'Burn and brace',
        minutes: 40,
        exercises: [
          { name: 'Rowing Machine', sets: 6, reps: '400 m', restSec: 75 },
          { name: 'Kettlebell Swing', sets: 4, reps: '20', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '60 s', restSec: 45 },
          { name: 'Mountain Climber', sets: 3, reps: '40 s', restSec: 45 },
          { name: 'Reverse Crunch', sets: 3, reps: '15', restSec: 45 },
        ],
      },
      {
        day: 5,
        name: 'Upper Volume',
        focus: 'Hold the muscle',
        minutes: 45,
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '12', restSec: 75 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 75 },
          { name: 'Lateral Raise', sets: 3, reps: '15', restSec: 45 },
          { name: 'Cable Curl', sets: 3, reps: '15', restSec: 45 },
          { name: 'Triceps Pushdown', sets: 3, reps: '15', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'This is the part that decides whether it works.',
      calories: '-500 kcal under maintenance',
      proteinPerKg: 2.2,
      carbs: '2-3 g/kg, mostly around training',
      fat: '0.7 g/kg',
      tips: [
        'Visible abs is roughly 10-12% body fat for men, 18-20% for women. Be realistic.',
        'Weigh food for the first two weeks. Estimation is how deficits quietly disappear.',
        'Alcohol is the single easiest thing to cut here. It is empty and it blunts recovery.',
      ],
    },
  },
  {
    id: 'strong-after-forty',
    name: 'Strong After Forty',
    tagline: 'Train hard. Recover smart.',
    coach: 'Coach Mara Ilić',
    category: 'strength',
    level: 'intermediate',
    weeks: 12,
    priceEur: 14.99,
    daysPerWeek: 3,
    minutesPerSession: 50,
    rating: 4.9,
    ratingCount: 3388,
    accentVar: '--color-cat-teal',
    icon: 'exercise-weights',
    summary:
      'Full-body strength three days a week with joint-friendly variations, longer warm-ups and enough recovery built in that you can hold it for a year rather than a month.',
    highlights: [
      'Trap-bar and machine variations that spare the joints',
      'Ten-minute prep built into every session',
      'Three days a week, deliberately sustainable',
    ],
    sessions: [
      {
        day: 1,
        name: 'Full Body A',
        focus: 'Squat and press',
        minutes: 50,
        exercises: [
          {
            name: 'Goblet Squat',
            sets: 3,
            reps: '10',
            restSec: 90,
            note: 'Warm-up sets count. Do not rush them.',
          },
          { name: 'Trap Bar Deadlift', sets: 4, reps: '6', restSec: 150 },
          { name: 'Dumbbell Bench Press', sets: 3, reps: '10', restSec: 90 },
          { name: 'Chest-Supported Row', sets: 3, reps: '12', restSec: 75 },
          { name: 'Face Pull', sets: 3, reps: '20', restSec: 45 },
          { name: 'Standing Calf Raise', sets: 3, reps: '15', restSec: 45 },
          { name: 'Dead Bug', sets: 3, reps: '10 each side', restSec: 45 },
        ],
      },
      {
        day: 2,
        name: 'Full Body B',
        focus: 'Hinge and pull',
        minutes: 50,
        exercises: [
          { name: 'Leg Press', sets: 4, reps: '12', restSec: 90 },
          { name: 'Romanian Deadlift', sets: 3, reps: '10', restSec: 90 },
          { name: 'Lat Pulldown', sets: 4, reps: '12', restSec: 75 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10', restSec: 75 },
          { name: 'Pallof Press', sets: 3, reps: '12 each side', restSec: 45 },
          {
            name: 'Bulgarian Split Squat',
            sets: 2,
            reps: '8 each leg',
            restSec: 75,
          },
          { name: 'Band Pull-Apart', sets: 3, reps: '20', restSec: 45 },
        ],
      },
      {
        day: 3,
        name: 'Full Body C',
        focus: 'Unilateral and carry',
        minutes: 50,
        exercises: [
          {
            name: 'Bulgarian Split Squat',
            sets: 3,
            reps: '8 each leg',
            restSec: 90,
          },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10', restSec: 90 },
          { name: 'Seated Cable Row', sets: 4, reps: '12', restSec: 75 },
          { name: 'Farmer Carry', sets: 3, reps: '40 m', restSec: 75 },
          { name: 'Back Extension', sets: 3, reps: '15', restSec: 60 },
          { name: 'Leg Curl', sets: 3, reps: '12', restSec: 60 },
          { name: 'Side Plank', sets: 3, reps: '30 s each side', restSec: 45 },
        ],
      },
    ],
    nutrition: {
      headline: 'Protein and sleep matter more every year.',
      calories: 'Maintenance',
      proteinPerKg: 2,
      carbs: '3-4 g/kg',
      fat: '1 g/kg',
      tips: [
        'Protein needs go up with age, not down. 2 g/kg is a floor, not a ceiling.',
        'Vitamin D and creatine are the two supplements with real evidence here.',
        'A session you recover from beats a session that impresses you.',
      ],
    },
  },
];

export function getProgramById(id: string): ExerciseProgram | undefined {
  return EXERCISE_PROGRAMS.find((program) => program.id === id);
}

/**
 * Store shelves. Each is a horizontally paging column of programs, the way an
 * app store groups titles — the audience shelves overlap deliberately, because
 * a program can belong on more than one.
 */
export interface ProgramShelf {
  id: string;
  programIds: string[];
}

export const FEATURED_PROGRAM_IDS = [
  'glutes-for-days',
  'shred-30',
  'powerhouse-5x5',
  'lean-machine',
];

export const PROGRAM_SHELVES: ProgramShelf[] = [
  {
    id: 'gains',
    programIds: [
      'glutes-for-days',
      'iron-chest',
      'legs-that-never-quit',
      'bulletproof-back',
      'shoulder-boulder',
      'arm-day-every-day',
      'powerhouse-5x5',
      'kettlebell-forge',
    ],
  },
  {
    id: 'men',
    programIds: [
      'iron-chest',
      'shoulder-boulder',
      'deadlift-domination',
      'powerhouse-5x5',
      'arm-day-every-day',
      'summer-six-pack',
      'athletes-engine',
      'bulletproof-back',
    ],
  },
  {
    id: 'women',
    programIds: [
      'glutes-for-days',
      'hourglass-sculpt',
      'core-of-steel',
      'lean-machine',
      'morning-mobility-reset',
      'couch-to-confident',
      'first-pull-up',
      'desk-job-recovery',
    ],
  },
  {
    id: 'starters',
    programIds: [
      'couch-to-confident',
      'first-pull-up',
      'home-gym-hero',
      'morning-mobility-reset',
      'powerhouse-5x5',
      'shred-30',
    ],
  },
  {
    id: 'quick',
    programIds: [
      'shred-30',
      'arm-day-every-day',
      'core-of-steel',
      'morning-mobility-reset',
      'desk-job-recovery',
      'home-gym-hero',
    ],
  },
  {
    id: 'lean',
    programIds: [
      'shred-30',
      'lean-machine',
      'summer-six-pack',
      'athletes-engine',
    ],
  },
];

export function getProgramShelfTitle(t: TFunction, id: string): string {
  switch (id) {
    case 'gains':
      return t('programs.shelves.gains', {
        defaultValue: 'Build Serious Muscle',
      });
    case 'men':
      return t('programs.shelves.men', { defaultValue: 'Made for Men' });
    case 'women':
      return t('programs.shelves.women', { defaultValue: 'Made for Women' });
    case 'starters':
      return t('programs.shelves.starters', {
        defaultValue: 'New to the Gym',
      });
    case 'quick':
      return t('programs.shelves.quick', {
        defaultValue: 'Half an Hour or Less',
      });
    case 'lean':
      return t('programs.shelves.lean', { defaultValue: 'Drop the Fat' });
    default:
      return t('programs.listTitle', { defaultValue: 'Programs for you' });
  }
}

export function getProgramShelfSubtitle(t: TFunction, id: string): string {
  switch (id) {
    case 'gains':
      return t('programs.shelves.gainsSubtitle', {
        defaultValue: 'Size and strength, session by session',
      });
    case 'men':
      return t('programs.shelves.menSubtitle', {
        defaultValue: 'Chest, back, arms, numbers',
      });
    case 'women':
      return t('programs.shelves.womenSubtitle', {
        defaultValue: 'Glutes, core, shape and tone',
      });
    case 'starters':
      return t('programs.shelves.startersSubtitle', {
        defaultValue: 'Week one starts where you are',
      });
    case 'quick':
      return t('programs.shelves.quickSubtitle', {
        defaultValue: 'Short sessions that still count',
      });
    case 'lean':
      return t('programs.shelves.leanSubtitle', {
        defaultValue: 'Lose fat, keep the muscle',
      });
    default:
      return t('programs.listSubtitle', {
        defaultValue: 'Pick one, follow the sessions, eat to match.',
      });
  }
}

export function getProgramsByIds(ids: string[]): ExerciseProgram[] {
  return ids
    .map((id) => getProgramById(id))
    .filter((program): program is ExerciseProgram => program !== undefined);
}

/** The hero card at the top of the store. */
export const FEATURED_PROGRAM_ID = 'glutes-for-days';
