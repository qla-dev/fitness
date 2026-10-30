import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { localizedWeekdayLabels } from '../../utils/medicationScheduleLocalization';
import Icon from '../Icon';
import PromptSheet from '../ui/PromptSheet';

export interface WeekdaySheetRef {
  present: () => void;
  dismiss: () => void;
}

interface WeekdaySheetProps {
  /** Selected days as day-of-week indices (0 = Sunday … 6 = Saturday). */
  value: number[];
  onChange: (days: number[]) => void;
}

/** Multi-select sheet for a schedule's days_of_week (GoalEdit's PromptSheet).
 * Selecting a day toggles it without closing, so several days can be picked
 * in one visit; Done closes it. */
const WeekdaySheet = forwardRef<WeekdaySheetRef, WeekdaySheetProps>(
  ({ value, onChange }, ref) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const accentPrimary = useCSSVariable('--color-accent-primary') as string;

    useImperativeHandle(ref, () => ({
      present: () => setOpen(true),
      dismiss: () => setOpen(false),
    }));

    const toggle = (day: number) => {
      const next = value.includes(day)
        ? value.filter((d) => d !== day)
        : [...value, day];
      onChange(next.sort((a, b) => a - b));
    };

    const weekdayLabels = localizedWeekdayLabels(t);

    return (
      <PromptSheet
        open={open}
        onClose={() => setOpen(false)}
        headerTitle=""
        title={t('medications.weekdays.title', {
          defaultValue: 'Days of Week',
        })}
        footerLabel={t('common.done', { defaultValue: 'Done' })}
        onFooterPress={() => setOpen(false)}
        topAligned
      >
        <View className="bg-surface rounded-2xl overflow-hidden">
          {weekdayLabels.map((label, day) => {
            const selected = value.includes(day);
            return (
              <TouchableOpacity
                key={label}
                className={`flex-row items-center justify-between px-4 py-3.5 ${
                  day < weekdayLabels.length - 1
                    ? 'border-b border-border-subtle'
                    : ''
                }`}
                style={
                  day < weekdayLabels.length - 1
                    ? { borderBottomWidth: StyleSheet.hairlineWidth }
                    : undefined
                }
                onPress={() => toggle(day)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('medications.weekdays.itemA11y', {
                  defaultValue: '{{day}}, {{state}}',
                  day: label,
                  state: selected
                    ? t('medications.weekdays.selected', {
                        defaultValue: 'selected',
                      })
                    : t('medications.weekdays.notSelected', {
                        defaultValue: 'not selected',
                      }),
                })}
                accessibilityState={{ selected }}
              >
                <Text
                  className={`text-base text-text-primary ${selected ? 'font-semibold' : ''}`}
                >
                  {label}
                </Text>
                {selected && (
                  <Icon name="checkmark" size={20} color={accentPrimary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </PromptSheet>
    );
  }
);

WeekdaySheet.displayName = 'WeekdaySheet';

export default WeekdaySheet;
