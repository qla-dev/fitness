import type { ExerciseSessionResponse } from '@workspace/shared';

/** Hours in the chart's day; `ActivityMetricChart` draws one bar per slot. */
export const HOURS_IN_DAY = 24;

/**
 * One logged effort reduced to what an hourly chart needs: when it started and
 * how long it ran.
 */
interface TimedEffort {
  /** Local wall-clock start, as minutes past midnight. */
  startMinute: number;
  durationMinutes: number;
}

/**
 * Reads the wall-clock start of an entry.
 *
 * `entry_time` is a plain local "HH:MM(:SS)" string and is preferred: it is the
 * time the user says the effort happened. `created_at` is an instant and only
 * says when the row was written, so it is a fallback — for anything logged as it
 * happened the two agree, and for a workout entered after the fact it is still
 * the best available anchor.
 */
function resolveStartMinute(entry: {
  entry_time?: string | null;
  created_at?: string | null;
}): number | null {
  const time = entry.entry_time;
  if (typeof time === 'string') {
    const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours >= 0 && hours < HOURS_IN_DAY && minutes >= 0 && minutes < 60) {
        return hours * 60 + minutes;
      }
    }
  }

  const createdAt = entry.created_at;
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getHours() * 60 + parsed.getMinutes();
    }
  }

  return null;
}

/** Flattens a day's sessions into the individual efforts that carry a clock time. */
function collectTimedEfforts(
  sessions: readonly ExerciseSessionResponse[]
): TimedEffort[] {
  const efforts: TimedEffort[] = [];

  for (const session of sessions) {
    if (session.type === 'preset') {
      // A preset session has no clock of its own, so each nested exercise is
      // placed on its own time. When none of them carry one the session is
      // dropped rather than guessed at — a bar in the wrong hour is worse than
      // no bar.
      for (const exercise of session.exercises) {
        const startMinute = resolveStartMinute(exercise);
        if (startMinute == null) continue;
        efforts.push({
          startMinute,
          durationMinutes: Math.max(0, exercise.duration_minutes ?? 0),
        });
      }
      continue;
    }

    const startMinute = resolveStartMinute(session);
    if (startMinute == null) continue;
    efforts.push({
      startMinute,
      durationMinutes: Math.max(0, session.duration_minutes ?? 0),
    });
  }

  return efforts;
}

/**
 * The day's logged exercise as 24 hourly minute totals, for
 * `ActivityMetricChart`.
 *
 * An effort is spread across every hour it actually covers rather than being
 * dropped whole into its starting hour, so an hour-long run at 07:30 reads as
 * two half-filled bars, the way it looks in Apple Health. Minutes past midnight
 * are clamped into the day instead of wrapping, because the entry belongs to
 * this calendar day by definition.
 *
 * Returns `undefined` when nothing in the day carries a usable timestamp — the
 * chart then shows its "unavailable" note, which is the honest answer, rather
 * than a flat row of empty hours that would read as "you did nothing".
 */
export function buildHourlyExerciseMinutes(
  sessions: readonly ExerciseSessionResponse[] | undefined
): number[] | undefined {
  if (!sessions || sessions.length === 0) return undefined;

  const efforts = collectTimedEfforts(sessions);
  if (efforts.length === 0) return undefined;

  const hours = new Array<number>(HOURS_IN_DAY).fill(0);
  const endOfDay = HOURS_IN_DAY * 60;

  for (const { startMinute, durationMinutes } of efforts) {
    // A zero-length entry still happened, so it registers as a single minute;
    // otherwise a logged workout with no duration would leave no trace at all.
    const start = Math.min(Math.max(startMinute, 0), endOfDay - 1);
    const end = Math.min(start + Math.max(durationMinutes, 1), endOfDay);

    for (let minute = start; minute < end;) {
      const hour = Math.floor(minute / 60);
      const nextHourBoundary = (hour + 1) * 60;
      const sliceEnd = Math.min(end, nextHourBoundary);
      hours[hour] += sliceEnd - minute;
      minute = sliceEnd;
    }
  }

  return hours;
}
