import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import PromptScreen from '../components/ui/PromptScreen';
import SheetStepper from '../components/ui/SheetStepper';
import WaterBottleIcon from '../components/icons/measurements/WaterBottleIcon';
import Icon from '../components/Icon';
import { MACRO_RINGS } from '../constants/macroRings';
import { useCustomNutrients } from '../hooks';
import { goalsQueryKey } from '../hooks/queryKeys';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { localApiFetch } from '../services/local/localApi';
import {
  customGoalName,
  getProfileGoalLabel,
  getProfileGoalGlyph,
  getProfileGoalUnit,
  goalMaximum,
  goalMinimum,
  goalStep,
  isCustomGoalKey,
  isWeightGoalKey,
  readGoalValue,
} from '../constants/profileGoals';
import { usePreferences } from '../hooks/usePreferences';
import { weightFromKg, weightToKg } from '../utils/unitConversions';
import { getTodayDate } from '../utils/dateUtils';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';
import type { RootStackScreenProps } from '../types/navigation';

/**
 * One goal, edited on its own.
 *
 * A modal route rather than a bottom sheet, for one reason: only a route gets
 * the navigator's header, and only that header's items are real system
 * buttons. Drawn inside a sheet they can only ever be an imitation — a circle
 * with a hand-written radius and an opacity change where the system has a
 * material and a press animation.
 */
export default function GoalEditScreen({
  navigation,
  route,
}: RootStackScreenProps<'GoalEdit'>) {
  const { goalKey } = route.params;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { customNutrients } = useCustomNutrients();
  // The macros carry their own mark and colour on the Tracker; a goal without
  // one — a micronutrient, a custom nutrient — takes the accent and no glyph,
  // rather than borrowing another nutrient's identity.
  const macro = MACRO_RINGS.find((ring) => ring.key === goalKey);
  const [accentPrimary, macroColor] = useCSSVariable([
    '--color-accent-primary',
    macro?.colorVar ?? '--color-accent-primary',
  ]) as [string, string];
  // A goal that is neither a macro nor hydration carries the mark and colour
  // of the card it was opened from, rather than a bare number under a title.
  const glyph = getProfileGoalGlyph(goalKey);
  const tint = macro ? macroColor : (glyph?.color ?? accentPrimary);
  const today = getTodayDate();
  const goalsQuery = useQuery({
    queryKey: goalsQueryKey(today),
    queryFn: () => fetchDailyGoals(today),
  });

  // A weight goal is stored in kilograms and edited in whatever unit the user
  // reads weights in, so the value, the bounds and the unit label all cross the
  // same boundary. Everything else passes through untouched.
  const { preferences } = usePreferences();
  const weightUnit: 'kg' | 'lbs' =
    preferences?.default_weight_unit === 'lbs' ? 'lbs' : 'kg';
  const isWeight = isWeightGoalKey(goalKey);
  const toDisplay = (kg: number) =>
    isWeight ? Math.round(weightFromKg(kg, weightUnit) * 10) / 10 : kg;
  const toStored = (shown: number) =>
    isWeight ? weightToKg(shown, weightUnit) : shown;

  const label = getProfileGoalLabel(t, goalKey, customNutrients);
  const unit = getProfileGoalUnit(goalKey, customNutrients, weightUnit);
  const storedMaximum = goalMaximum(goalKey);
  const maximum =
    storedMaximum === undefined ? undefined : toDisplay(storedMaximum);
  // Same floor ProfileEdit enforces: a 0 kcal target divides every
  // "remaining" by zero, so calories cannot be stepped or typed down to it.
  const minimum = toDisplay(goalMinimum(goalKey));
  const stepSize = goalStep(goalKey);

  const stored = useMemo(() => {
    const value = readGoalValue(goalsQuery.data, goalKey);
    return value === undefined ? '' : String(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsQuery.data, goalKey, isWeight, weightUnit]);

  // The stored value arrives with its query, usually after the first render.
  // Holding the edit as a nullable draft lets the number show what is on file
  // until the user changes it, without an effect copying one into the other.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const saving = useRef(false);
  const value = draft ?? stored;

  const trimmed = value.trim();
  const numeric = Number(trimmed.replace(',', '.'));
  const valid =
    trimmed.length > 0 &&
    Number.isFinite(numeric) &&
    numeric >= minimum &&
    (maximum === undefined || numeric <= maximum);

  const save = async () => {
    if (saving.current || !valid || busy || !goalsQuery.data) return;
    saving.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const body: Record<string, unknown> = isCustomGoalKey(goalKey)
        ? {
            custom_nutrients: {
              ...goalsQuery.data?.custom_nutrients,
              [customGoalName(goalKey)]: numeric,
            },
          }
        : { [goalKey]: toStored(numeric) };
      await localApiFetch({ endpoint: '/api/goals', method: 'PUT', body });
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          ['goals', 'dailySummary', 'daily-summary'].includes(
            String(queryKey[0])
          ),
      });
      navigation.goBack();
    } catch {
      setFailed(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const step = (direction: 1 | -1) => {
    fireSelectionHaptic();
    const base = Number.isFinite(numeric) ? numeric : 0;
    const next = Math.max(minimum, base + direction * stepSize);
    setDraft(String(maximum === undefined ? next : Math.min(next, maximum)));
  };

  return (
    <PromptScreen
      headerTitle={t('profile.goals', { defaultValue: 'Goals' })}
      title={label}
      description={t('profile.goalsHelp', {
        defaultValue:
          'New goals apply from today onward. Previous days keep their goals.',
      })}
      footerLabel={t('profile.changeTodayGoal', {
        defaultValue: "Change today's goal",
      })}
      onFooterPress={() => void save()}
      footerDisabled={!valid || busy}
      footerLoading={busy}
      // The goal's own colour, the same one the badge above it carries.
      footerTint={tint}
    >
      <SheetStepper
        badge={
          goalKey === 'water_goal_ml' ? (
            // Hydration carries no macro ring, but it has a mark of its own:
            // the bottle the tracker tile draws, filled here because a goal
            // has no "so far".
            <WaterBottleIcon
              size={72}
              color={tint}
              accentColor={tint}
              fill={1}
            />
          ) : macro ? (
            <macro.Glyph size={44} color={tint} accentColor={tint} />
          ) : glyph ? (
            <Icon name={glyph.icon} size={56} color={glyph.color} />
          ) : null
        }
        tint={tint}
        value={trimmed === '' ? '—' : formatLocalizedNumber(numeric)}
        unit={unit || undefined}
        decrementLabel={t('profile.goalDecrease', {
          defaultValue: 'Decrease goal',
        })}
        incrementLabel={t('profile.goalIncrease', {
          defaultValue: 'Increase goal',
        })}
        decrementDisabled={busy || numeric <= minimum}
        incrementDisabled={
          busy || (maximum !== undefined && numeric >= maximum)
        }
        onDecrement={() => step(-1)}
        onIncrement={() => step(1)}
      />
      {failed ? (
        <View className="mt-4">
          <Text
            accessibilityRole="alert"
            className="text-text-primary text-sm text-center"
          >
            {t('profile.goalsSaveFailed', {
              defaultValue: 'Could not save goals. Please try again.',
            })}
          </Text>
        </View>
      ) : null}
    </PromptScreen>
  );
}
