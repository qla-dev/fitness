import { Platform } from 'react-native';
import { getAppLocale, formatLocalizedNumber } from '../../localization';
import { matchFont } from '@shopify/react-native-skia';
import {
  RANGE_LABELS_MONTHS,
  RANGE_LABELS_WEEKDAYS,
  type HealthTrendDateRange,
} from '../../types/healthTrends';

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

/** Skia label font shared by the dashboard/wellness charts. */
export const makeChartFont = (fontSize: number) =>
  matchFont({ fontFamily, fontSize });

/**
 * Axis label size for the dashboard trend charts. Skia text ignores the OS font-size
 * setting, so any chart drawing its axis with React Native `<Text>` instead has to pin
 * this size and pass `allowFontScaling={false}` — otherwise its labels grow past the
 * ones beside them in the pager and truncate.
 */
export const CHART_LABEL_FONT_SIZE = 12;

export const formatXLabel7d = (day: string): string => {
  if (typeof day !== 'string') return '';
  const [year, month, d] = day.split('-').map(Number);
  const date = new Date(year, month - 1, d);
  return date.toLocaleDateString(getAppLocale(), { weekday: 'short' });
};

export const formatXLabel30d90d = (day: string): string => {
  if (typeof day !== 'string') return '';
  const [year, month, d] = day.split('-').map(Number);
  const date = new Date(year, month - 1, d);
  return date.toLocaleDateString(getAppLocale(), {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * The month alone, for a window too long to label with dates.
 *
 * Six ticks across six months or a year landed on arbitrary days — "Mar 28",
 * "May 3", "Jun 8" — which invites reading the bars as falling on those dates
 * rather than as the months between them. The month is the unit the eye is
 * actually scanning at that zoom, and it is what Apple's own charts print.
 */
export const formatXLabelMonth = (day: string): string => {
  if (typeof day !== 'string') return '';
  const [year, month, d] = day.split('-').map(Number);
  const date = new Date(year, month - 1, d);
  return date.toLocaleDateString(getAppLocale(), { month: 'short' });
};

/**
 * The x-axis label a range should carry, coarsening as the window widens:
 * weekdays for a week, dates for a month of days, months beyond that.
 *
 * One function rather than the same ternary in each chart, which is how the
 * step and weight charts came to agree only by coincidence.
 */
export const formatXLabelForRange = (
  range: HealthTrendDateRange
): ((day: string) => string) => {
  if (RANGE_LABELS_WEEKDAYS.has(range)) return formatXLabel7d;
  if (RANGE_LABELS_MONTHS.has(range)) return formatXLabelMonth;
  return formatXLabel30d90d;
};

export const formatTooltipDate = (day: string): string => {
  const parts = day.split('-');
  if (parts.length < 3) return day;
  const [year, month, d] = parts.map(Number);
  const date = new Date(year, (month || 1) - 1, d || 1);
  return date.toLocaleDateString(getAppLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/** Formats chart tick values according to the active application locale. */
export const formatChartYLabel = (value: number): string =>
  value >= 1000
    ? new Intl.NumberFormat(getAppLocale(), {
        notation: 'compact',
        maximumFractionDigits: 0,
      }).format(value)
    : formatLocalizedNumber(value);

// d3's tick step for a span, the rule Victory's axis applies to its domain:
// the span over the tick count, rounded to 1, 2 or 5 times a power of ten.
const tickStep = (span: number, tickCount: number): number => {
  const rough = span / Math.max(1, tickCount);
  const power = 10 ** Math.floor(Math.log10(rough));
  const error = rough / power;
  const factor =
    error >= Math.sqrt(50)
      ? 10
      : error >= Math.sqrt(10)
        ? 5
        : error >= Math.sqrt(2)
          ? 2
          : 1;
  return factor * power;
};

/**
 * Widens a y domain out to the ticks either side of it, so the plot's top and
 * bottom edges are gridlines.
 *
 * Left at the data's own extremes, the highest value landed between two ticks:
 * the top gridline stopped short of the plot and the vertical grid ran on past
 * it, leaving a row of loose tails above the chart.
 */
export const niceTickDomain = (
  min: number,
  max: number,
  tickCount: number
): [number, number] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [min, max];
  }
  let low = min;
  let high = max;
  // As d3's `nice()`: a wider domain can pick a coarser step, so settle it.
  for (let pass = 0; pass < 10; pass += 1) {
    const step = tickStep(high - low, tickCount);
    const nextLow = Math.floor(low / step) * step;
    const nextHigh = Math.ceil(high / step) * step;
    if (nextLow === low && nextHigh === high) break;
    low = nextLow;
    high = nextHigh;
  }
  return [low, high];
};

/** The y tick count the range charts ask Victory for, and nice their domain to. */
export const Y_TICK_COUNT = 5;
