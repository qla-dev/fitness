import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import CalendarModal, { type CalendarModalRef } from './CalendarModal';
import {
  ACTIVITY_RING_COLORS,
  ringProgressFromParts,
  type ActivityRingProgress,
} from '../constants/activityRings';
import { fetchActivityRingsRange } from '../services/api/measurementsApi';
import { activityRingsRangeQueryKey } from '../hooks/queryKeys';
import { fireSelectionHaptic } from '../services/haptics';
import { getTodayDate } from '../utils/dateUtils';
import {
  getCalendarMonthNames,
  getCalendarWeekdayShortNames,
  useCalendarPresentation,
} from '../utils/calendarLocalization';
import {
  CalendarMonthGrid,
  MonthPager,
  WeekdayHeader,
  cellWidthFor,
  dayString,
  monthsAround,
  type MonthKey,
} from './calendar/MonthPager';

export interface RingCalendarSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface RingCalendarSheetProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Days (YYYY-MM-DD) flagged with a small dot, e.g. days with a photo. */
  markedDates?: string[];
  /**
   * Off, the same calendar is a plain date picker: no rings and no ring
   * data, larger day targets, and days after today cannot be picked (the
   * cycle setup's last period start).
   */
  rings?: boolean;
  /**
   * With rings off, still lets days after today in the current month be
   * picked: for logging ahead (a meal or a dose), not for things that have
   * already happened.
   */
  allowFuture?: boolean;
}

/** How many months before the current one the calendar scrolls back to. */
const MONTHS_BACK = 12;
const RING_SIZE = 38;
const RING_STROKE = 4;
/** The plain picker's day pill: the whole target once there are no rings. */
const PLAIN_LABEL_SIZE = 36;

/** Ring radii, outermost first; index 2 is the inner Steps ring. */
const ringRadius = (index: number) =>
  RING_SIZE / 2 - RING_STROKE / 2 - index * (RING_STROKE + 1);

/**
 * How much of the inner ring the loading sweep covers. Short of a full circle
 * on purpose: a closed ring turning on itself is indistinguishable from a
 * still one, and the point of this is to say the month is still on its way.
 */
const SPINNER_SWEEP = 0.72;
const SPINNER_DURATION_MS = 900;

const DayRings = memo(function DayRings({
  move,
  exercise,
  steps,
}: ActivityRingProgress) {
  const center = RING_SIZE / 2;
  const rings = [
    { color: ACTIVITY_RING_COLORS.move, value: move },
    { color: ACTIVITY_RING_COLORS.exercise, value: exercise },
    { color: ACTIVITY_RING_COLORS.steps, value: steps },
  ];
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} accessible={false}>
      {rings.map((ring, index) => {
        const radius = ringRadius(index);
        const length = 2 * Math.PI * radius;
        return (
          <React.Fragment key={ring.color}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ring.color}
              strokeOpacity={0.22}
              strokeWidth={RING_STROKE}
            />
            {ring.value > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${length * ring.value} ${length}`}
                rotation={-90}
                origin={`${center}, ${center}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
});

/**
 * Stands in for a day's rings while its month is still being read. Rings drawn
 * at zero and rings for a day that has not arrived yet look exactly alike, so
 * a swipe into a new month used to read as a month with nothing in it until
 * the values appeared. The sweep is the inner Steps ring's blue, on that same
 * radius, and every day of the month turns off one shared clock.
 */
const DayRingsLoading = memo(function DayRingsLoading({
  rotation,
}: {
  rotation: SharedValue<number>;
}) {
  const center = RING_SIZE / 2;
  const radius = ringRadius(2);
  const length = 2 * Math.PI * radius;
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      testID="day-rings-loading"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      {/* The tracks stay put, so the cell keeps the size and shape it will
          have once the real rings replace this. */}
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        accessible={false}
        style={{ position: 'absolute' }}
      >
        {[0, 1, 2].map((index) => (
          <Circle
            key={index}
            cx={center}
            cy={center}
            r={ringRadius(index)}
            fill="none"
            stroke={
              [
                ACTIVITY_RING_COLORS.move,
                ACTIVITY_RING_COLORS.exercise,
                ACTIVITY_RING_COLORS.steps,
              ][index]
            }
            strokeOpacity={0.22}
            strokeWidth={RING_STROKE}
          />
        ))}
      </Svg>
      <Animated.View style={[{ width: RING_SIZE, height: RING_SIZE }, style]}>
        <Svg width={RING_SIZE} height={RING_SIZE} accessible={false}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ACTIVITY_RING_COLORS.steps}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${length * SPINNER_SWEEP} ${length}`}
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
});

interface RingMonthProps extends MonthKey {
  /** Only a month that has been on screen fetches its ring data. */
  active: boolean;
  today: string;
  selectedDate: string;
  firstDayOfWeek: number;
  markedSet: Set<string>;
  cellWidth: number;
  pageWidth: number;
  onSelect: (date: string) => void;
}

const EMPTY_PROGRESS: ActivityRingProgress = { move: 0, exercise: 0, steps: 0 };

const RingMonth = memo(function RingMonth({
  year,
  month,
  active,
  today,
  markedSet,
  ...grid
}: RingMonthProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const first = dayString(year, month, 1);
  const last = dayString(year, month, daysInMonth);

  // One request for the whole month. Asking per day meant a separate read for
  // each of up to 31 days, into the same cache entries the Dashboard reads —
  // which made opening the calendar disturb what Home was showing.
  const rings = useQuery({
    queryKey: activityRingsRangeQueryKey(first, last),
    queryFn: () => fetchActivityRingsRange(first, last),
    enabled: active && first <= today,
  });

  // One shared clock for the whole month: 31 cells turning together off a
  // single value, rather than 31 animations that would drift apart.
  const loading = rings.isLoading;
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (!loading) {
      cancelAnimation(rotation);
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: SPINNER_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [loading, rotation]);

  const progressByDay = useMemo(() => {
    const map = new Map<string, ActivityRingProgress>();
    for (const day of rings.data ?? []) {
      map.set(day.entry_date, ringProgressFromParts(day));
    }
    return map;
  }, [rings.data]);

  return (
    <CalendarMonthGrid
      {...grid}
      year={year}
      month={month}
      today={today}
      dimFuture
      renderBelow={(day, isFuture) => {
        const progress = progressByDay.get(day) ?? EMPTY_PROGRESS;
        return (
          <View>
            {loading && !isFuture ? (
              <DayRingsLoading rotation={rotation} />
            ) : (
              <DayRings
                move={progress.move}
                exercise={progress.exercise}
                steps={progress.steps}
              />
            )}
            {markedSet.has(day) && (
              <View
                className="absolute rounded-full"
                style={{
                  top: 0,
                  right: -3,
                  width: 6,
                  height: 6,
                  backgroundColor: ACTIVITY_RING_COLORS.exercise,
                }}
              />
            )}
          </View>
        );
      }}
    />
  );
});

/**
 * Header date picker: months paged sideways, each day showing its Activities
 * rings (Move, Exercise, Steps), presented in the same custom sheet as the
 * "Log data into" menu. With `rings` off it is the app's plain date picker.
 */
const RingCalendarSheet = forwardRef<
  RingCalendarSheetRef,
  RingCalendarSheetProps
>(
  (
    {
      selectedDate,
      onSelectDate,
      markedDates,
      rings = true,
      allowFuture = false,
    },
    ref
  ) => {
    const sheetRef = useRef<CalendarModalRef>(null);
    const { t } = useTranslation();
    const { appLocale, presentation } = useCalendarPresentation();
    const { width } = useWindowDimensions();
    const today = getTodayDate();
    // Page 0 is the current month: the list opens there without scrolling.
    const months = useMemo(() => monthsAround(today, MONTHS_BACK), [today]);
    const monthNames = useMemo(
      () => getCalendarMonthNames(appLocale),
      [appLocale]
    );
    const weekdayNames = useMemo(
      () => getCalendarWeekdayShortNames(appLocale),
      [appLocale]
    );
    const markedSet = useMemo(() => new Set(markedDates ?? []), [markedDates]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const cellWidth = cellWidthFor(width);

    const handleSelect = useCallback(
      (date: string) => {
        fireSelectionHaptic();
        onSelectDate(date);
        sheetRef.current?.dismiss();
      },
      [onSelectDate]
    );

    // The page on screen names itself in the sheet header rather than above each
    // grid, so the month and year stay put while the days slide underneath.
    const visibleMonth = months[currentIndex] ?? months[0];
    const headerTitle = visibleMonth
      ? `${monthNames[visibleMonth.month] ?? ''} ${String(visibleMonth.year)}`
      : t('ringCalendar.title', { defaultValue: 'Calendar' });

    return (
      <CalendarModal ref={sheetRef} title={headerTitle}>
        <WeekdayHeader
          names={weekdayNames}
          firstDayOfWeek={presentation.firstDayOfWeek}
          cellWidth={cellWidth}
          className="border-b border-border-subtle"
        />
        <MonthPager
          months={months}
          width={width}
          onIndexChange={setCurrentIndex}
          renderMonth={({ item, active }) =>
            rings ? (
              <RingMonth
                year={item.year}
                month={item.month}
                active={active}
                today={today}
                selectedDate={selectedDate}
                firstDayOfWeek={presentation.firstDayOfWeek}
                markedSet={markedSet}
                cellWidth={cellWidth}
                pageWidth={width}
                onSelect={handleSelect}
              />
            ) : (
              <CalendarMonthGrid
                year={item.year}
                month={item.month}
                today={today}
                selectedDate={selectedDate}
                firstDayOfWeek={presentation.firstDayOfWeek}
                cellWidth={cellWidth}
                pageWidth={width}
                onSelect={handleSelect}
                labelSize={PLAIN_LABEL_SIZE}
                dimFuture={!allowFuture}
                disableFuture={!allowFuture}
              />
            )
          }
        />
      </CalendarModal>
    );
  }
);

RingCalendarSheet.displayName = 'RingCalendarSheet';
export default RingCalendarSheet;
