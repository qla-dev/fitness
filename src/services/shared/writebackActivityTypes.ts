/**
 * Resolving a qla.fit exercise to an OS "kind of workout".
 *
 * Both health stores type a workout with an enum, and neither takes a free
 * string: HealthKit wants an HKWorkoutActivityType and Health Connect an
 * ExerciseType int. The two enums do not line up (HealthKit has no "Deadlift",
 * Health Connect has no "Barre"), so the mapping is done in two hops — this
 * module reduces an exercise to a platform-neutral kind, and each platform's
 * writebackMappers turns that kind into its own enum value. Only the small
 * neutral vocabulary below is shared; the enums stay in the platform folders,
 * the way the read-side ACTIVITY_MAP / EXERCISE_MAP already do.
 *
 * Every kind here exists on BOTH platforms, so a resolved kind never has to
 * degrade to "other" on one of them. Kinds only one store models (barre,
 * deadlift) are deliberately absent — they would buy nothing.
 */
export type WritebackActivityKind =
  | 'running'
  | 'walking'
  | 'hiking'
  | 'cycling'
  | 'swimming'
  | 'rowing'
  | 'elliptical'
  | 'stairClimbing'
  | 'jumpRope'
  | 'hiit'
  | 'boxing'
  | 'martialArts'
  | 'dancing'
  | 'yoga'
  | 'pilates'
  | 'stretching'
  | 'coreTraining'
  | 'strengthTraining'
  | 'other';

/**
 * Lifting movements whose names contain a cardio word. "Walking lunge" is not a
 * walk and "seated cable row" is not a rowing session, so the strength tokens
 * are checked first and win outright — a wrong guess here files a workout under
 * the wrong sport in the user's health store, which is worse than falling back
 * to generic strength training.
 */
const STRENGTH_MOVEMENT_TOKENS = [
  'lunge',
  'squat',
  'deadlift',
  'press',
  'curl',
  'pulldown',
  'pull-down',
  'pullup',
  'pull-up',
  'chinup',
  'chin-up',
  'pushup',
  'push-up',
  'fly',
  'flye',
  'raise',
  'extension',
  'shrug',
  'thruster',
  'clean',
  'snatch',
  'jerk',
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'smith',
];

/** Multi-word phrases, checked against the whole normalized name. */
const PHRASE_KINDS: [string, WritebackActivityKind][] = [
  ['jump rope', 'jumpRope'],
  ['jumping rope', 'jumpRope'],
  ['skipping rope', 'jumpRope'],
  ['high intensity', 'hiit'],
  ['high-intensity', 'hiit'],
  ['interval training', 'hiit'],
  ['stair climbing', 'stairClimbing'],
  ['stair climber', 'stairClimbing'],
  ['stair master', 'stairClimbing'],
  ['stairmaster', 'stairClimbing'],
  ['martial arts', 'martialArts'],
  ['core training', 'coreTraining'],
  ['strength training', 'strengthTraining'],
  ['weight training', 'strengthTraining'],
  ['resistance training', 'strengthTraining'],
  ['cross training', 'strengthTraining'],
  ['rowing machine', 'rowing'],
  ['indoor cycling', 'cycling'],
  ['spin class', 'cycling'],
  ['exercise bike', 'cycling'],
  ['stationary bike', 'cycling'],
  ['mountain biking', 'cycling'],
  ['treadmill run', 'running'],
  ['trail run', 'running'],
  ['power walk', 'walking'],
  ['brisk walk', 'walking'],
];

/** Single words, matched whole so "rowing" never fires on "arrow". */
const TOKEN_KINDS: Record<string, WritebackActivityKind> = {
  run: 'running',
  running: 'running',
  jog: 'running',
  jogging: 'running',
  sprint: 'running',
  sprints: 'running',
  walk: 'walking',
  walking: 'walking',
  hike: 'hiking',
  hiking: 'hiking',
  trekking: 'hiking',
  bike: 'cycling',
  biking: 'cycling',
  cycle: 'cycling',
  cycling: 'cycling',
  spinning: 'cycling',
  swim: 'swimming',
  swimming: 'swimming',
  row: 'rowing',
  rowing: 'rowing',
  erg: 'rowing',
  kayaking: 'rowing',
  paddling: 'rowing',
  elliptical: 'elliptical',
  crosstrainer: 'elliptical',
  stairs: 'stairClimbing',
  hiit: 'hiit',
  tabata: 'hiit',
  crossfit: 'hiit',
  circuit: 'hiit',
  boxing: 'boxing',
  kickboxing: 'boxing',
  karate: 'martialArts',
  judo: 'martialArts',
  taekwondo: 'martialArts',
  jiujitsu: 'martialArts',
  bjj: 'martialArts',
  mma: 'martialArts',
  wrestling: 'martialArts',
  dance: 'dancing',
  dancing: 'dancing',
  zumba: 'dancing',
  yoga: 'yoga',
  pilates: 'pilates',
  stretch: 'stretching',
  stretching: 'stretching',
  mobility: 'stretching',
  flexibility: 'stretching',
  plank: 'coreTraining',
  core: 'coreTraining',
  abs: 'coreTraining',
  crunch: 'coreTraining',
  crunches: 'coreTraining',
  situps: 'coreTraining',
  lifting: 'strengthTraining',
  weights: 'strengthTraining',
  weightlifting: 'strengthTraining',
  powerlifting: 'strengthTraining',
  strongman: 'strengthTraining',
  calisthenics: 'strengthTraining',
};

/**
 * qla.fit exercise category → kind, for names that say nothing useful.
 *
 * 'cardio' resolves to 'other' rather than guessing a sport: the category alone
 * cannot tell a row from a swim, and both stores show an untyped workout with
 * its title, so the user still reads the right name.
 */
const CATEGORY_KINDS: Record<string, WritebackActivityKind> = {
  strength: 'strengthTraining',
  powerlifting: 'strengthTraining',
  'olympic weightlifting': 'strengthTraining',
  strongman: 'strengthTraining',
  plyometrics: 'hiit',
  cardio: 'other',
  yoga: 'yoga',
  stretching: 'stretching',
  isometric: 'coreTraining',
  isometrics: 'coreTraining',
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words, with punctuation stripped but internal hyphens kept for "pull-up". */
const tokenize = (normalized: string): string[] =>
  normalized
    .split(' ')
    .map((word) => word.replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean);

/**
 * Best platform-neutral kind for an exercise or session.
 *
 * Name first, category second: the category vocabulary is coarse (a "cardio"
 * entry may be a row, a swim or a run) while the name is what the user actually
 * typed. `fallback` is what an unrecognisable name AND an unrecognisable
 * category resolve to — callers pass 'strengthTraining' for a grouped workout,
 * whose sessions are lifts by default, and leave it at 'other' for a standalone
 * activity.
 */
export const resolveActivityKind = (
  name: string | null | undefined,
  category?: string | null,
  fallback: WritebackActivityKind = 'other'
): WritebackActivityKind => {
  const normalized = normalize(name ?? '');

  if (normalized) {
    const tokens = tokenize(normalized);

    // A lifting movement wins over any cardio word in the same name.
    if (
      STRENGTH_MOVEMENT_TOKENS.some(
        (token) => tokens.includes(token) || normalized.includes(token)
      )
    ) {
      return 'strengthTraining';
    }

    for (const [phrase, kind] of PHRASE_KINDS) {
      if (normalized.includes(phrase)) return kind;
    }

    for (const token of tokens) {
      const kind = TOKEN_KINDS[token];
      if (kind) return kind;
    }
  }

  // A recognised category is a real answer, including the 'other' that 'cardio'
  // maps to, so it is never replaced by the caller's fallback.
  const categoryKind = CATEGORY_KINDS[normalize(category ?? '')];
  if (categoryKind) return categoryKind;

  return fallback;
};
