import DashboardCardTitle from './DashboardCardTitle';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import CardChevron from './CardChevron';
import CardPressable from './CardPressable';
import ChartCaption from './ChartCaption';
import Icon, { type IconName } from './Icon';
import { CHART_GRID_LINE_COLOR, CHART_X_AXIS_BAND } from '../constants/charts';
import { useChartRise } from '../hooks/useChartRise';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The dashboard card's plot height, which this component was built around. */
const DEFAULT_PLOT_HEIGHT = 88;
/** Room above the tallest bar and below the baseline, so neither touches an edge. */
const BASELINE_INSET = 8;
/** The gutter the scale is written in, when there is one. */
const Y_AXIS_WIDTH = 34;
/** Where the grid lines sit, as a share of the plot from the baseline up. */
const gridFractions = [0, 1 / 3, 2 / 3, 1];
/** Where the vertical grid lines sit, which is where the hour labels start. */
const hourTicks = [0, 6, 12, 18];
/** The chart's internal width; the SVG is stretched to whatever it is given. */
const VIEWBOX_WIDTH = 288;

/**
 * One hour's bar, growing out of the baseline.
 *
 * Its own component because each bar animates its own height, and hooks cannot
 * be called from the render loop above. They all read the one progress value
 * the chart owns, so the twenty-four rise together rather than drifting apart.
 * A path would have been one node instead of twenty-four, but it cannot carry
 * the rounded cap these bars have — and twenty-four is small enough that the
 * trade goes the other way here than it does on the 90-day trend sparkline.
 */
function HourBar({
  x,
  height,
  baseline,
  rx,
  color,
  progress,
}: {
  x: number;
  height: number;
  /** Where the bar stands, which moves with the plot's height. */
  baseline: number;
  rx: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const grown = height * progress.value;
    return { y: baseline - grown, height: grown };
  });
  return (
    <AnimatedRect
      animatedProps={animatedProps}
      x={x}
      width={8}
      rx={rx}
      fill={color}
    />
  );
}

interface ActivityMetricChartProps {
  title: string;
  icon: IconName;
  color: string;
  value?: number | null;
  goal?: number;
  unit: string;
  /** 24 hourly totals for the selected local day; null means unavailable. */
  hourlyValues?: readonly (number | null)[];
  /** Standing uses full-height bars for hours with standing activity. */
  binary?: boolean;
  /**
   * Renders the charted day's total, under the hour axis, as Apple's detail
   * charts do. Given the summed hourly value so a caller can print it as a
   * duration; omitted entirely, the line falls back to "<sum> <unit>".
   */
  formatTotal?: (total: number) => string;
  /**
   * Whether the headline figure is drawn above the chart.
   *
   * False on a screen whose summary card already states it: the same
   * "361/500 kcal" twice, a finger apart, reads as two different numbers that
   * happen to agree.
   */
  showValue?: boolean;
  /**
   * Drops every scrap of card chrome, for a screen where this is not a card
   * but one of several charts a range picker swaps between.
   *
   * It is not only about the icon and the title. A card stacks its parts down
   * the page — heading, figure, plot, hour labels, total — so its height is the
   * plot plus however much chrome it happens to carry, which is what left the
   * Day range visibly taller than the week beside it despite the two sharing a
   * plot height. Bare mirrors a range chart's box instead: one reserved caption
   * line, then a plot of exactly `plotHeight` with the hour labels *inside* it,
   * the way Victory draws its own x-axis. The two then occupy the same space to
   * the point.
   *
   * The day's total goes with the chrome, because the screen that uses this
   * prints it as the headline immediately above.
   */
  bare?: boolean;
  /**
   * The plot's height. The dashboard card keeps the short default; the goal
   * screen passes the shared chart height, so its Day range is the same size
   * as the ranges either side of it.
   */
  plotHeight?: number;
  /** Draws the scale down the left, the way the range charts do. */
  showYAxis?: boolean;
  /** Opens this metric's own screen. Omitted where there is nothing to open. */
  onOpen?: () => void;
}

export default function ActivityMetricChart({
  title,
  icon,
  color,
  value,
  goal,
  unit,
  hourlyValues,
  binary = false,
  formatTotal,
  showValue = true,
  bare = false,
  plotHeight = DEFAULT_PLOT_HEIGHT,
  showYAxis = false,
  onOpen,
}: ActivityMetricChartProps) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const number = (amount: number) =>
    formatLocalizedNumber(amount, { maximumFractionDigits: 0 });
  const hasSamples =
    hourlyValues?.some((amount) => amount != null && Number.isFinite(amount)) ??
    false;
  // The bars' own sum, not the headline figure above them: the headline is the
  // ring's number, which for Move deliberately excludes what the day's tracked
  // workouts already account for. A total under a chart has to add up to the
  // chart.
  const total = (hourlyValues ?? []).reduce<number>(
    (sum, amount) =>
      amount != null && Number.isFinite(amount) ? sum + amount : sum,
    0
  );
  // The box the bars are drawn in. Bare keeps the hour labels inside the height
  // it was given, so the whole chart measures `plotHeight` and not a label row
  // more; the card hangs them underneath as it always has.
  const plotArea = plotHeight - (bare ? CHART_X_AXIS_BAND : 0);
  // The foot of the plot, and the height a full bar stands. Both derive from
  // the box so the tallest bar tops out exactly on the highest grid line — it
  // used to stop eight points short of the line labelled with its own value.
  const baseline = plotArea - BASELINE_INSET;
  const span = baseline - BASELINE_INSET;
  const max = Math.max(
    1,
    ...(hourlyValues ?? []).filter(
      (amount): amount is number => amount != null && Number.isFinite(amount)
    )
  );
  const hourFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 0 = flat on the baseline, 1 = the day as recorded. Reset and replayed each
  // time the screen is focused, so the bars rise on every visit rather than
  // only the first — and so the chart has something to show from the first
  // frame instead of appearing when the hourly data lands.
  //
  // This chart set the gesture and the range charts now share the hook, which
  // is the point: the picker swaps one for another in the same slot, and they
  // have to move the same way for that to read as a range changing rather than
  // as an image being swapped.
  const progress = useChartRise(`${total}:${max}`, hasSamples);

  const hourLabels = (
    <View
      className="flex-row"
      // Indented past the scale so the hours line up with the plot rather than
      // with the labels beside it.
      style={[
        showYAxis ? { marginLeft: Y_AXIS_WIDTH } : null,
        bare ? { height: CHART_X_AXIS_BAND } : { marginTop: 4 },
      ]}
    >
      {hourTicks.map((hour) => (
        <Text key={hour} className="text-text-muted text-xs flex-1">
          {hourFormatter.format(new Date(2000, 0, 1, hour))}
        </Text>
      ))}
    </View>
  );

  const plot = (
    <View className="flex-row" style={{ height: plotArea }}>
      {/* The scale, when the chart is standing in for a range chart: the same
          four lines the grid draws, written down the left so the bars can be
          read against a number rather than against each other. */}
      {showYAxis ? (
        <View
          style={{ width: Y_AXIS_WIDTH, height: plotArea }}
          pointerEvents="none"
        >
          {gridFractions.map((fraction) => (
            <Text
              key={fraction}
              className="text-text-muted text-xs absolute right-1"
              style={{ top: baseline - span * fraction - 7 }}
            >
              {number(Math.round(max * fraction))}
            </Text>
          ))}
        </View>
      ) : null}
      <Svg
        width={showYAxis ? undefined : '100%'}
        height={plotArea}
        style={showYAxis ? { flex: 1 } : undefined}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${plotArea}`}
        preserveAspectRatio="none"
        accessible={false}
      >
        {/* Bare draws the grid the range charts draw — solid, grey, ruled both
            ways — because the picker swaps this chart for one of those in the
            same slot, and a dotted grid tinted with the metric's own colour
            read as a different kind of chart rather than as a shorter range.
            The card keeps the tinted dots: there it sits among other cards
            rather than among other ranges of itself. */}
        {bare
          ? hourTicks.map((hour) => {
              const x = (hour / 24) * VIEWBOX_WIDTH;
              return (
                <Line
                  key={`v${hour}`}
                  x1={x}
                  x2={x}
                  y1={baseline - span}
                  y2={baseline}
                  stroke={CHART_GRID_LINE_COLOR}
                  strokeWidth={1}
                />
              );
            })
          : null}
        {gridFractions.map((fraction) => {
          const y = baseline - span * fraction;
          return (
            <Line
              key={fraction}
              x1={0}
              x2={VIEWBOX_WIDTH}
              y1={y}
              y2={y}
              stroke={bare ? CHART_GRID_LINE_COLOR : color}
              strokeWidth={1}
              {...(bare ? {} : { strokeOpacity: 0.18, strokeDasharray: '1 3' })}
            />
          );
        })}
        {Array.from({ length: 24 }, (_, hour) => {
          const amount = hourlyValues?.[hour];
          if (amount == null || !Number.isFinite(amount) || amount <= 0)
            return null;
          const height = binary ? span : Math.max(2, (amount / max) * span);
          return (
            <HourBar
              key={hour}
              x={hour * 12 + 2}
              height={height}
              baseline={baseline}
              rx={binary ? 4 : 1}
              color={color}
              progress={progress}
            />
          );
        })}
      </Svg>
      {!hasSamples && (
        <View className="absolute inset-0 items-center justify-center px-4">
          <Text className="text-text-muted text-sm text-center bg-surface px-2 py-1">
            {t('dashboard.hourlyActivityUnavailable', {
              defaultValue: 'Hourly data unavailable',
            })}
          </Text>
        </View>
      )}
    </View>
  );

  if (bare) {
    return (
      <View>
        <ChartCaption />
        <View style={{ height: plotHeight }}>
          {plot}
          {hourLabels}
        </View>
      </View>
    );
  }

  return (
    <CardPressable accessibilityLabel={title} onPress={onOpen}>
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={20} color={color} />
        <DashboardCardTitle>{title}</DashboardCardTitle>
        <View className="flex-1" />
        {onOpen ? <CardChevron accessibilityLabel={title} /> : null}
      </View>
      {/* Nothing recorded reads as a real zero rather than an em dash: the
          metric is a count of what you did today, and "0/30 min" says that far
          more plainly than "— min". */}
      {showValue ? (
        <Text style={{ color }} className="text-3xl font-semibold mt-1 mb-3">
          {number(value ?? 0)}
          {goal && goal > 0 ? `/${number(goal)}` : ''} {unit}
        </Text>
      ) : (
        <View className="mb-3" />
      )}
      {plot}
      {hourLabels}
      {hasSamples ? (
        <Text
          style={{ color }}
          className="text-xs font-semibold uppercase tracking-wider mt-1"
        >
          {t('dashboard.activityTotal', {
            defaultValue: 'Total {{amount}}',
            amount: formatTotal
              ? formatTotal(total)
              : `${number(total)} ${unit}`,
          })}
        </Text>
      ) : null}
    </CardPressable>
  );
}
