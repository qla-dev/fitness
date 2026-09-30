import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { TFunction } from 'i18next';
import Icon from './Icon';
import { formatLocalizedNumber } from '../localization';
import type { CalorieTargetInfo } from '../services/calorieTarget';

/** "Cut −15 %", "Lean bulk +10 %", "Maintain": the goal mode in a few words. */
export function goalModeLabel(t: TFunction, info: CalorieTargetInfo): string {
  const names: Record<string, string> = {
    maintain: t('calorieTarget.modes.maintain', { defaultValue: 'Maintain' }),
    recomp: t('calorieTarget.modes.recomp', { defaultValue: 'Recomp' }),
    cut: t('calorieTarget.modes.cut', { defaultValue: 'Cut' }),
    high_cut: t('calorieTarget.modes.highCut', { defaultValue: 'High cut' }),
    lean_bulk: t('calorieTarget.modes.leanBulk', { defaultValue: 'Lean bulk' }),
    bulk: t('calorieTarget.modes.bulk', { defaultValue: 'Bulk' }),
    manual: t('calorieTarget.modes.manual', { defaultValue: 'Custom' }),
  };
  const name = names[info.goalMode] ?? names.maintain;
  if (!info.percent) return name;
  return t('calorieTarget.modeWithPercent', {
    defaultValue: '{{mode}} {{percent}}%',
    mode: name,
    percent: `${info.percent > 0 ? '+' : '−'}${formatLocalizedNumber(
      Math.abs(info.percent)
    )}`,
  });
}

/** "−300 kcal", "+200 kcal": what the settings did to the goal. */
export function adjustmentLabel(t: TFunction, info: CalorieTargetInfo) {
  return t('calorieTarget.adjustment', {
    defaultValue: '{{amount}} kcal',
    amount: `${info.adjustment > 0 ? '+' : '−'}${formatLocalizedNumber(
      Math.abs(Math.round(info.adjustment))
    )}`,
  });
}

/** True when the settings do something worth pointing out. */
export const isCalorieTargetActive = (
  info: CalorieTargetInfo | null | undefined
) => !!info && (info.adaptive || info.goalMode !== 'maintain' || info.clamped);

/**
 * The goal-mode state beside a calorie heading: AI adaptive when the
 * baseline is worked out from the body, then the goal mode and its
 * percentage. Opens the Calorie settings, where both are changed.
 */
export function CalorieModeChips({
  info,
  onPress,
}: {
  info: CalorieTargetInfo | null | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [accent, green, amber] = useCSSVariable([
    '--color-accent-primary',
    '--color-cat-green',
    '--color-icon-warning',
  ]) as string[];
  if (!isCalorieTargetActive(info) || !info) return null;
  const tone =
    info.adjustment < 0 ? amber : info.adjustment > 0 ? green : accent;
  const chip = (label: string, color: string, icon?: 'sparkles') => (
    <View
      key={label}
      className="flex-row items-center gap-1 rounded-full px-2 py-0.5 overflow-hidden"
    >
      {/* The tokens are hsl(), so the tint is a faded layer, not a hex alpha. */}
      <View
        className="absolute inset-0"
        style={{ backgroundColor: color, opacity: 0.14 }}
      />
      {icon ? <Icon name={icon} size={11} color={color} /> : null}
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('calorieTarget.openSettings', {
        defaultValue: 'Opens calorie settings',
      })}
      onPress={onPress}
      hitSlop={8}
      className="flex-row items-center gap-1.5 flex-shrink"
    >
      {info.adaptive
        ? chip(
            t('calorieTarget.aiAdaptive', { defaultValue: 'AI adaptive' }),
            accent,
            'sparkles'
          )
        : null}
      {info.goalMode !== 'maintain' ? chip(goalModeLabel(t, info), tone) : null}
    </Pressable>
  );
}
