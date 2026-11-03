import { addDays, type ExerciseSessionResponse } from '@workspace/shared';
import { localApiFetch } from '../local/localApi';
import {
  buildDailySummary,
  loadDailySummaryRawData,
} from '../dailySummaryService';
import { getTodayDate } from '../../utils/dateUtils';
import { isProviderDayTotal } from '../../utils/workoutSession';

/**
 * What MarkAI is told about the user, once they have allowed it: a plain-text
 * digest of the on-device diary and Health data, sent with each message.
 *
 * Built here, from the local database, rather than read on the server from the
 * synced copy, so it works with sync off and is never older than the diary on
 * the screen. Every figure comes from the same reads the app's own screens
 * make (the daily summary, the rings and check-in ranges), so MarkAI and the
 * Tracker cannot tell two different stories about one day.
 *
 * Kept to aggregates — totals, goals and the day's sessions — and nothing
 * identifying: no name, no notes, no food names.
 */

/** How far back the digest looks. Two weeks shows a trend without padding. */
const CONTEXT_DAYS = 14;
/** The server's cap on the field; the digest stays well inside it. */
export const MARKAI_CONTEXT_MAX = 8000;

type CheckIn = {
  entry_date: string;
  weight?: number | null;
  height?: number | null;
  body_fat_percentage?: number | null;
  steps?: number | null;
};
type Ring = { entry_date: string; steps: number; stepsGoal: number };
type Sleep = { entry_date: string; time_asleep_in_seconds?: number | null };
type Profile = {
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | null;
};

const round = (value: number) => Math.round(value);
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

function ageOn(birth: string, today: string) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !ty) return null;
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function describeSession(session: ExerciseSessionResponse) {
  const name =
    session.type === 'preset'
      ? session.name
      : (session.name ?? session.exercise_snapshot?.name ?? 'Workout');
  const minutes =
    session.type === 'preset'
      ? session.total_duration_minutes
      : session.duration_minutes;
  const parts = [`${name} ${round(minutes)} min`];
  if (session.type === 'individual') {
    if (session.distance) parts.push(`${oneDecimal(session.distance)} km`);
    if (session.calories_burned)
      parts.push(`${round(session.calories_burned)} kcal`);
    if (session.avg_heart_rate)
      parts.push(`avg HR ${round(session.avg_heart_rate)}`);
  }
  return parts.join(' ');
}

export async function buildMarkaiContext(
  today: string = getTodayDate()
): Promise<string> {
  const start = addDays(today, -(CONTEXT_DAYS - 1));
  const days = Array.from({ length: CONTEXT_DAYS }, (_, i) =>
    addDays(start, i)
  );
  // A year back for the standing facts, which are not logged every day.
  const factsStart = addDays(today, -365);
  const [summaries, rings, checkIns, sleep, profile] = await Promise.all([
    Promise.all(
      days.map(async (day) =>
        buildDailySummary(day, await loadDailySummaryRawData(day))
      )
    ),
    localApiFetch<Ring[]>({
      endpoint: `/api/activity-rings-range/${start}/${today}`,
    }).catch(() => [] as Ring[]),
    localApiFetch<CheckIn[]>({
      endpoint: `/api/measurements/check-in-measurements-range/${factsStart}/${today}`,
    }).catch(() => [] as CheckIn[]),
    localApiFetch<Sleep[]>({
      endpoint: `/api/sleep?startDate=${start}&endDate=${today}`,
    }).catch(() => [] as Sleep[]),
    localApiFetch<Profile>({ endpoint: '/api/identity/profiles' }).catch(
      () => ({}) as Profile
    ),
  ]);

  const latest = (field: 'weight' | 'height' | 'body_fat_percentage') =>
    [...checkIns]
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      .find((row) => row[field] != null);
  const weight = latest('weight');
  const height = latest('height');
  const bodyFat = latest('body_fat_percentage');
  const age = profile.date_of_birth
    ? ageOn(profile.date_of_birth, today)
    : null;

  const facts = [
    profile.gender ? `sex ${profile.gender}` : null,
    age != null ? `age ${age}` : null,
    height?.height ? `height ${round(height.height)} cm` : null,
    weight?.weight
      ? `weight ${oneDecimal(weight.weight)} kg (${weight.entry_date})`
      : null,
    bodyFat?.body_fat_percentage
      ? `body fat ${oneDecimal(bodyFat.body_fat_percentage)}%`
      : null,
  ].filter(Boolean);

  const todaySummary = summaries[summaries.length - 1];
  const todayRing = rings.find((ring) => ring.entry_date === today);
  const goals = [
    `${round(todaySummary.calorieGoal)} kcal`,
    `protein ${round(todaySummary.protein.goal)} g`,
    `carbs ${round(todaySummary.carbs.goal)} g`,
    `fat ${round(todaySummary.fat.goal)} g`,
    todayRing?.stepsGoal ? `${round(todayRing.stepsGoal)} steps` : null,
    todaySummary.exerciseMinutesGoal
      ? `exercise ${round(todaySummary.exerciseMinutesGoal)} min`
      : null,
    todaySummary.exerciseCaloriesGoal
      ? `move ${round(todaySummary.exerciseCaloriesGoal)} kcal`
      : null,
    todaySummary.waterGoal ? `water ${round(todaySummary.waterGoal)} ml` : null,
  ].filter(Boolean);

  const stepsByDay = new Map(rings.map((ring) => [ring.entry_date, ring]));
  const sleepByDay = new Map<string, number>();
  for (const row of sleep)
    if (row.time_asleep_in_seconds)
      sleepByDay.set(
        row.entry_date,
        (sleepByDay.get(row.entry_date) ?? 0) + row.time_asleep_in_seconds
      );

  const lines = summaries.map((summary) => {
    const steps = stepsByDay.get(summary.date)?.steps;
    const asleep = sleepByDay.get(summary.date);
    const sessions = summary.exerciseEntries.filter(
      (session) => !isProviderDayTotal(session)
    );
    return [
      `${summary.date}:`,
      `ate ${round(summary.caloriesConsumed)} kcal`,
      `P${round(summary.protein.consumed)} C${round(summary.carbs.consumed)} F${round(summary.fat.consumed)} g`,
      `active ${round(summary.activeCalories + summary.otherExerciseCalories)} kcal`,
      `exercise ${round(summary.exerciseMinutes)} min`,
      steps ? `${round(steps)} steps` : null,
      asleep ? `slept ${oneDecimal(asleep / 3600)} h` : null,
      summary.waterConsumed ? `water ${round(summary.waterConsumed)} ml` : null,
      sessions.length
        ? `workouts: ${sessions.map(describeSession).join('; ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
  });

  return [
    `Today is ${today}.`,
    facts.length ? `Profile: ${facts.join(', ')}.` : 'Profile: not filled in.',
    `Daily goals: ${goals.join(', ')}.`,
    `Last ${CONTEXT_DAYS} days, oldest first (days with nothing logged show zeros):`,
    ...lines,
  ]
    .join('\n')
    .slice(0, MARKAI_CONTEXT_MAX);
}
