import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import PillInput from '../components/ui/PillInput';
import { useCustomNutrients } from '../hooks';
import {
  accountPasswordQueryKey,
  goalsQueryKey,
  profileQueryKey,
} from '../hooks/queryKeys';
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
  isWeightGoalKey,
  readGoalValue,
} from '../constants/profileGoals';
import { usePreferences } from '../hooks/usePreferences';
import { weightFromKg, weightToKg } from '../utils/unitConversions';
import { getTodayDate } from '../utils/dateUtils';
import {
  isValidUsername,
  normalizeUsername,
  profileLinkLabel,
  USERNAME_MAX_LENGTH,
} from '../utils/profileLink';
import {
  isValidPassword,
  setAccountPassword,
} from '../services/accountPassword';
import type { RootStackScreenProps } from '../types/navigation';

type ProfileEditScreenProps = RootStackScreenProps<'ProfileEdit'>;

/** Something@somewhere.tld — a sanity check, not RFC 5322. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  // Every field but a goal is one line of text on the profile, or the
  // password beside it; they differ only in the settings below.
  const textField = params.field === 'goal' ? null : params.field;
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
    : textField === 'username'
      ? t('profile.username', { defaultValue: 'Username' })
      : textField === 'email'
        ? t('profile.email', { defaultValue: 'Email' })
        : textField === 'password'
          ? t('profile.password', { defaultValue: 'Password' })
          : t('profile.name', { defaultValue: 'Name' });
  // See GoalEditScreen: a weight goal is stored in kilograms and edited in the
  // user's own unit, so its value, bounds and unit label all convert here.
  const { preferences } = usePreferences();
  const weightUnit: 'kg' | 'lbs' =
    preferences?.default_weight_unit === 'lbs' ? 'lbs' : 'kg';
  const isWeight = isGoal && isWeightGoalKey(goalKey);
  const toDisplay = (kg: number) =>
    isWeight ? Math.round(weightFromKg(kg, weightUnit) * 10) / 10 : kg;
  const toStored = (shown: number) =>
    isWeight ? weightToKg(shown, weightUnit) : shown;

  const unit = isGoal
    ? getProfileGoalUnit(goalKey, customNutrients, weightUnit)
    : '';
  const storedMaximum = isGoal ? goalMaximum(goalKey) : undefined;
  const maximum =
    storedMaximum === undefined ? undefined : toDisplay(storedMaximum);
  const minimum = isGoal ? toDisplay(goalMinimum(goalKey)) : 0;

  // A password is never read back, so its field always starts empty.
  const storedName =
    textField === 'password'
      ? ''
      : ((textField === 'username'
          ? profileQuery.data?.username
          : textField === 'email'
            ? profileQuery.data?.email
            : profileQuery.data?.full_name) ?? '');
  const storedGoal = readGoalValue(goalsQuery.data, goalKey);
  const stored = useMemo(
    () =>
      isGoal
        ? storedGoal === undefined
          ? ''
          : String(toDisplay(storedGoal))
        : storedName,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGoal, storedGoal, storedName, isWeight, weightUnit]
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
    : textField === 'username'
      ? isValidUsername(normalizeUsername(trimmed))
      : textField === 'email'
        ? EMAIL_PATTERN.test(trimmed)
        : textField === 'password'
          ? isValidPassword(value)
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
          : { [goalKey]: toStored(numeric) };
        await localApiFetch({ endpoint: '/api/goals', method: 'PUT', body });
        await queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            ['goals', 'dailySummary', 'daily-summary'].includes(
              String(queryKey[0])
            ),
        });
      } else if (textField === 'password') {
        // Not trimmed: a space is a character the user chose to type.
        await setAccountPassword(value);
        await queryClient.invalidateQueries({
          queryKey: accountPasswordQueryKey,
        });
      } else {
        await localApiFetch({
          endpoint: '/api/identity/profiles',
          method: 'PUT',
          body:
            textField === 'username'
              ? { username: normalizeUsername(trimmed) }
              : textField === 'email'
                ? { email: trimmed.toLowerCase() }
                : { full_name: trimmed },
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
  const previewUsername = normalizeUsername(value);
  const invalidText =
    !isGoal && textField !== 'name' && touched && value.length > 0 && !valid;

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
              : textField === 'username'
                ? t('profile.usernamePlaceholder', {
                    defaultValue: 'Choose a username',
                  })
                : textField === 'email'
                  ? t('profile.emailPlaceholder', {
                      defaultValue: 'name@example.com',
                    })
                  : textField === 'password'
                    ? t('profile.passwordPlaceholder', {
                        defaultValue: 'New password',
                      })
                    : t('profile.namePlaceholder', {
                        defaultValue: 'Enter your name',
                      })
          }
          keyboardType={
            isGoal
              ? 'decimal-pad'
              : textField === 'email'
                ? 'email-address'
                : 'default'
          }
          autoCapitalize={textField === 'name' ? 'words' : 'none'}
          autoCorrect={textField === 'name'}
          secureTextEntry={textField === 'password'}
          autoComplete={
            textField === 'name'
              ? 'name'
              : textField === 'username'
                ? 'username'
                : textField === 'email'
                  ? 'email'
                  : textField === 'password'
                    ? 'new-password'
                    : 'off'
          }
          maxLength={
            isGoal ? 12 : textField === 'username' ? USERNAME_MAX_LENGTH : 100
          }
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        {(failed || invalidNumber || invalidText) && (
          <Text
            accessibilityRole="alert"
            className="text-text-primary text-sm mt-3"
          >
            {invalidText
              ? textField === 'username'
                ? t('profile.usernameInvalid', {
                    defaultValue:
                      '3 to 30 letters, numbers, dots, dashes or underscores, starting with a letter or number.',
                  })
                : textField === 'email'
                  ? t('profile.emailInvalid', {
                      defaultValue: 'Enter a valid email address.',
                    })
                  : t('profile.passwordInvalid', {
                      defaultValue: 'Use at least 8 characters.',
                    })
              : failed
                ? isGoal
                  ? t('profile.goalsSaveFailed', {
                      defaultValue: 'Could not save goals. Please try again.',
                    })
                  : textField === 'name'
                    ? t('profile.nameSaveFailed', {
                        defaultValue:
                          'Could not save your name. Please try again.',
                      })
                    : t('profile.fieldSaveFailed', {
                        defaultValue:
                          'Could not save {{field}}. Please try again.',
                        field: label.toLowerCase(),
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
        {textField === 'username' ? (
          <Text className="text-text-secondary text-sm mt-3">
            {t('profile.usernameHelp', {
              defaultValue: 'Your profile link: {{link}}',
              link: profileLinkLabel(previewUsername || 'username'),
            })}
          </Text>
        ) : null}
        {textField === 'password' ? (
          <Text className="text-text-secondary text-sm mt-3">
            {t('profile.passwordHelp', {
              defaultValue:
                'Stored only on this phone, in the system keychain, and never shown again.',
            })}
          </Text>
        ) : null}
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
