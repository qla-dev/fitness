import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import PillInput from '../components/ui/PillInput';
import { useCustomNutrients } from '../hooks';
import { goalsQueryKey, profileQueryKey } from '../hooks/queryKeys';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { fetchProfile } from '../services/api/profileApi';
import { localApiFetch } from '../services/local/localApi';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  customGoalName,
  getProfileGoalLabel,
  getProfileGoalUnit,
  goalMaximum,
  goalMinimum,
  isCustomGoalKey,
  readGoalValue,
} from '../constants/profileGoals';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';

type ProfileEditScreenProps = RootStackScreenProps<'ProfileEdit'>;

/**
 * One value, one screen — the Profile card and the goals list both drill in
 * here instead of opening a sheet, so every profile edit gets the same chrome,
 * the same Save button, and a real back stack.
 *
 * The goals list and the appearance list are their own screens (`ProfileGoals`,
 * `ProfileTheme`), not modes of this route: a list is not an edit of a single
 * value, and folding them in here is what made an earlier draft depend on
 * embedded editor components that no longer exist.
 */
const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  route,
  navigation,
}) => {
  const params = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const queryClient = useQueryClient();
  const input = useRef<TextInput>(null);

  const isGoal = params.field === 'goal';
  const goalKey = params.field === 'goal' ? params.goalKey : '';
  const today = getTodayDate();

  const { customNutrients } = useCustomNutrients({
    enabled: isGoal && isCustomGoalKey(goalKey),
  });
  const goalsQuery = useQuery({
    queryKey: goalsQueryKey(today),
    queryFn: () => fetchDailyGoals(today),
    enabled: isGoal,
  });
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled: !isGoal,
  });

  const label = isGoal
    ? getProfileGoalLabel(t, goalKey, customNutrients)
    : t('profile.name', { defaultValue: 'Name' });
  const unit = isGoal ? getProfileGoalUnit(goalKey, customNutrients) : '';
  const maximum = isGoal ? goalMaximum(goalKey) : undefined;
  const minimum = isGoal ? goalMinimum(goalKey) : 0;

  const storedName = profileQuery.data?.full_name ?? '';
  const storedGoal = readGoalValue(goalsQuery.data, goalKey);
  const stored = useMemo(
    () =>
      isGoal
        ? storedGoal === undefined
          ? ''
          : String(storedGoal)
        : storedName,
    [isGoal, storedGoal, storedName]
  );

  // The stored value arrives with its query, which usually resolves after the
  // first render. Holding the edit as a nullable draft rather than seeding
  // state lets the field show the stored value until the user types, without
  // an effect that copies one into the other.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const saving = useRef(false);
  const value = draft ?? stored;
  const touched = draft !== null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const trimmed = value.trim();
  const numeric = Number(trimmed.replace(',', '.'));
  const valid = isGoal
    ? trimmed.length > 0 &&
      Number.isFinite(numeric) &&
      numeric >= minimum &&
      (maximum === undefined || numeric <= maximum)
    : trimmed.length > 0;

  const save = async () => {
    if (saving.current || !valid || busy) return;
    if (isGoal && !goalsQuery.data) return;
    saving.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (isGoal) {
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
      } else {
        await localApiFetch({
          endpoint: '/api/identity/profiles',
          method: 'PUT',
          body: { full_name: trimmed },
        });
        await queryClient.invalidateQueries({ queryKey: profileQueryKey });
      }
      navigation.goBack();
    } catch {
      setFailed(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const header = useScreenHeader({
    title: label,
    // The route is registered without a title: which value is edited is only
    // known from the params, so the screen owns the native title too.
    nativeTitle: label,
    left: { kind: 'back', disabled: busy },
    right: {
      kind: 'primary',
      busy,
      disabled: !valid,
      onPress: () => void save(),
    },
  });

  const invalidNumber = isGoal && touched && trimmed.length > 0 && !valid;

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <View className="px-4 pt-4" style={{ paddingBottom: insets.bottom }}>
        <PillInput
          ref={input}
          accessibilityLabel={label}
          value={value}
          onChangeText={setDraft}
          unit={unit}
          placeholder={
            isGoal
              ? t('profile.goalPlaceholder', {
                  defaultValue: 'Enter a value',
                })
              : t('profile.namePlaceholder', {
                  defaultValue: 'Enter your name',
                })
          }
          keyboardType={isGoal ? 'decimal-pad' : 'default'}
          autoCapitalize={isGoal ? 'none' : 'words'}
          autoComplete={isGoal ? 'off' : 'name'}
          maxLength={isGoal ? 12 : 100}
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        {(failed || invalidNumber) && (
          <Text
            accessibilityRole="alert"
            className="text-text-primary text-sm mt-3"
          >
            {failed
              ? isGoal
                ? t('profile.goalsSaveFailed', {
                    defaultValue: 'Could not save goals. Please try again.',
                  })
                : t('profile.nameSaveFailed', {
                    defaultValue: 'Could not save your name. Please try again.',
                  })
              : minimum > 0
                ? t('profile.goalsInvalidMinimum', {
                    defaultValue: 'Enter a number of at least {{minimum}}.',
                    minimum,
                  })
                : t('profile.goalsInvalid', {
                    defaultValue:
                      'Enter a positive number or zero. Stand hours cannot exceed 24.',
                  })}
          </Text>
        )}
        {isGoal && (
          <Text className="text-text-secondary text-sm mt-3">
            {t('profile.goalsHelp', {
              defaultValue:
                'New goals apply from today onward. Previous days keep their goals.',
            })}
          </Text>
        )}
      </View>
    </View>
  );
};

export default ProfileEditScreen;
