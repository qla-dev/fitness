import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';
import { adjustmentLabel, goalModeLabel } from './CalorieTargetChips';
import { formatLocalizedNumber } from '../localization';
import type { CalorieTargetInfo } from '../services/calorieTarget';

/**
 * Under the calorie goal: whether Goal Mode changes it and what today's
 * target comes to, the safety floor when it holds the target up, and
 * whether the baseline is AI adaptive. MarkAI can work the goal out; its
 * answer comes back here, filled in, for the user to apply.
 */
export default function CalorieGoalContext({
  info,
  prefilled,
  onOpenSettings,
  onAskMarkai,
}: {
  info: CalorieTargetInfo | null;
  /** The value on screen came from MarkAI and is not saved yet. */
  prefilled: boolean;
  onOpenSettings: () => void;
  onAskMarkai: () => void;
}) {
  const { t } = useTranslation();
  const [accent, green] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
  ]) as string[];
  const kcal = (value: number) =>
    t('calorieTarget.kcal', {
      defaultValue: '{{value}} kcal',
      value: formatLocalizedNumber(Math.round(value)),
    });
  const modeOn = !!info && info.goalMode !== 'maintain';

  return (
    <View className="mt-6 gap-3">
      {prefilled ? (
        <Text className="text-sm text-center" style={{ color: green }}>
          {t('calorieTarget.prefilled', {
            defaultValue:
              'Filled in by MarkAI. Review it, then change the goal to apply it.',
          })}
        </Text>
      ) : null}
      <SettingsRowGroup>
        <SettingsRow
          icon="settings"
          title={
            modeOn && info
              ? t('calorieTarget.goalModeOn', {
                  defaultValue: 'Goal mode on · {{mode}}',
                  mode: goalModeLabel(t, info),
                })
              : t('calorieTarget.goalModeOff', {
                  defaultValue: 'Goal mode off · Maintain',
                })
          }
          subtitle={
            info && info.target !== info.base
              ? t('calorieTarget.todayTarget', {
                  defaultValue:
                    "Today's target {{target}} ({{adjustment}} from {{base}})",
                  target: kcal(info.target),
                  adjustment: adjustmentLabel(t, info),
                  base: kcal(info.base),
                })
              : t('calorieTarget.noChange', {
                  defaultValue: 'Today’s target is this goal as it is.',
                })
          }
          subtitleNumberOfLines={0}
          onPress={onOpenSettings}
        />
        {info?.clamped && info.floor !== null ? (
          <SettingsRow
            icon="shield-checkmark"
            title={t('calorieTarget.floorTitle', {
              defaultValue: 'Safety floor holds the target',
            })}
            subtitle={t('calorieTarget.floorBody', {
              defaultValue:
                'Goal mode would go below {{floor}}, so today stops there.',
              floor: kcal(info.floor),
            })}
            subtitleNumberOfLines={0}
            onPress={onOpenSettings}
          />
        ) : null}
        {info?.adaptive ? (
          <SettingsRow
            icon="sparkles"
            iconColor={accent}
            title={t('calorieTarget.aiAdaptive', {
              defaultValue: 'AI adaptive',
            })}
            subtitle={t('calorieTarget.adaptiveBody', {
              defaultValue:
                'Maintenance is estimated at {{base}} from your body and activity, and adapts as you track.',
              base: kcal(info.base),
            })}
            subtitleNumberOfLines={0}
            onPress={onOpenSettings}
          />
        ) : null}
        <SettingsRow
          icon="sparkles"
          iconColor={accent}
          title={t('calorieTarget.askMarkai', {
            defaultValue: 'Work it out with MarkAI',
          })}
          subtitle={t('calorieTarget.askMarkaiBody', {
            defaultValue:
              'MarkAI calculates a goal from your details. You apply it yourself.',
          })}
          subtitleNumberOfLines={0}
          onPress={onAskMarkai}
        />
      </SettingsRowGroup>
    </View>
  );
}
