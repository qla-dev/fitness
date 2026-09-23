import { addDays } from './dateUtils';

export type GoalFactPoint = { day: string; value: number; hourly?: number[] };

/** Missing days stay missing; a recorded zero is a real observation. */
export function averageFact(points: readonly GoalFactPoint[]): number | null {
  const valid = points.filter((p) => Number.isFinite(p.value));
  return valid.length
    ? valid.reduce((sum, p) => sum + p.value, 0) / valid.length
    : null;
}

export function factWindow(
  points: readonly GoalFactPoint[],
  start: string,
  end: string
) {
  return points.filter((p) => p.day >= start && p.day <= end);
}

export function stepFactPeriods(
  points: readonly GoalFactPoint[],
  date: string
) {
  const year = Number(date.slice(0, 4));
  const month = date.slice(0, 7);
  const previousMonthEnd = addDays(`${month}-01`, -1);
  return {
    earlier: factWindow(points, addDays(date, -27), addDays(date, -15)),
    recent: factWindow(points, addDays(date, -14), date),
    thisYear: factWindow(points, `${year}-01-01`, date),
    lastYear: factWindow(points, `${year - 1}-01-01`, `${year - 1}-12-31`),
    thisMonth: factWindow(points, `${month}-01`, date),
    lastMonth: factWindow(
      points,
      `${previousMonthEnd.slice(0, 7)}-01`,
      previousMonthEnd
    ),
  };
}

export function cumulativeHours(
  hours: readonly number[],
  endHour: number
): number[] {
  let total = 0;
  return [0, ...hours.slice(0, endHour + 1).map((value) => (total += value))];
}

export function stepPace(
  points: readonly GoalFactPoint[],
  date: string,
  endHour: number
) {
  const today = points.find((p) => p.day === date)?.hourly;
  const history = factWindow(
    points,
    addDays(date, -28),
    addDays(date, -1)
  ).filter((p) => p.hourly?.length === 24);
  return {
    current: today ? cumulativeHours(today, endHour) : [],
    typical: history.length
      ? cumulativeHours(
          Array.from(
            { length: 24 },
            (_, hour) =>
              history.reduce((sum, p) => sum + p.hourly![hour], 0) /
              history.length
          ),
          endHour
        )
      : [],
  };
}
