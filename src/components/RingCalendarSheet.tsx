import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import CustomModal, { type CustomModalRef } from './CustomModal';
import {
  ACTIVITY_RING_COLORS,
  ringProgressFromParts,
  type ActivityRingProgress,
} from '../constants/activityRings';
import { fetchActivityRingsRange } from '../services/api/measurementsApi';
import { activityRingsRangeQueryKey } from '../hooks/queryKeys';
import { fireSelectionHaptic } from '../services/haptics';
import { formatLocalizedNumber } from '../localization';
import { getTodayDate } from '../utils/dateUtils';
import {
  getCalendarMonthNames,
  getCalendarWeekdayShortNames,
  useCalendarPresentation,
} from '../utils/calendarLocalization';

export interface RingCalendarSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface RingCalendarSheetProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Days (YYYY-MM-DD) flagged with a small dot, e.g. days with a photo. */
  markedDates?: string[];
}

/** How many months before the current one the calendar scrolls back to. */
const MONTHS_BACK = 12;
const RING_SIZE = 38;
const RING_STROKE = 4;

// Only the day-number pill has a size of its own; every enclosing box takes
// its height from what it contains, so a four-row month is shorter than a
// six-row one and the sheet follows.
const DAY_LABEL_HEIGHT = 24;
const DAY_CELL_PADDING = 6;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Calendar days are built from their year/month/day numbers, never from a
 * Date round-trip: converting a picked instant back to a day string is what
 * shifted selections onto the following day.
 */
const dayString = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

interface MonthKey {
  year: number;
  month: number;
}

/**
 * Newest month first, so the current month is index 0 and the list opens on it
 * with no scroll. Oldest-first relied on `initialScrollIndex` jumping twelve
 * months forward, and inside the bottom sheet that jump did not land: the
 * calendar opened a year in the past, on months with no data and therefore no
 * rings. The list is inverted, so page 0 sits on the right and swiping right
 * moves to an older month; there is no month after the current one.
 */
function monthsUpTo(today: string): MonthKey[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: MONTHS_BACK + 1 }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
}

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
        const radius = center - RING_STROKE / 2 - index * (RING_STROKE + 1);
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

interface MonthGridProps extends MonthKey {
  /** Only months on screen fetch their ring data. */
  active: boolean;
  today: string;
  selectedDate: string;
  firstDayOfWeek: number;
  markedSet: Set<string>;
  cellWidth: number;
  /** Every page is exactly one sheet wide; its height comes from its own rows. */
  pageWidth: number;
  onSelect: (date: string) => void;
}

const EMPTY_PROGRESS: ActivityRingProgress = { move: 0, exercise: 0, steps: 0 };

const MonthGrid = memo(function MonthGrid({
  year,
  month,
  active,
  today,
  selectedDate,
  firstDayOfWeek,
  markedSet,
  cellWidth,
  pageWidth,
  onSelect,
}: MonthGridProps) {
  const [accent, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as [string, string];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() - firstDayOfWeek + 7) % 7;
  const days = Array.from({ length: daysInMonth }, (_, index) =>
    dayString(year, month, index + 1)
  );
  const pastDays = days.filter((day) => day <= today);
  const first = days[0];
  const last = days[days.length - 1];

  // One request for the whole month. Asking per day meant a separate read for
  // each of up to 31 days, into the same cache entries the Dashboard reads —
  // which made opening the calendar disturb what Home was showing.
  const rings = useQuery({
    queryKey: activityRingsRangeQueryKey(first, last),
    queryFn: () => fetchActivityRingsRange(first, last),
    enabled: active && pastDays.length > 0,
  });

  const progressByDay = useMemo(() => {
    const map = new Map<string, ActivityRingProgress>();
    for (const day of rings.data ?? []) {
      map.set(day.entry_date, ringProgressFromParts(day));
    }
    return map;
  }, [rings.data]);

  return (
    <View className="px-2 pb-2" style={{ width: pageWidth }}>
      <View className="flex-row flex-wrap">
        {Array.from({ length: leading }, (_, index) => (
          <View key={`blank-${index}`} style={{ width: cellWidth }} />
        ))}
        {days.map((day, index) => {
          const progress = progressByDay.get(day) ?? EMPTY_PROGRESS;
          const isToday = day === today;
          const isSelected = day === selectedDate;
          const isFuture = day > today;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(day)}
              style={{
                width: cellWidth,
                paddingVertical: DAY_CELL_PADDING,
                opacity: isFuture ? 0.35 : 1,
              }}
              className="items-center"
            >
              <View
                className="items-center justify-center rounded-full mb-1"
                style={{
                  minWidth: DAY_LABEL_HEIGHT,
                  height: DAY_LABEL_HEIGHT,
                  paddingHorizontal: 4,
                  backgroundColor: isSelected ? accent : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: isSelected
                      ? '#FFFFFF'
                      : isToday
                        ? accent
                        : textPrimary,
                    fontWeight: isToday || isSelected ? '700' : '500',
                    fontSize: 13,
                  }}
                >
                  {formatLocalizedNumber(index + 1)}
                </Text>
              </View>
              <View>
                <DayRings
                  move={progress.move}
                  exercise={progress.exercise}
                  steps={progress.steps}
                />
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/**
 * Header date picker: months stacked vertically, each day showing its
 * Activities rings (Move, Exercise, Steps), presented in the same custom sheet
 * as the "Log data into" menu.
 */
const RingCalendarSheet = forwardRef<
  RingCalendarSheetRef,
  RingCalendarSheetProps
>(({ selectedDate, onSelectDate, markedDates }, ref) => {
  const sheetRef = useRef<CustomModalRef>(null);
  const { t } = useTranslation();
  const { appLocale, presentation } = useCalendarPresentation();
  const { width } = useWindowDimensions();
  const today = getTodayDate();
  const months = useMemo(() => monthsUpTo(today), [today]);
  const monthNames = useMemo(
    () => getCalendarMonthNames(appLocale),
    [appLocale]
  );
  const weekdayNames = useMemo(
    () => getCalendarWeekdayShortNames(appLocale),
    [appLocale]
  );
  const markedSet = useMemo(() => new Set(markedDates ?? []), [markedDates]);
  const [activeMonths, setActiveMonths] = useState<Set<string>>(new Set());
  // Page 0 is the current month: the list opens there without scrolling.
  const [currentIndex, setCurrentIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const cellWidth = Math.floor((width - 16) / 7);
  const [selectedYear, selectedMonth] = selectedDate.split('-').map(Number);
  const initialIndex = Math.max(
    0,
    months.findIndex(
      (entry) =>
        entry.year === selectedYear && entry.month === selectedMonth - 1
    )
  );

  /**
   * The month the sheet opens on, plus its neighbours, load without waiting to
   * be reported visible. `onViewableItemsChanged` does not reliably fire for
   * the initial screenful of a list that opens at `initialScrollIndex` inside
   * a bottom sheet, and when it did not, no month was ever marked active and
   * every day rendered an empty ring — including today's.
   */
  const alwaysActive = useMemo(() => {
    const keys = new Set<string>();
    for (let index = initialIndex - 1; index <= initialIndex + 1; index += 1) {
      const entry = months[index];
      if (entry) keys.add(`${entry.year}-${entry.month}`);
    }
    return keys;
  }, [months, initialIndex]);

  const handleSelect = useCallback(
    (date: string) => {
      fireSelectionHaptic();
      onSelectDate(date);
      sheetRef.current?.dismiss();
    },
    [onSelectDate]
  );

  // A page spans the full sheet width and carries the same px-2 as the weekday
  // header above it, so the seven ring columns line up with the seven labels.
  const pageWidth = width;

  // Measured, never computed: the page reports what it actually laid out, so
  // no constant here has to stay in step with the cell's real size.
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
  const handlePageLayout = useCallback((index: number, height: number) => {
    setPageHeights((previous) =>
      previous[index] === height ? previous : { ...previous, [index]: height }
    );
  }, []);
  const visibleHeight = pageHeights[currentIndex];

  // Paging settles on whole pages, so the index is exact rather than inferred
  // from partial visibility — and it only fires once the finger has let go.
  const onMomentumScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setCurrentIndex((previous) => {
        // Only when a different month has actually settled: a swipe that
        // springs back to where it started should not feel like a page turn.
        if (previous !== index) fireSelectionHaptic();
        return index;
      });
      setActiveMonths((previous) => {
        const next = new Set(previous);
        for (let step = index - 1; step <= index + 1; step += 1) {
          const entry = months[step];
          if (entry) next.add(`${entry.year}-${entry.month}`);
        }
        return next.size === previous.size ? previous : next;
      });
    },
    [months, pageWidth]
  );

  // The page on screen names itself in the sheet header rather than above each
  // grid, so the month and year stay put while the days slide underneath.
  const visibleMonth = months[currentIndex] ?? months[0];
  const headerTitle = visibleMonth
    ? `${monthNames[visibleMonth.month] ?? ''} ${String(visibleMonth.year)}`
    : t('ringCalendar.title', { defaultValue: 'Calendar' });

  const getItemLayout = useCallback(
    (_: ArrayLike<MonthKey> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth]
  );

  // Weekday labels follow the user's first day of week.
  const orderedWeekdays = Array.from(
    { length: 7 },
    (_, index) => weekdayNames[(presentation.firstDayOfWeek + index) % 7] ?? ''
  );

  return (
    <CustomModal
      ref={sheetRef}
      title={headerTitle}
    >
      <View className="flex-row px-2 pb-2 border-b border-border-subtle">
        {orderedWeekdays.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={{ width: cellWidth }}
            className="text-center text-xs font-semibold text-text-secondary uppercase"
          >
            {label}
          </Text>
        ))}
      </View>
      {/* A plain FlatList, not BottomSheetFlatList: that wrapper exists to
          hand vertical scrolling to the sheet's drag gesture, and it does not
          drive a horizontal pager — the months would not move at all. Nothing
          here scrolls vertically. */}
      <FlatList
        data={months}
        keyExtractor={(item: MonthKey) => `${item.year}-${item.month}`}
        horizontal
        // Native paging tracks the finger the whole way and only settles on a
        // page once it is released — no snapping mid-gesture.
        pagingEnabled
        // Page 0 is the current month; inverting the axis places it on the
        // right, so swiping right walks back through the year the way a
        // calendar reads.
        inverted
        showsHorizontalScrollIndicator={false}
        // Hard stop at both ends: there is no month after the current one, and
        // nothing before the oldest.
        bounces={false}
        overScrollMode="never"
        getItemLayout={getItemLayout}
        // iOS would otherwise pad the list with the window safe areas, pushing
        // the last weeks out of reach; only the home indicator is cleared.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        // Pages are laid out in a row, and a row stretches its children to the
        // tallest one by default — which made every page measure as tall as the
        // longest month and defeated the measurement below. Aligning to the
        // start lets each page keep its own height.
        contentContainerStyle={{ alignItems: 'flex-start' }}
        // Every page sits in one row, so the list would otherwise stand as tall
        // as the tallest month currently mounted — a five-row month shown next
        // to a six-row one left an empty band under the last week. Tracking the
        // measured height of the page on screen keeps it exact.
        style={visibleHeight ? { height: visibleHeight } : undefined}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }: { item: MonthKey; index: number }) => (
          <View
            onLayout={(event) =>
              handlePageLayout(index, event.nativeEvent.layout.height)
            }
          >
            <MonthGrid
              year={item.year}
              month={item.month}
              active={
                activeMonths.has(`${item.year}-${item.month}`) ||
                alwaysActive.has(`${item.year}-${item.month}`)
              }
              today={today}
              selectedDate={selectedDate}
              firstDayOfWeek={presentation.firstDayOfWeek}
              markedSet={markedSet}
              cellWidth={cellWidth}
              pageWidth={pageWidth}
              onSelect={handleSelect}
            />
          </View>
        )}
      />
    </CustomModal>
  );
});

RingCalendarSheet.displayName = 'RingCalendarSheet';
export default RingCalendarSheet;
