/**
 * How tall a chart's plot area is, everywhere one is drawn.
 *
 * One number rather than three, because the charts sit in the same slot on the
 * same screen: the range picker swaps one for another, and three heights meant
 * the page grew and shrank depending on which metric you were looking at. It
 * also has to cover the states that stand in for a plot — loading, empty,
 * failed — or a range that is still fetching collapses the surface and springs
 * it back.
 *
 * Generous on purpose. The y-axis labels are spaced by the plot's height, and
 * at the old 175 they sat close enough to read as a block of numbers rather
 * than as a scale.
 */
export const CHART_PLOT_HEIGHT = 306;

/**
 * The grid's colour and opacity, on every chart that draws one.
 *
 * A mid grey at half opacity, so it reads on light and on the true-black dark
 * theme alike. It used to be Victory's default 25% black, which was faint on
 * light and all but vanished on dark. It is passed in explicitly so the hourly
 * chart, which
 * draws its grid by hand in SVG, can match rather than approximate: it used to
 * draw dotted lines tinted with the metric's own colour, which read as a
 * different chart rather than as the same chart over a shorter range.
 */
export const CHART_GRID_LINE_COLOR = 'hsla(0, 0%, 50%, 0.5)';

/** The band an x-axis label sits in, below the plot and inside its box. */
export const CHART_X_AXIS_BAND = 18;

/**
 * How long a chart's series takes to rise out of its axis, everywhere one does.
 *
 * The hourly chart picked this first and it is the one that reads right, so it
 * is the number the range charts match rather than each carrying its own. The
 * bar and line charts used to hand Victory a 300ms path tween instead, which
 * is a different gesture at a different speed in the same slot: tapping D felt
 * like the day being drawn and tapping W felt like an image being swapped.
 */
export const CHART_RISE_MS = 650;
