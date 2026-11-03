import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import PromptSheet from '../ui/PromptSheet';
import FormInput from '../FormInput';
import Switch from '../ui/Switch';
import { useCycleHistory } from '../../hooks/useCycleHistory';
import { formatDate } from '../../utils/dateUtils';
import { getAppLocale } from '../../localization';

/**
 * Logs a cycle starting on the day picked in the calendar: what the History
 * tab's manual card used to ask, as the app's one sheet. The day comes from
 * the calendar, so the sheet asks only for the lengths.
 */
export default function CycleStartSheet({
  open,
  date,
  onClose,
}: {
  open: boolean;
  /** YYYY-MM-DD, the day the cycle starts. */
  date: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { createCycle } = useCycleHistory();
  const [periodLength, setPeriodLength] = useState('5');
  const [cycleLength, setCycleLength] = useState('28');
  const [isExcluded, setIsExcluded] = useState(false);

  // Closing resets the fields, so every opening starts from the usual lengths.
  const close = () => {
    setPeriodLength('5');
    setCycleLength('28');
    setIsExcluded(false);
    onClose();
  };

  return (
    <PromptSheet
      open={open}
      onClose={close}
      headerTitle=""
      title={t('cycleHistory.logStartTitle', {
        defaultValue: 'Cycle start',
      })}
      description={formatDate(date, getAppLocale())}
      topAligned
      footerLabel={t('cycleHistory.saveManual', {
        defaultValue: 'Save Manual Cycle',
      })}
      onFooterPress={() => {
        createCycle({
          start_date: date,
          period_length: parseInt(periodLength, 10) || 5,
          cycle_length: parseInt(cycleLength, 10) || 28,
          is_excluded: isExcluded,
        });
        close();
      }}
    >
      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-text-secondary text-xs mb-1">
              {t('cycleHistory.periodDays', { defaultValue: 'Period Days' })}
            </Text>
            <FormInput
              value={periodLength}
              onChangeText={setPeriodLength}
              keyboardType="number-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-text-secondary text-xs mb-1">
              {t('cycleHistory.cycleDays', { defaultValue: 'Cycle Days' })}
            </Text>
            <FormInput
              value={cycleLength}
              onChangeText={setCycleLength}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-text-primary text-base flex-1 mr-3">
            {t('cycleHistory.excludeFromPredictions', {
              defaultValue: 'Exclude from predictions',
            })}
          </Text>
          <Switch value={isExcluded} onValueChange={setIsExcluded} />
        </View>
      </View>
    </PromptSheet>
  );
}
