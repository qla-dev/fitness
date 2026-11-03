import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { useCycleHistory } from '../../hooks/useCycleHistory';
import CycleBarGlyph from './CycleBarGlyph';
import SwipeableDeleteRow from '../SwipeableDeleteRow';
import { formatLongDate } from '../../utils/dateUtils';
import { getAppLocale } from '../../localization';

const CycleHistoryList: React.FC = () => {
  const { t } = useTranslation();
  const dateLocale = getAppLocale();
  const { cycles, deleteCycle } = useCycleHistory();
  const maxCycleLength = cycles.reduce(
    (max, c) => Math.max(max, c.cycle_length || 0),
    0
  );
  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <Text className="text-text-primary text-base font-bold">
          {t('cycleHistory.title', { defaultValue: 'Cycle History' })}
        </Text>
      </View>

      {/* A cycle is logged from the calendar above: tapping its first day
          offers "Log the start of a cycle" in the footer. */}
      {cycles.length === 0 ? (
        <View className="bg-surface rounded-xl p-4 border-0 items-center">
          <Text className="text-text-secondary text-sm">
            {t('cycleHistory.empty', { defaultValue: 'No logged cycles yet.' })}
          </Text>
        </View>
      ) : (
        <View className="bg-surface rounded-xl border-0 overflow-hidden">
          {cycles.map((c, idx) => (
            <SwipeableDeleteRow
              key={c.id || c.start_date}
              title={t('cycleHistory.startedAccessibility', {
                defaultValue: 'Cycle started {{date}}',
                date: formatLongDate(c.start_date, dateLocale),
              })}
              onConfirmDelete={() => c.id && deleteCycle(c.id)}
              className={`p-3.5 ${idx < cycles.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <Text className="text-text-primary font-semibold text-sm">
                {t('cycleHistory.started', {
                  defaultValue: 'Started {{date}}',
                  date: formatLongDate(c.start_date, dateLocale),
                })}
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                {c.cycle_length
                  ? t('cycleHistory.dayCycle', {
                      defaultValue: '{{count}} day cycle',
                      count: c.cycle_length,
                    })
                  : t('cycleHistory.currentCycle', {
                      defaultValue: 'Current cycle',
                    })}{' '}
                •{' '}
                {t('cycleHistory.dayPeriod', {
                  defaultValue: '{{count}} day periods',
                  defaultValue_one: '{{count}} day period',
                  defaultValue_other: '{{count}} day periods',
                  count: c.period_length || 5,
                })}
              </Text>
              {c.cycle_length && c.period_length && (
                <View className="mt-2">
                  <CycleBarGlyph
                    cycleLength={c.cycle_length}
                    periodLength={c.period_length}
                    maxLength={maxCycleLength}
                  />
                </View>
              )}
            </SwipeableDeleteRow>
          ))}
        </View>
      )}
    </View>
  );
};

export default CycleHistoryList;
