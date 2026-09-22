import type { ExerciseSessionResponse } from '@workspace/shared';
import { addLog } from '../services/LogService';
import { isProviderDayTotal } from './workoutSession';

/** Hours in the chart's day; `ActivityMetricChart` draws one bar per slot. */
export const HOURS_IN_DAY = 24;
const MINUTES_IN_DAY = HOURS_IN_DAY * 60;

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
 * The fields any timestamp source can appear on. Kept structural rather than
 * tied to one response type because the same resolution runs over a standalone
 * activity and over the exercises nested inside a workout.
 */
interface TimedEntry {
  entry_time?: string | null;
  created_at?: string | null;
  duration_minutes?: number | null;
  sets?: readonly { completed_at?: string | null }[];
}

/** A plain local "HH:MM" / "HH:MM:SS" wall clock, as minutes past midnight. */
function parseClockMinute(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours >= HOURS_IN_DAY || minutes < 0 || minutes >= 60)
    return null;
  return hours * 60 + minutes;
}

/** An ISO instant, read in the device's zone as minutes past midnight. */
function parseInstantMinute(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

/** Every set that was ticked off, in the order it was completed. */
function completedSetMinutes(entry: TimedEntry): number[] {
  const minutes: number[] = [];
  for (const set of entry.sets ?? []) {
    const minute = parseInstantMinute(set?.completed_at);
    if (minute != null) minutes.push(minute);
  }
  return minutes.sort((a, b) => a - b);
}

/**
 * Places one logged entry on the clock.
 *
 * Three sources, in descending order of how directly they answer "when did this
 * happen":
 *
 * 1. `entry_time` — a wall clock the user stated outright.
 * 2. The first completed set. This is the one the app itself always writes: the
 *    active workout stamps `completed_at` as each set is ticked off, so a
 *    workout logged as it happened carries its real times even when the server
 *    supplies nothing else.
 * 3. `created_at` — only says when the row was written, but for anything logged
 *    as it happened the two agree, and it is the last anchor available.
 *
 * Duration falls back the same way: a strength workout frequently logs no
 * minutes at all, so the span of its completed sets stands in for it.
 */
function effortForEntry(entry: TimedEntry): TimedEffort | null {
  const setMinutes = completedSetMinutes(entry);
  const startMinute =
    parseClockMinute(entry.entry_time) ??
    setMinutes[0] ??
    parseInstantMinute(entry.created_at);
  if (startMinute == null) return null;

  const logged = entry.duration_minutes ?? 0;
  const setSpan =
    setMinutes.length > 1
      ? setMinutes[setMinutes.length - 1] - setMinutes[0]
      : 0;

  return { startMinute, durationMinutes: logged > 0 ? logged : setSpan };
}

/** Flattens a day's sessions into the individual efforts that carry a clock time. */
function collectTimedEfforts(
  sessions: readonly ExerciseSessionResponse[]
): TimedEffort[] {
  const efforts: TimedEffort[] = [];

  for (const session of sessions) {
    // The importer's per-day totals are not efforts and carry no clock time of
    // their own: "Apple Exercise Time" is the day's whole exercise figure,
    // which belongs on this chart as the provider's hourly series rather than
    // as one lump dropped at whatever o'clock the row happened to be written,
    // and "Active Calories" is energy with no minutes at all. Both used to be
    // drawn here — and because an effort with no duration still registers as a
    // minute, a day whose only sessions were these two showed bars above a
    // headline reading 0.
    if (isProviderDayTotal(session)) continue;
    if (session.type === 'preset') {
      // Each exercise is placed on its own time, so a workout that ran across
      // two hours reads as two hours rather than one lump.
      const nested = session.exercises
        .map((exercise) => effortForEntry(exercise))
        .filter((effort): effort is TimedEffort => effort !== null);
      if (nested.length > 0) {
        efforts.push(...nested);
        continue;
      }
      // Nothing inside carried a clock, so the session's own write time is the
      // last anchor before giving up on it.
      const startMinute = parseInstantMinute(session.created_at);
      if (startMinute == null) continue;
      efforts.push({
        startMinute,
        durationMinutes: session.total_duration_minutes ?? 0,
      });
      continue;
    }

    const effort = effortForEntry(session);
    if (effort !== null) efforts.push(effort);
  }

  return efforts;
}

/** Names the timestamp fields an entry carried, for the diagnostic log. */
function describeEntryTimestamps(label: string, entry: TimedEntry): string {
  const sets = entry.sets ?? [];
  const completed = sets.filter(
    (set) => parseInstantMinute(set?.completed_at) != null
  ).length;
  return [
    label,
    `entry_time=${entry.entry_time ?? 'none'}`,
    `created_at=${entry.created_at ?? 'none'}`,
    `duration_minutes=${entry.duration_minutes ?? 'none'}`,
    `sets=${sets.length}`,
    `sets_with_completed_at=${completed}`,
  ].join(' ');
}

/** Per-entry breakdown of why a day produced no placeable efforts. */
function describeMissingTimestamps(
  sessions: readonly ExerciseSessionResponse[]
): string[] {
  const details: string[] = [];
  sessions.forEach((session, index) => {
    if (session.type === 'preset') {
      details.push(
        `session[${index}] preset "${session.name}" created_at=${
          session.created_at ?? 'none'
        } total_duration_minutes=${session.total_duration_minutes ?? 'none'}`
      );
      session.exercises.forEach((exercise, exerciseIndex) => {
        details.push(
          describeEntryTimestamps(
            `  exercise[${exerciseIndex}]`,
            exercise as TimedEntry
          )
        );
      });
      return;
    }
    details.push(
      describeEntryTimestamps(
        `session[${index}] individual`,
        session as TimedEntry
      )
    );
  });
  return details;
}

/**
 * The day's logged exercise as 24 hourly minute totals, for
 * `ActivityMetricChart`.
 *
 * An effort is spread across every hour it actually covers rather than being
 * dropped whole into its starting hour, so an hour-long run at 07:30 reads as
 * two half-filled bars. Minutes past midnight are clamped into the day instead
 * of wrapping, because the entry belongs to this calendar day by definition.
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
  if (efforts.length === 0) {
    // A day with logged exercise and no placeable time is the one case worth
    // reporting: the chart falls back to "unavailable" and nothing on screen
    // explains why. The details name the fields each entry did and did not
    // carry, so the gap can be traced to the writer rather than guessed at.
    void addLog(
      'Hourly exercise chart: no entry carried a placeable timestamp',
      'DEBUG',
      describeMissingTimestamps(sessions)
    );
    return undefined;
  }

  const hours = new Array<number>(HOURS_IN_DAY).fill(0);

  for (const { startMinute, durationMinutes } of efforts) {
    // A zero-length entry still happened, so it registers as a single minute;
    // otherwise a logged workout with no duration would leave no trace at all.
    const start = Math.min(Math.max(startMinute, 0), MINUTES_IN_DAY - 1);
    const end = Math.min(start + Math.max(durationMinutes, 1), MINUTES_IN_DAY);

    for (let minute = start; minute < end;) {
      const hour = Math.floor(minute / 60);
      const sliceEnd = Math.min(end, (hour + 1) * 60);
      hours[hour] += sliceEnd - minute;
      minute = sliceEnd;
    }
  }

  return hours;
}
