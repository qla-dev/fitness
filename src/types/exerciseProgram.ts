import type { IconName } from '../components/Icon';

/**
 * Training programs shown in the Exercises store.
 *
 * Program copy (names, taglines, coaching notes, nutrition text) is content,
 * not chrome: it stays literal here the way provider exercise names do, and
 * only the surrounding UI labels go through `t()`.
 */
export type ProgramCategoryId =
  | 'glutes'
  | 'core'
  | 'upper'
  | 'legs'
  | 'fullBody'
  | 'fatLoss'
  | 'strength'
  | 'mobility'
  | 'beginner';

export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ProgramExercise {
  /** Matches library / provider naming so a session can be logged as-is. */
  name: string;
  sets: number;
  /** Free text: a rep range, a hold, a distance — whatever the set calls for. */
  reps: string;
  restSec: number;
  note?: string;
}

export interface ProgramSession {
  day: number;
  name: string;
  focus: string;
  minutes: number;
  exercises: ProgramExercise[];
}

export interface ProgramNutrition {
  headline: string;
  /** Energy target relative to maintenance, e.g. '-400 kcal'. */
  calories: string;
  /** Grams of protein per kilogram of bodyweight. */
  proteinPerKg: number;
  carbs: string;
  fat: string;
  tips: string[];
}

export interface ExerciseProgram {
  id: string;
  name: string;
  tagline: string;
  coach: string;
  category: ProgramCategoryId;
  level: ProgramLevel;
  weeks: number;
  daysPerWeek: number;
  minutesPerSession: number;
  rating: number;
  ratingCount: number;
  /** CSS variable name supplying the card accent. */
  accentVar: string;
  icon: IconName;
  summary: string;
  highlights: string[];
  sessions: ProgramSession[];
  nutrition: ProgramNutrition;
}

/** Total exercises across every session — shown on the detail screen. */
export function countProgramExercises(program: ExerciseProgram): number {
  return program.sessions.reduce(
    (total, session) => total + session.exercises.length,
    0
  );
}
