import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { fireSelectionHaptic } from '../../services/haptics';
import { formatLocalizedNumber } from '../../localization';

/**
 * The Activities calendar, taken apart so every month calendar in the app is
 * the same one: a row of weekday labels, then a horizontal pager of month
 * grids whose day cells are a number pill with optional content under it.
 * The ring calendar puts each day's rings there; the cycle calendar tints the
 * pill instead; a plain date picker leaves it as it is.
 */

export interface MonthKey {
  year: number;
  /** 0-based, as `Date` counts them. */
  month: number;
}

export const monthKey = (entry: MonthKey) => `${entry.year}-${entry.month}`;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Calendar days are built from their year/month/day numbers, never from a
 * Date round-trip: converting a picked instant back to a day string is what
 * shifted selections onto the following day.
 */
export const dayString = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** `YYYY-MM` for a month key. */
export const monthString = (entry: MonthKey) =>
  `${entry.year}-${pad(entry.month + 1)}`;

/**
 * Newest month first, `forward` months after the anchor's and `back` before
 * it. The pager is inverted, so index 0 sits on the right and swiping right
 * walks back in time; the anchor month is at index `forward`.
 */
export function monthsAround(
  anchor: string,
  back: number,
  forward = 0
): MonthKey[] {
  const [year, month] = anchor.split('-').map(Number);
  return Array.from({ length: back + forward + 1 }, (_, index) => {
    const date = new Date(year, month - 1 + forward - index, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
}

/** How a day's pill is drawn when it is not the selected day. */
export interface DayDecoration {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed';
  /** A small dot under the number, in this colour. */
  dot?: string;
  /** Identifies the pill to tests; the cycle calendar names its phase here. */
  testID?: string;
}

interface WeekdayHeaderProps {
  /** Short names indexed by `getDay()` (0 = Sunday). */
  names: string[];
  firstDayOfWeek: number;
  cellWidth: number;
  className?: string;
}

/** Weekday labels over the grid, in the user's first-day-of-week order. */
export function WeekdayHeader({
  names,
  firstDayOfWeek,
  cellWidth,
  className = '',
}: WeekdayHeaderProps) {
  return (
    <View className={`flex-row px-2 pb-2 ${className}`}>
      {Array.from({ length: 7 }, (_, index) => {
        const label = names[(firstDayOfWeek + index) % 7] ?? '';
        return (
          <Text
            key={`${label}-${index}`}
            style={{ width: cellWidth }}
            className="text-center text-xs font-semibold text-text-secondary uppercase"
          >
            {label}
          </Text>
        );
      })}
    </View>
  );
}

export interface CalendarMonthGridProps extends MonthKey {
  today: string;
  /** The highlighted day, or '' for none. */
  selectedDate: string;
  firstDayOfWeek: number;
  cellWidth: number;
  /** Every page is exactly one pager wide; its height comes from its rows. */
  pageWidth: number;
  onSelect: (date: string) => void;
  /** Side of the number pill. The ring calendar's is small; its rings sit under it. */
  labelSize?: number;
  /** Fades days after today, for pickers of things that already happened. */
  dimFuture?: boolean;
  /** Stops days after today from being picked as well. */
  disableFuture?: boolean;
  decorateDay?: (day: string) => DayDecoration | undefined;
  renderBelow?: (day: string, isFuture: boolean) => React.ReactNode;
}

const DAY_CELL_PADDING = 6;

export const CalendarMonthGrid = memo(function CalendarMonthGrid({
  year,
  month,
  today,
  selectedDate,
  firstDayOfWeek,
  cellWidth,
  pageWidth,
  onSelect,
  labelSize = 24,
  dimFuture = false,
  disableFuture = false,
  decorateDay,
  renderBelow,
}: CalendarMonthGridProps) {
  const [accent, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as [string, string];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() - firstDayOfWeek + 7) % 7;
  // A larger pill is a day picker's whole target, so its number reads larger.
  const fontSize = labelSize > 24 ? 15 : 13;

  return (
    <View className="px-2 pb-2" style={{ width: pageWidth }}>
      <View className="flex-row flex-wrap">
        {Array.from({ length: leading }, (_, index) => (
          <View key={`blank-${index}`} style={{ width: cellWidth }} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = dayString(year, month, index + 1);
          const isToday = day === today;
          const isSelected = day === selectedDate;
          const isFuture = day > today;
          const decoration = isSelected ? undefined : decorateDay?.(day);
          const color = isSelected
            ? '#FFFFFF'
            : (decoration?.color ?? (isToday ? accent : textPrimary));
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{
                selected: isSelected,
                disabled: disableFuture && isFuture,
              }}
              disabled={disableFuture && isFuture}
              onPress={() => onSelect(day)}
              style={{
                width: cellWidth,
                paddingVertical: DAY_CELL_PADDING,
                opacity: dimFuture && isFuture ? 0.35 : 1,
              }}
              className="items-center"
            >
              <View
                testID={decoration?.testID}
                className="items-center justify-center rounded-full"
                style={{
                  minWidth: labelSize,
                  height: labelSize,
                  paddingHorizontal: 4,
                  marginBottom: renderBelow ? 4 : 0,
                  backgroundColor: isSelected
                    ? accent
                    : (decoration?.backgroundColor ?? 'transparent'),
                  borderWidth: decoration?.borderColor ? 1.5 : 0,
                  borderColor: decoration?.borderColor,
                  borderStyle: decoration?.borderStyle,
                }}
              >
                <Text
                  style={{
                    color,
                    fontWeight: isToday || isSelected ? '700' : '500',
                    fontSize,
                  }}
                >
                  {formatLocalizedNumber(index + 1)}
                </Text>
                {decoration?.dot ? (
                  <View
                    testID={`logged-dot-${day}`}
                    className="absolute rounded-full"
                    style={{
                      bottom: 4,
                      width: 4,
                      height: 4,
                      backgroundColor: color,
                    }}
                  />
                ) : null}
              </View>
              {renderBelow?.(day, isFuture)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export interface MonthPagerRef {
  /** Pages to a month, as the chevrons of an inline calendar do. */
  goTo: (index: number) => void;
}

interface MonthPagerProps {
  months: MonthKey[];
  /** The page it opens on. */
  initialIndex?: number;
  /** The pager's width, which is also every page's. */
  width: number;
  /** `active` is true for the page on screen and every page settled on before. */
  renderMonth: (info: {
    item: MonthKey;
    index: number;
    active: boolean;
  }) => React.ReactNode;
  /** Fires once the page on screen has changed. */
  onIndexChange?: (index: number) => void;
}

/**
 * The months, one page each. Paging settles on whole pages, and the list is
 * as tall as the page on screen rather than the tallest month mounted.
 */
export const MonthPager = forwardRef<MonthPagerRef, MonthPagerProps>(
  function MonthPager(
    { months, initialIndex = 0, width, renderMonth, onIndexChange },
    ref
  ) {
    const listRef = useRef<FlatList<MonthKey>>(null);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    /**
     * Months are only marked active once they have been on screen, so a
     * calendar that loads data per month asks for the one being looked at and
     * nothing it was swiped past. Months already fetched stay active and keep
     * drawing from their cache.
     */
    const [activeMonths, setActiveMonths] = useState<Set<string>>(
      () =>
        new Set(months[initialIndex] ? [monthKey(months[initialIndex])] : [])
    );

    const settle = useCallback(
      (index: number) => {
        const entry = months[index];
        if (!entry) return;
        setCurrentIndex((previous) => {
          // A swipe that springs back to where it started is not a page turn.
          if (previous !== index) fireSelectionHaptic();
          return index;
        });
        setActiveMonths((previous) =>
          previous.has(monthKey(entry))
            ? previous
            : new Set(previous).add(monthKey(entry))
        );
      },
      [months]
    );

    const onIndexChangeRef = useRef(onIndexChange);
    useEffect(() => {
      onIndexChangeRef.current = onIndexChange;
    });
    useEffect(() => {
      onIndexChangeRef.current?.(currentIndex);
    }, [currentIndex]);

    useImperativeHandle(ref, () => ({
      goTo: (index: number) => {
        if (index < 0 || index >= months.length) return;
        listRef.current?.scrollToIndex({ index, animated: true });
        settle(index);
      },
    }));

    // Measured, never computed: the page reports what it actually laid out,
    // so no constant here has to stay in step with the cell's real size.
    const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
    const handlePageLayout = useCallback((index: number, height: number) => {
      setPageHeights((previous) =>
        previous[index] === height ? previous : { ...previous, [index]: height }
      );
    }, []);
    const visibleHeight = pageHeights[currentIndex];

    const getItemLayout = useCallback(
      (_: ArrayLike<MonthKey> | null | undefined, index: number) => ({
        length: width,
        offset: width * index,
        index,
      }),
      [width]
    );

    return (
      // A plain FlatList, not BottomSheetFlatList: that wrapper exists to hand
      // vertical scrolling to the sheet's drag gesture, and it does not drive
      // a horizontal pager. Nothing here scrolls vertically.
      <FlatList
        ref={listRef}
        data={months}
        keyExtractor={monthKey}
        horizontal
        // Native paging tracks the finger the whole way and only settles on a
        // page once it is released.
        pagingEnabled
        // Index 0 is the newest month; inverting the axis places it on the
        // right, so swiping right walks back the way a calendar reads.
        inverted
        initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
        showsHorizontalScrollIndicator={false}
        // Hard stop at both ends.
        bounces={false}
        overScrollMode="never"
        getItemLayout={getItemLayout}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        // A row stretches its children to the tallest by default, which would
        // make every page measure as tall as the longest month.
        contentContainerStyle={{ alignItems: 'flex-start' }}
        style={visibleHeight ? { height: visibleHeight } : undefined}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        onMomentumScrollEnd={(event) =>
          settle(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index }) => (
          <View
            onLayout={(event) =>
              handlePageLayout(index, event.nativeEvent.layout.height)
            }
          >
            {renderMonth({
              item,
              index,
              active: activeMonths.has(monthKey(item)),
            })}
          </View>
        )}
      />
    );
  }
);

/** Seven columns across a page carrying the grid's px-2 on each side. */
export const cellWidthFor = (pageWidth: number) =>
  Math.floor((pageWidth - 16) / 7);
