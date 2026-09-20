import type { ExerciseSessionResponse } from '@workspace/shared';
import {
  resolveActivityKind,
  type WritebackActivityKind,
} from './writebackActivityTypes';

/**
 * A day's diary workouts, reduced to what both health stores need.
 *
 * Shared because the reduction is identical on either side — the same echo
 * guard, the same duration and totals, the same clock window. Only the final
 * hop (kind → HKWorkoutActivityType / ExerciseType, and the actual save) is
 * platform work, and that lives in each platform's writebackMappers.
 */
export interface WritebackWorkout {
  /** Session id. Stable across edits, so it keys the per-run record id. */
  id: string;
  /** What the health store shows as the workout's name. */
  title: string;
  kind: WritebackActivityKind;
  start: Date;
  end: Date;
  /** kcal, omitted when the session logged none. */
  energyKcal?: number;
  /** Metres, omitted when the session covered no distance. */
  distanceMeters?: number;
}

const MINUTE_MS = 60_000;

/**
 * Where a session with no clock time is placed in its day.
 *
 * Midday, for the same reason hydration anchors at noon: it is inside every
 * day, it never lands in tomorrow, and a workout drawn at noon reads as
 * "sometime that day" rather than asserting a small hour the user never
 * reported. Sessions that DO carry a time use it.
 */
const ANCHOR_HOUR = 12;

const KM_TO_M = 1000;

const localDayStart = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

/** `HH:MM` / `HH:MM:SS` on a calendar day → a local instant. */
const timeOnDay = (day: string, time: string): Date | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time.trim());
  if (!match) return null;
  const start = localDayStart(day);
  start.setHours(
    Number(match[1]),
    Number(match[2]),
    Number(match[3] ?? 0),
    0
  );
  return start;
};

/** An ISO instant that actually falls on `day`, else null (a created_at from a
 *  later edit must not drag the workout onto the wrong date). */
const instantOnDay = (day: string, iso: string): Date | null => {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return null;
  const dayStart = localDayStart(day);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);
  return at >= dayStart && at < nextDay ? at : null;
};

const positive = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * The sources the app stamps on a session it created itself. Every local write
 * path sets one of these — `workoutRepository` defaults an entry and a preset
 * session to 'manual' — so a session carrying none of them did not originate
 * here.
 */
const OWN_SESSION_SOURCES = new Set(['manual', 'sparky', 'workout plan']);

/**
 * Only sessions qla.fit owns. Anything with a provider source came IN from the
 * health store, and writing it back would duplicate the store's own workout —
 * the exercise counterpart of the nutrition writer's `!entry.source` filter.
 *
 * Deliberately stricter than `canEditGroupedWorkout`, which answers a different
 * question: it treats a null source as ours because a legacy local row should
 * stay editable. Provenance is not editability. An unknown source here means
 * "we cannot show this came from the diary", and the safe answer for the
 * outbound direction is not to write — a wrong "yes" puts a duplicate in the
 * user's health store permanently, while a wrong "no" only omits one workout.
 * Synthetic rows the importer builds for provider day-totals ("Active
 * Calories", "Apple Exercise Time") are excluded by the same rule.
 */
const isOwnSession = (session: ExerciseSessionResponse): boolean => {
  const source = session.source?.trim().toLowerCase();
  return source !== undefined && OWN_SESSION_SOURCES.has(source);
};

/**
 * A stable instant to hang the session on, and which end of it that instant is.
 *
 * Stability is the whole point. An anchor derived from `now` moves on every
 * sync, which changes the content signature, which makes writeback delete and
 * re-save the workout under a fresh UUID every single run — so the health store
 * accumulates a new copy per sync. `entry_time` and `created_at` are both fixed
 * facts about the row, so a day that has not been edited hashes the same
 * forever and is skipped.
 */
type Anchor = { at: Date; edge: 'start' | 'end' };

/**
 * Earliest clock time the session can claim: its own `entry_time`, else the
 * earliest one among a grouped workout's exercises, else `created_at` when that
 * instant falls on the day itself.
 */
const sessionStartTime = (
  session: ExerciseSessionResponse,
  day: string
): Date | null => {
  const candidates: Date[] = [];

  if (session.type === 'individual' && session.entry_time) {
    const at = timeOnDay(day, session.entry_time);
    if (at) candidates.push(at);
  }

  if (session.type === 'preset') {
    for (const exercise of session.exercises) {
      if (!exercise.entry_time) continue;
      const at = timeOnDay(day, exercise.entry_time);
      if (at) candidates.push(at);
    }
  }

  if (candidates.length > 0) {
    return candidates.reduce((a, b) => (a <= b ? a : b));
  }

  return null;
};

/**
 * Where to hang a session that carries no clock time.
 *
 * `created_at` is used as the END of the window rather than its start: it is
 * when the row was written, so the activity it describes happened in the run-up
 * to it, and anchoring that way puts the whole window in the past — which is
 * what keeps a just-logged workout writable immediately instead of waiting for
 * its duration to elapse.
 *
 * With neither a time nor a creation stamp, midday is the fallback, for the
 * reason ANCHOR_HOUR gives.
 */
const sessionAnchor = (
  session: ExerciseSessionResponse,
  day: string
): Anchor => {
  const explicit = sessionStartTime(session, day);
  if (explicit) return { at: explicit, edge: 'start' };

  if (session.created_at) {
    const at = instantOnDay(day, session.created_at);
    if (at) return { at, edge: 'end' };
  }

  const dayStart = localDayStart(day);
  return {
    at: new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      ANCHOR_HOUR,
      0,
      0,
      0
    ),
    edge: 'start',
  };
};

const sessionTitle = (session: ExerciseSessionResponse): string => {
  const name = session.name?.trim();
  if (name) return name;
  // An individual entry may have no name of its own (the exercise carries it).
  if (session.type === 'individual') {
    const snapshotName = session.exercise_snapshot?.name?.trim();
    if (snapshotName) return snapshotName;
  }
  return 'Workout';
};

const sessionKind = (session: ExerciseSessionResponse): WritebackActivityKind =>
  session.type === 'preset'
    ? // A grouped workout is a lifting session unless its name says otherwise:
      // its exercises are the movements, not the sport.
      resolveActivityKind(session.name, null, 'strengthTraining')
    : resolveActivityKind(
        sessionTitle(session),
        session.category ?? session.exercise_snapshot?.category,
        'other'
      );

const sessionMinutes = (session: ExerciseSessionResponse): number =>
  session.type === 'preset'
    ? Number(session.total_duration_minutes ?? 0)
    : Number(session.duration_minutes ?? 0);

const sessionEnergyKcal = (
  session: ExerciseSessionResponse
): number | undefined =>
  session.type === 'preset'
    ? positive(
        session.exercises.reduce(
          (sum, exercise) => sum + Number(exercise.calories_burned ?? 0),
          0
        )
      )
    : positive(session.calories_burned);

/** Km in the diary, metres in both health stores. */
const sessionDistanceMeters = (
  session: ExerciseSessionResponse
): number | undefined => {
  const km =
    session.type === 'preset'
      ? session.exercises.reduce(
          (sum, exercise) => sum + Number(exercise.distance ?? 0),
          0
        )
      : Number(session.distance ?? 0);
  const metres = positive(km);
  return metres === undefined ? undefined : metres * KM_TO_M;
};

/**
 * The day's own workouts, as write descriptors.
 *
 * Sessions are placed on a real clock window because that is the only way a
 * health store can hold one. A session that reports no duration is dropped
 * rather than written as an instant: a zero-length workout is rejected by
 * HealthKit and meaningless in Health Connect.
 *
 * A session whose window would end in the future is DEFERRED — left out of this
 * run and written by a later one, once the time it claims has actually passed.
 * It is deliberately not clamped to `now`: clamping moved the window on every
 * sync, so the day never hashed the same twice and writeback re-saved the
 * workout under a fresh UUID every run, and when the window hit the start of the
 * day the clamp truncated it too, filing a two-hour session as however many
 * minutes had elapsed since midnight. Deferring keeps the duration honest and
 * the signature stable; the hydration writer defers on its own anchor for the
 * same reason.
 *
 * The window may cross midnight into the previous day, which is correct: the
 * calendar day is qla.fit's own bucketing, and a health store holds a workout
 * at the wall-clock time it happened.
 */
export const sessionsToWorkouts = (
  day: string,
  sessions: readonly ExerciseSessionResponse[],
  now: Date = new Date()
): WritebackWorkout[] => {
  const workouts: WritebackWorkout[] = [];

  for (const session of sessions) {
    if (!isOwnSession(session)) continue;

    const minutes = sessionMinutes(session);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const durationMs = minutes * MINUTE_MS;

    const anchor = sessionAnchor(session, day);
    const start =
      anchor.edge === 'start'
        ? anchor.at
        : new Date(anchor.at.getTime() - durationMs);
    const end = new Date(start.getTime() + durationMs);

    if (end.getTime() > now.getTime()) continue;

    if (end.getTime() <= start.getTime()) continue;

    workouts.push({
      id: String(session.id),
      title: sessionTitle(session),
      kind: sessionKind(session),
      start,
      end,
      energyKcal: sessionEnergyKcal(session),
      distanceMeters: sessionDistanceMeters(session),
    });
  }

  return workouts;
};
