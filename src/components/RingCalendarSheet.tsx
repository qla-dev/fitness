import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useQueries, useQuery } from '@tanstack/react-query';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import CustomModal, { type CustomModalRef } from './CustomModal';
import {
  ACTIVITY_RING_COLORS,
  activityRingProgress,
  type ActivityRingProgress,
} from '../constants/activityRings';
import {
  buildDailySummary,
  loadDailySummaryRawData,
} from '../services/dailySummaryService';
import { fetchMeasurementsRange } from '../services/api/measurementsApi';
import {
  dailySummaryQueryKey,
  measurementsRangeQueryKey,
} from '../hooks/queryKeys';
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

// Fixed geometry so FlatList can place every month without measuring it:
// unmeasured rows are rendered, measured and re-rendered around a scroll jump,
// which left the list blank while dozens of ring SVGs redrew.
const MONTH_HEADER_HEIGHT = 44;
const MONTH_BOTTOM_PADDING = 16;
const DAY_LABEL_HEIGHT = 24;
const DAY_CELL_PADDING = 6;
const DAY_CELL_HEIGHT = DAY_CELL_PADDING * 2 + DAY_LABEL_HEIGHT + 4 + RING_SIZE;

// Must be a stable object: FlatList throws if it changes between renders.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10 };

function monthHeight(year: number, month: number, firstDayOfWeek: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() - firstDayOfWeek + 7) % 7;
  const rows = Math.ceil((leading + daysInMonth) / 7);
  return MONTH_HEADER_HEIGHT + rows * DAY_CELL_HEIGHT + MONTH_BOTTOM_PADDING;
}

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

function monthsUpTo(today: string): MonthKey[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: MONTHS_BACK + 1 }, (_, index) => {
    const date = new Date(year, month - 1 - (MONTHS_BACK - index), 1);
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
  monthLabel: string;
  markedSet: Set<string>;
  cellWidth: number;
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
  monthLabel,
  markedSet,
  cellWidth,
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

  // Same query keys as the Dashboard, so days already opened there are cached.
  const summaries = useQueries({
    queries: pastDays.map((day) => ({
      queryKey: dailySummaryQueryKey(day),
      queryFn: () => loadDailySummaryRawData(day),
      select: (raw: Awaited<ReturnType<typeof loadDailySummaryRawData>>) =>
        buildDailySummary(day, raw),
      enabled: active,
    })),
  });
  const steps = useQuery({
    queryKey: measurementsRangeQueryKey(first, last),
    queryFn: () => fetchMeasurementsRange(first, last),
    enabled: active && pastDays.length > 0,
  });

  const stepsByDay = useMemo(() => {
    const map = new Map<string, number | null | undefined>();
    for (const row of steps.data ?? []) map.set(row.entry_date, row.steps);
    return map;
  }, [steps.data]);

  return (
    <View
      className="px-2"
      style={{ height: monthHeight(year, month, firstDayOfWeek) }}
    >
      <Text
        className="text-text-primary text-xl font-bold px-2 capitalize"
        style={{ height: MONTH_HEADER_HEIGHT, lineHeight: MONTH_HEADER_HEIGHT }}
      >
        {monthLabel}
      </Text>
      <View className="flex-row flex-wrap">
        {Array.from({ length: leading }, (_, index) => (
          <View key={`blank-${index}`} style={{ width: cellWidth }} />
        ))}
        {days.map((day, index) => {
          const summaryIndex = pastDays.indexOf(day);
          const summary =
            summaryIndex >= 0 ? summaries[summaryIndex]?.data : undefined;
          const progress = summary
            ? activityRingProgress(summary, stepsByDay.get(day))
            : EMPTY_PROGRESS;
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
                height: DAY_CELL_HEIGHT,
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  const handleSelect = useCallback(
    (date: string) => {
      fireSelectionHaptic();
      onSelectDate(date);
      sheetRef.current?.dismiss();
    },
    [onSelectDate]
  );

  // Stable for the list's lifetime: FlatList rejects a changing handler.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: MonthKey }[] }) => {
      setActiveMonths((previous) => {
        const next = new Set(previous);
        for (const { item } of viewableItems) {
          next.add(`${item.year}-${item.month}`);
        }
        return next.size === previous.size ? previous : next;
      });
    },
    []
  );

  const layouts = useMemo(() => {
    let offset = 0;
    return months.map((entry) => {
      const length = monthHeight(
        entry.year,
        entry.month,
        presentation.firstDayOfWeek
      );
      const layout = { length, offset };
      offset += length;
      return layout;
    });
  }, [months, presentation.firstDayOfWeek]);
  const getItemLayout = useCallback(
    (_: ArrayLike<MonthKey> | null | undefined, index: number) => ({
      ...layouts[index],
      index,
    }),
    [layouts]
  );

  // Weekday labels follow the user's first day of week.
  const orderedWeekdays = Array.from(
    { length: 7 },
    (_, index) => weekdayNames[(presentation.firstDayOfWeek + index) % 7] ?? ''
  );

  return (
    <CustomModal
      ref={sheetRef}
      title={t('ringCalendar.title', { defaultValue: 'Calendar' })}
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
      <BottomSheetFlatList
        data={months}
        keyExtractor={(item: MonthKey) => `${item.year}-${item.month}`}
        // Leaves room above the sheet so it never reaches full height.
        style={{ height: height * 0.6 }}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        // iOS would otherwise pad the list with the window safe areas, pushing
        // the last weeks out of reach; only the home indicator is cleared.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }: { item: MonthKey }) => (
          <MonthGrid
            year={item.year}
            month={item.month}
            active={activeMonths.has(`${item.year}-${item.month}`)}
            today={today}
            selectedDate={selectedDate}
            firstDayOfWeek={presentation.firstDayOfWeek}
            monthLabel={`${monthNames[item.month] ?? ''} ${String(item.year)}`}
            markedSet={markedSet}
            cellWidth={cellWidth}
            onSelect={handleSelect}
          />
        )}
      />
    </CustomModal>
  );
});

RingCalendarSheet.displayName = 'RingCalendarSheet';
export default RingCalendarSheet;
