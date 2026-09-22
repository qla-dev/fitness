import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import PromptScreen from '../components/ui/PromptScreen';
import SheetStepper from '../components/ui/SheetStepper';
import WaterBottleIcon from '../components/icons/measurements/WaterBottleIcon';
import { useDailySummary } from '../hooks/useDailySummary';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * How much you have drunk today, counted in servings.
 *
 * No text field: water is counted in servings of whatever container you drink
 * from, the way every other surface in the app records it, so the screen opens
 * without a keyboard and puts the count where a thumb reaches both steppers.
 *
 * The day's totals are read here rather than passed in as params. A route
 * survives longer than the press that opened it — the number has to follow the
 * mutation, not the value that was on screen when you tapped.
 */
export default function WaterEditScreen({
  navigation,
  route,
}: RootStackScreenProps<'WaterEdit'>) {
  const { date } = route.params;
  const { t } = useTranslation();
  const [accentPrimary, iconDecorative] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
  ]) as [string, string];
  const { summary } = useDailySummary({ date });
  const consumedMl = summary?.waterConsumed ?? 0;
  const goalMl = summary?.waterGoal ?? 0;
  const water = useWaterIntakeMutation({ date });
  const serving = water.servingVolume ?? 250;

  const step = (direction: 1 | -1) => {
    fireSelectionHaptic();
    if (direction === 1) water.increment();
    else water.decrement();
  };

  return (
    <PromptScreen
      headerTitle={t('measurements.title', { defaultValue: 'Measurements' })}
      title={t('measurements.water', { defaultValue: 'Water' })}
      description={
        goalMl > 0
          ? t('measurements.waterSheetGoal', {
              defaultValue:
                'Add what you have drunk today, one {{serving}} ml serving at a time. Your goal is {{goal}} ml.',
              serving: formatLocalizedNumber(serving, {
                maximumFractionDigits: 0,
              }),
              goal: formatLocalizedNumber(goalMl, { maximumFractionDigits: 0 }),
            })
          : t('measurements.waterSheet', {
              defaultValue:
                'Add what you have drunk today, one {{serving}} ml serving at a time.',
              serving: formatLocalizedNumber(serving, {
                maximumFractionDigits: 0,
              }),
            })
      }
      footerLabel={t('common.done', { defaultValue: 'Done' })}
      onFooterPress={() => navigation.goBack()}
    >
      <SheetStepper
        badge={
          <WaterBottleIcon
            size={72}
            color={iconDecorative}
            accentColor={accentPrimary}
            fill={goalMl > 0 ? consumedMl / goalMl : 0}
          />
        }
        tint={accentPrimary}
        value={formatLocalizedNumber(consumedMl, { maximumFractionDigits: 0 })}
        unit={t('measurements.waterUnit', { defaultValue: 'ml today' })}
        decrementLabel={t('measurements.waterRemove', {
          defaultValue: 'Remove a serving',
        })}
        incrementLabel={t('measurements.waterAdd', {
          defaultValue: 'Add a serving',
        })}
        decrementDisabled={consumedMl <= 0}
        onDecrement={() => step(-1)}
        onIncrement={() => step(1)}
      />
    </PromptScreen>
  );
}
