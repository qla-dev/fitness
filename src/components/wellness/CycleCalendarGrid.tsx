import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import { addDays, compareDays, isHormonalBc } from '@workspace/shared';
import type {
  SharedCycle,
  SharedCycleDailyLog,
  SharedCycleSettings,
} from '@workspace/shared';
import Icon from '../Icon';
import { useWellnessTokens } from './theme/wellnessTokens';
import { getPhaseColor } from '../../utils/cycleDisplayUtils';
import { getTodayDate } from '../../utils/dateUtils';
import {
  getCalendarMonthNames,
  getCalendarWeekdayShortNames,
  useCalendarPresentation,
} from '../../utils/calendarLocalization';
import {
  CalendarMonthGrid,
  MonthPager,
  WeekdayHeader,
  cellWidthFor,
  monthString,
  monthsAround,
  type DayDecoration,
  type MonthPagerRef,
} from '../calendar/MonthPager';

/** Months either side of the opening one; the future holds the predictions. */
const MONTHS_BACK = 24;
const MONTHS_FORWARD = 12;
/** The day's tinted circle, the cell's whole target. */
const DAY_SIZE = 36;

interface CycleCalendarGridProps {
  initialDate: string; // YYYY-MM-DD, seeds the visible month
  onDayPress: (date: string) => void;
  cycles: SharedCycle[];
  logs: SharedCycleDailyLog[];
  settings: SharedCycleSettings;
  /** Fires with the visible YYYY-MM on mount and after month navigation. */
  onMonthChange?: (month: string) => void;
}

const CycleCalendarGrid: React.FC<CycleCalendarGridProps> = ({
  initialDate,
  onDayPress,
  cycles,
  logs,
  settings,
  onMonthChange,
}) => {
  const { t } = useTranslation();
  const tokens = useWellnessTokens();
  const { appLocale, presentation } = useCalendarPresentation();
  const [textPrimary] = useCSSVariable(['--color-text-primary']) as [string];
  const today = getTodayDate();

  // The Activities calendar's pager: newest month first, the opening one
  // MONTHS_FORWARD pages in.
  const months = useMemo(
    () => monthsAround(initialDate, MONTHS_BACK, MONTHS_FORWARD),
    [initialDate]
  );
  const initialIndex = MONTHS_FORWARD;
  const [index, setIndex] = useState(initialIndex);
  const pagerRef = useRef<MonthPagerRef>(null);
  const monthNames = useMemo(
    () => getCalendarMonthNames(appLocale),
    [appLocale]
  );
  const weekdayNames = useMemo(
    () => getCalendarWeekdayShortNames(appLocale),
    [appLocale]
  );

  const handleIndexChange = useCallback(
    (next: number) => {
      setIndex(next);
      const entry = months[next];
      if (entry) onMonthChange?.(monthString(entry));
    },
    [months, onMonthChange]
  );

  // Stats for prediction
  const stats = useMemo(() => {
    const completed = cycles.filter((c) => c.cycle_length && c.period_length);
    const cycleLengths = completed.map((c) => c.cycle_length!);
    const periodLengths = completed.map((c) => c.period_length!);

    return {
      avgCycleLength:
        settings?.avg_cycle_length_override ??
        (cycleLengths.length
          ? Math.round(
              cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
            )
          : 28),
      avgPeriodLength:
        settings?.avg_period_length_override ??
        (periodLengths.length
          ? Math.round(
              periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
            )
          : 5),
    };
  }, [cycles, settings]);

  // Periods are not expected in these modes, so cycle predictions are hidden
  // entirely; fertility markers are additionally hidden on hormonal birth
  // control or when the user turns off the fertile window.
  const suppressPredictions =
    settings.mode === 'pregnant' ||
    settings.mode === 'postpartum' ||
    settings.mode === 'menopause';
  const suppressFertility =
    suppressPredictions ||
    isHormonalBc(settings.birth_control_method) ||
    settings.show_fertile_window === false;

  // Compute Predictions
  const predictions = useMemo(() => {
    if (suppressPredictions) return null;
    const lastCycle = cycles[0]; // descending order
    if (!lastCycle || !lastCycle.start_date) return null;

    const count = 4;
    const predictedCycles = [];
    let currentStart = lastCycle.start_date;
    const luteal = settings?.luteal_phase_length ?? 14;

    for (let i = 0; i < count; i++) {
      const nextStart = addDays(currentStart, stats.avgCycleLength);
      const nextEnd = addDays(nextStart, stats.avgPeriodLength - 1);

      let ovulation: string | null = null;
      let fertileStart: string | null = null;
      let fertileEnd: string | null = null;

      if (!suppressFertility) {
        ovulation = addDays(nextStart, -luteal);
        fertileStart = addDays(ovulation, -5);
        fertileEnd = addDays(ovulation, 1);
      }

      predictedCycles.push({
        periodStart: nextStart,
        periodEnd: nextEnd,
        ovulation,
        fertileStart,
        fertileEnd,
      });

      currentStart = nextStart;
    }

    return { cycles: predictedCycles };
  }, [cycles, stats, settings, suppressPredictions, suppressFertility]);

  // Decoration mapping for grid rendering
  const decoratedDaysMap = useMemo(() => {
    const map: Record<
      string,
      'period' | 'predicted-period' | 'fertile' | 'ovulation' | 'none'
    > = {};

    // 1. Predicted days
    if (predictions) {
      predictions.cycles.forEach((pc) => {
        // Predicted period
        let start = pc.periodStart;
        while (compareDays(start, pc.periodEnd) <= 0) {
          map[start] = 'predicted-period';
          start = addDays(start, 1);
        }
        // Predicted fertile window
        if (pc.fertileStart && pc.fertileEnd) {
          let fStart = pc.fertileStart;
          while (compareDays(fStart, pc.fertileEnd) <= 0) {
            map[fStart] = 'fertile';
            fStart = addDays(fStart, 1);
          }
        }
        // Ovulation day
        if (pc.ovulation) {
          map[pc.ovulation] = 'ovulation';
        }
      });
    }

    // 2. Logged period days override predictions
    logs.forEach((log) => {
      const isPeriod =
        (log.flow_level && log.flow_level !== 'none') ||
        Object.keys(log.product_usage ?? {}).length > 0;
      if (isPeriod) {
        map[log.entry_date] = 'period';
      }
    });

    return map;
  }, [logs, predictions]);

  const loggedDays = useMemo(
    () => new Set(logs.map((log) => log.entry_date)),
    [logs]
  );

  const decorateDay = useCallback(
    (day: string): DayDecoration => {
      const phase = decoratedDaysMap[day] || 'none';
      const testID = `cycle-day-${day}-${phase}`;
      const dot = loggedDays.has(day) ? textPrimary : undefined;
      if (phase === 'period') {
        const color = getPhaseColor('menstrual', tokens);
        return { testID, dot, color, backgroundColor: color + '26' };
      }
      if (phase === 'predicted-period') {
        const color = getPhaseColor('menstrual', tokens);
        return {
          testID,
          dot,
          color,
          backgroundColor: color + '14',
          borderColor: color,
          borderStyle: 'dashed',
        };
      }
      if (phase === 'fertile') {
        const color = getPhaseColor('fertile', tokens);
        return { testID, dot, color, backgroundColor: color + '26' };
      }
      if (phase === 'ovulation') {
        const color = getPhaseColor('ovulation', tokens);
        return {
          testID,
          dot,
          color,
          backgroundColor: color + '26',
          borderColor: color,
        };
      }
      return { testID, dot };
    },
    [decoratedDaysMap, loggedDays, textPrimary, tokens]
  );

  // The pager pages by its own width, which only the card knows.
  // A first guess from the window keeps the grid drawn before layout.
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth - 32);
  const cellWidth = cellWidthFor(width);
  const visible = months[index] ?? months[initialIndex];
  const title = visible
    ? `${monthNames[visible.month] ?? ''} ${String(visible.year)}`
    : '';

  return (
    <View
      className="bg-surface rounded-xl py-4"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* Month Header Navigation */}
      <View className="flex-row justify-between items-center mb-3 px-4">
        <TouchableOpacity
          onPress={() => pagerRef.current?.goTo(index + 1)}
          disabled={index >= months.length - 1}
          accessibilityLabel={t('cycleCalendar.previousMonth', {
            defaultValue: 'Previous month',
          })}
          className="p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text className="text-text-primary text-base font-bold">{title}</Text>
        <TouchableOpacity
          onPress={() => pagerRef.current?.goTo(index - 1)}
          disabled={index <= 0}
          accessibilityLabel={t('cycleCalendar.nextMonth', {
            defaultValue: 'Next month',
          })}
          className="p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-forward" size={20} color={textPrimary} />
        </TouchableOpacity>
      </View>

      {width > 0 && (
        <>
          <WeekdayHeader
            names={weekdayNames}
            firstDayOfWeek={presentation.firstDayOfWeek}
            cellWidth={cellWidth}
          />
          <MonthPager
            ref={pagerRef}
            months={months}
            initialIndex={initialIndex}
            width={width}
            onIndexChange={handleIndexChange}
            renderMonth={({ item }) => (
              <CalendarMonthGrid
                year={item.year}
                month={item.month}
                today={today}
                selectedDate=""
                firstDayOfWeek={presentation.firstDayOfWeek}
                cellWidth={cellWidth}
                pageWidth={width}
                onSelect={onDayPress}
                labelSize={DAY_SIZE}
                decorateDay={decorateDay}
              />
            )}
          />
        </>
      )}

      {/* Calendar Color Legend */}
      {/* One row: a label too long for its share shrinks rather than pushing
          the last one onto a line of its own. */}
      <View className="mt-2 mx-4 pt-3 border-t border-border-subtle flex-row justify-between gap-2 px-1">
        <View className="flex-row items-center gap-1 shrink">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: getPhaseColor('menstrual', tokens) + '35',
            }}
          />
          <Text
            className="text-text-secondary text-xs shrink"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t('cycleCalendar.legend.period', { defaultValue: 'Period' })}
          </Text>
        </View>

        {!suppressPredictions && (
          <View className="flex-row items-center gap-1 shrink">
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: getPhaseColor('menstrual', tokens) + '26',
                borderWidth: 1,
                borderColor: getPhaseColor('menstrual', tokens),
                borderStyle: 'dashed',
              }}
            />
            <Text
              className="text-text-secondary text-xs shrink"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t('cycleCalendar.legend.predictedPeriod', {
                defaultValue: 'Predicted',
              })}
            </Text>
          </View>
        )}

        {!suppressFertility && (
          <>
            <View className="flex-row items-center gap-1 shrink">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: getPhaseColor('fertile', tokens) + '35',
                }}
              />
              <Text
                className="text-text-secondary text-xs shrink"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t('cycleCalendar.legend.fertileWindow', {
                  defaultValue: 'Fertile',
                })}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 shrink">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: getPhaseColor('ovulation', tokens) + '26',
                  borderWidth: 1.5,
                  borderColor: getPhaseColor('ovulation', tokens),
                }}
              />
              <Text
                className="text-text-secondary text-xs shrink"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t('cycleCalendar.legend.estimatedOvulation', {
                  defaultValue: 'Ovulation',
                })}
              </Text>
            </View>
          </>
        )}

        <View className="flex-row items-center gap-1 shrink">
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: textPrimary,
            }}
          />
          <Text
            className="text-text-secondary text-xs shrink"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t('cycleCalendar.legend.logged', { defaultValue: 'Logged' })}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default CycleCalendarGrid;
