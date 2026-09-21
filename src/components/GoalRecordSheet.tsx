import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Button from './ui/Button';
import NativePromptSheet from './ui/NativePromptSheet';
import { useCustomNutrients } from '../hooks';
import { goalsQueryKey } from '../hooks/queryKeys';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { localApiFetch } from '../services/local/localApi';
import {
  customGoalName,
  getProfileGoalLabel,
  getProfileGoalUnit,
  goalMaximum,
  isCustomGoalKey,
  readGoalValue,
} from '../constants/profileGoals';
import { getTodayDate } from '../utils/dateUtils';
import { formatLocalizedNumber } from '../localization';
import { fireSelectionHaptic } from '../services/haptics';
import Icon from './Icon';
import { useCSSVariable } from 'uniwind';

/** How far one tap moves a goal. Coarse on purpose: a goal is a round number. */
const GOAL_STEP = 5;

/** One round stepper. Its own component so a re-render does not remount it. */
function StepButton({
  icon,
  label,
  tint,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  tint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="rounded-full items-center justify-center"
      style={({ pressed }) => ({
        width: 68,
        height: 68,
        backgroundColor: tint,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={30} color="#FFF" />
    </Pressable>
  );
}

/**
 * One goal, edited in place.
 *
 * The same sheet the measurements use, for the same reason: changing a number
 * you are looking at should not take you to another screen and back. Nutrient
 * goals and activity goals are the same question — a number and a unit — so
 * they share it.
 */
export default function GoalRecordSheet({
  goalKey,
  onClose,
}: {
  goalKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { customNutrients } = useCustomNutrients();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const today = getTodayDate();
  const goalsQuery = useQuery({
    queryKey: goalsQueryKey(today),
    queryFn: () => fetchDailyGoals(today),
  });

  const label = getProfileGoalLabel(t, goalKey, customNutrients);
  const unit = getProfileGoalUnit(goalKey, customNutrients);
  const maximum = goalMaximum(goalKey);

  const stored = useMemo(() => {
    const value = readGoalValue(goalsQuery.data, goalKey);
    return value === undefined ? '' : String(value);
  }, [goalsQuery.data, goalKey]);

  // The stored value arrives with its query, usually after the first render.
  // Holding the edit as a nullable draft lets the field show what is on file
  // until the user types, without an effect copying one into the other.
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
    numeric >= 0 &&
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
        : { [goalKey]: numeric };
      await localApiFetch({ endpoint: '/api/goals', method: 'PUT', body });
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          ['goals', 'dailySummary', 'daily-summary'].includes(
            String(queryKey[0])
          ),
      });
      onClose();
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
    const next = Math.max(0, base + direction * GOAL_STEP);
    setDraft(String(maximum === undefined ? next : Math.min(next, maximum)));
  };

  return (
    <NativePromptSheet
      open
      onClose={onClose}
      dismissOnBackdropPress={false}
      title={label}
      description={t('profile.goalsHelp', {
        defaultValue:
          'New goals apply from today onward. Previous days keep their goals.',
      })}
      footer={
        <Button
          onPress={() => void save()}
          disabled={!valid || busy}
          loading={busy}
        >
          {t('profile.changeTodayGoal', {
            defaultValue: "Change today's goal",
          })}
        </Button>
      }
    >
      <View className="flex-row items-center justify-between">
        <StepButton
          icon="remove"
          label={t('profile.goalDecrease', { defaultValue: 'Decrease goal' })}
          tint={accentPrimary}
          disabled={busy || numeric <= 0}
          onPress={() => step(-1)}
        />
        <Text
          className="text-text-primary text-center"
          style={{ fontSize: 68, fontWeight: '300' }}
          numberOfLines={1}
        >
          {trimmed === '' ? '—' : formatLocalizedNumber(numeric)}
        </Text>
        <StepButton
          icon="add"
          label={t('profile.goalIncrease', { defaultValue: 'Increase goal' })}
          tint={accentPrimary}
          disabled={busy || (maximum !== undefined && numeric >= maximum)}
          onPress={() => step(1)}
        />
      </View>
      {unit ? (
        <Text className="text-text-secondary text-center text-base font-semibold mt-3 uppercase">
          {unit}
        </Text>
      ) : null}
      {failed ? (
        <Text
          accessibilityRole="alert"
          className="text-text-primary text-sm mt-4 text-center"
        >
          {t('profile.goalsSaveFailed', {
            defaultValue: 'Could not save goals. Please try again.',
          })}
        </Text>
      ) : null}
    </NativePromptSheet>
  );
}
