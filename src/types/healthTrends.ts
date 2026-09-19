/**
 * The window a trend plots, shared by every chart and by the selector above
 * them.
 *
 * Named for the period rather than a day count ('m', not '30d') because the
 * periods are what the user picks and what the labels say; how many days a
 * month is worth is this file's business, not the caller's.
 */
export type HealthTrendDateRange = 'd' | 'w' | 'm' | '6m' | 'y';

/** Every range, in the order the selector offers them. */
export const HEALTH_TREND_RANGES: readonly HealthTrendDateRange[] = [
  'd',
  'w',
  'm',
  '6m',
  'y',
];

/** How many days back each range covers, inclusive of today. */
export const RANGE_DAYS: Record<HealthTrendDateRange, number> = {
  d: 1,
  w: 7,
  m: 30,
  '6m': 180,
  y: 365,
};

/**
 * How wide the gap between bars is, per range.
 *
 * A year of daily bars is 365 of them across a phone, so the gap shrinks as
 * the window grows or the bars would be thinner than the space between them.
 */
export const RANGE_INNER_PADDING: Record<HealthTrendDateRange, number> = {
  d: 0.6,
  w: 0.3,
  m: 0.2,
  '6m': 0.05,
  y: 0.02,
};

/** How many labels the x-axis carries, per range. */
export const RANGE_X_TICKS: Record<HealthTrendDateRange, number> = {
  d: 1,
  w: 7,
  m: 6,
  '6m': 6,
  y: 6,
};

/**
 * Ranges whose axis is labelled with weekday names rather than dates.
 *
 * A week fits seven weekdays; anything longer repeats them and stops meaning
 * anything, so it gets dates instead.
 */
export const RANGE_LABELS_WEEKDAYS: ReadonlySet<HealthTrendDateRange> = new Set(
  ['d', 'w']
);

/**
 * A trend's data plus its fetch state.
 */
export type HealthTrendSeries<TPoint> = {
  data: TPoint[];
  isLoading: boolean;
  isError: boolean;
};
