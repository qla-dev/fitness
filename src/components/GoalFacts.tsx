import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CoverFact from './CoverFact';
import TextFact from './TextFact';
import SmallGraphFact, { type FactSeries } from './SmallGraphFact';
import type { IconName } from './Icon';
import type { ActivityGoalKey } from '../constants/activityGoals';
import type { HealthTrendKey } from '../constants/healthTrends';
import { goalFactCopy } from '../constants/goalFacts';
import { useGoalFactHistory } from '../hooks/useGoalFactHistory';
import {
  averageFact,
  factWindow,
  stepFactPeriods,
  stepPace,
  type GoalFactPoint,
} from '../utils/goalFacts';
import { addDays, getTodayDate } from '../utils/dateUtils';
import { formatSleepDuration } from '../utils/sleepDay';
import { formatLocalizedNumber, useAppLocale } from '../localization';

const covers = {
  steps: require('../../assets/goal-facts/steps.jpg'),
  move: require('../../assets/goal-facts/move.jpg'),
  exercise: require('../../assets/goal-facts/exercise.jpg'),
  stand: require('../../assets/goal-facts/stand.jpg'),
  distance: require('../../assets/goal-facts/distance.jpg'),
  water: require('../../assets/goal-facts/water.jpg'),
  weight: require('../../assets/goal-facts/weight.jpg'),
  sleep: require('../../assets/goal-facts/sleep.jpg'),
};

export default function GoalFacts({
  metric,
  date,
  title,
  icon,
  color,
  weightUnit,
  distanceUnit,
}: {
  metric: ActivityGoalKey | HealthTrendKey;
  date: string;
  title: string;
  icon: IconName;
  color: string;
  weightUnit: 'kg' | 'lbs';
  distanceUnit: 'km' | 'miles';
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { points, isLoading, isError } = useGoalFactHistory(
    metric,
    date,
    weightUnit,
    distanceUnit
  );
  const copy = goalFactCopy(t, metric);
  const formatValue = (value: number) => {
    if (metric === 'sleep') return formatSleepDuration(value, t);
    const amount = formatLocalizedNumber(value, {
      maximumFractionDigits:
        metric === 'weight' || metric === 'distance' ? 1 : 0,
    });
    const unit =
      metric === 'weight'
        ? weightUnit
        : metric === 'distance'
          ? distanceUnit === 'km'
            ? t('dashboard.activityKilometers', { defaultValue: 'km' })
            : t('dashboard.activityMiles', { defaultValue: 'mi' })
          : metric === 'water'
            ? t('goalFacts.ml', { defaultValue: 'ml' })
            : metric === 'move'
              ? t('dashboard.activityKcal', { defaultValue: 'kcal' })
              : metric === 'exercise'
                ? t('dashboard.activityMinutes', { defaultValue: 'min' })
                : metric === 'stand'
                  ? t('dashboard.activityHours', { defaultValue: 'h' })
                  : '';
    return `${amount}${unit ? ` ${unit}` : ''}`;
  };
  const dateLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(`${day}T12:00:00`)
    );
  const previousLabel = t('goalFacts.previous14', {
    defaultValue: 'Previous 14 days',
  });
  const recentLabel = t('goalFacts.last14', { defaultValue: 'Last 14 days' });
  const previous = factWindow(points, addDays(date, -27), addDays(date, -14));
  const recent = factWindow(points, addDays(date, -13), date);
  const compare = (label: string, data: GoalFactPoint[]): FactSeries => ({
    label,
    value: averageFact(data),
    values: data.map((p) => p.value),
  });
  const common = {
    title,
    icon,
    color,
    formatValue,
    emptyText: isLoading
      ? t('common.loading', { defaultValue: 'Loading...' })
      : isError
        ? t('goalFacts.loadFailed', {
            defaultValue:
              'Could not load comparisons. Try opening this screen again.',
          })
        : undefined,
  };
  const total = (rows: GoalFactPoint[]) =>
    rows.length ? rows.reduce((sum, p) => sum + p.value, 0) : null;
  const week = factWindow(points, addDays(date, -6), date);
  const lastWeek = factWindow(points, addDays(date, -13), addDays(date, -7));
  const detailSeries: FactSeries[] = (() => {
    if (metric === 'sleep' || metric === 'weight')
      return [
        {
          label: t('goalFacts.lowest', {
            defaultValue: 'Lowest · last 28 days',
          }),
          value: points.length ? Math.min(...points.map((p) => p.value)) : null,
        },
        {
          label: t('goalFacts.highest', {
            defaultValue: 'Highest · last 28 days',
          }),
          value: points.length ? Math.max(...points.map((p) => p.value)) : null,
        },
      ];
    if (metric === 'stand')
      return [
        compare(
          t('goalFacts.weekdays', { defaultValue: 'Weekday average' }),
          points.filter(
            (p) => ![0, 6].includes(new Date(`${p.day}T12:00:00`).getDay())
          )
        ),
        compare(
          t('goalFacts.weekends', { defaultValue: 'Weekend average' }),
          points.filter((p) =>
            [0, 6].includes(new Date(`${p.day}T12:00:00`).getDay())
          )
        ),
      ];
    return [
      {
        label: t('goalFacts.last7', { defaultValue: 'Last 7 days' }),
        value:
          metric === 'exercise'
            ? week.length
              ? week.filter((p) => p.value > 0).length
              : null
            : total(week),
      },
      {
        label: t('goalFacts.previous7', { defaultValue: 'Previous 7 days' }),
        value:
          metric === 'exercise'
            ? lastWeek.length
              ? lastWeek.filter((p) => p.value > 0).length
              : null
            : total(lastWeek),
      },
    ];
  })();
  const periods = stepFactPeriods(points, date);
  const monthLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(`${day}T12:00:00`)
    );
  const pace = stepPace(
    points,
    date,
    date === getTodayDate() ? Math.max(-1, new Date().getHours() - 1) : 23
  );
  const endValue = (values: number[]) =>
    values.length > 1 ? values[values.length - 1] : null;
  const padded = (start: string, days: number) => {
    const byDay = new Map(points.map((p) => [p.day, p.value]));
    return Array.from(
      { length: days },
      (_, i) => byDay.get(addDays(start, i)) ?? null
    );
  };
  return (
    <View className="px-4 pt-6" testID={`goal-facts-${metric}`}>
      <Text
        accessibilityRole="header"
        className="text-xl font-bold text-text-primary mb-4"
      >
        {t('goalFacts.heading', { defaultValue: 'Patterns & perspective' })}
      </Text>
      {metric === 'steps' ? (
        <>
          <SmallGraphFact
            {...common}
            variant="trend"
            body={t('goalFacts.steps.recentComparison', {
              defaultValue:
                'Your recent daily average, compared with the 13 days before it.',
            })}
            series={[
              {
                ...compare(
                  t('goalFacts.previous13', {
                    defaultValue: 'Previous 13 days',
                  }),
                  periods.earlier
                ),
                values: padded(addDays(date, -27), 13),
              },
              {
                ...compare(
                  t('goalFacts.last15', { defaultValue: 'Last 15 days' }),
                  periods.recent
                ),
                values: padded(addDays(date, -14), 15),
              },
            ]}
            labels={Array.from({ length: 28 }, (_, i) =>
              dateLabel(addDays(date, i - 27))
            )}
          />
          <SmallGraphFact
            {...common}
            body={t('goalFacts.steps.yearComparison', {
              defaultValue: 'Your daily step average this year and last year.',
            })}
            series={[
              compare(
                formatLocalizedNumber(Number(date.slice(0, 4)), {
                  useGrouping: false,
                }),
                periods.thisYear
              ),
              compare(
                formatLocalizedNumber(Number(date.slice(0, 4)) - 1, {
                  useGrouping: false,
                }),
                periods.lastYear
              ),
            ]}
          />
          <CoverFact
            title={copy.coverTitle}
            body={copy.coverBody}
            image={covers[metric]}
          />
          <SmallGraphFact
            {...common}
            body={t('goalFacts.steps.monthComparison', {
              defaultValue:
                'Your daily step average this month and last month.',
            })}
            series={[
              compare(monthLabel(date), periods.thisMonth),
              compare(
                monthLabel(addDays(`${date.slice(0, 7)}-01`, -1)),
                periods.lastMonth
              ),
            ]}
          />
          <SmallGraphFact
            {...common}
            variant="line"
            body={t('goalFacts.steps.paceComparison', {
              defaultValue:
                'Your pace through completed hours, alongside your typical day.',
            })}
            series={[
              {
                label: dateLabel(date),
                value: endValue(pace.current),
                values: pace.current,
              },
              {
                label: t('goalFacts.typical', {
                  defaultValue: 'Previous 28 days · average',
                }),
                value: endValue(pace.typical),
                values: pace.typical,
              },
            ]}
            labels={Array.from(
              { length: Math.max(pace.current.length, pace.typical.length) },
              (_, hour) =>
                new Intl.DateTimeFormat(locale, {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(2000, 0, 1, hour))
            )}
          />
        </>
      ) : (
        <>
          <SmallGraphFact
            {...common}
            variant="trend"
            body={copy.trendTitle}
            series={[
              {
                ...compare(previousLabel, previous),
                values: padded(addDays(date, -27), 14),
              },
              {
                ...compare(recentLabel, recent),
                values: padded(addDays(date, -13), 14),
              },
            ]}
            labels={Array.from({ length: 28 }, (_, i) =>
              dateLabel(addDays(date, i - 27))
            )}
          />
          <CoverFact
            title={copy.coverTitle}
            body={copy.coverBody}
            image={covers[metric]}
          />
          <SmallGraphFact
            {...common}
            body={copy.detailTitle}
            series={detailSeries}
            formatValue={
              metric === 'exercise'
                ? (value) =>
                    t('goalFacts.activeDays', {
                      count: value,
                      formattedCount: formatLocalizedNumber(value),
                      defaultValue: '{{formattedCount}} days with exercise',
                      defaultValue_one: '{{formattedCount}} day with exercise',
                      defaultValue_other:
                        '{{formattedCount}} days with exercise',
                    })
                : formatValue
            }
          />
        </>
      )}
      <TextFact title={copy.aboutTitle} body={copy.aboutBody} />
    </View>
  );
}
