import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import CoverFact from '../components/CoverFact';
import BottomSheetPicker from '../components/BottomSheetPicker';
import FormInput from '../components/FormInput';
import SettingsRow, {
  SettingsRowGroup,
  SettingsValueSubtitle,
} from '../components/SettingsRow';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { usePreferences } from '../hooks/usePreferences';
import { updatePreferences } from '../services/api/preferencesApi';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { preferencesQueryKey } from '../hooks/queryKeys';
import type { UserPreferences } from '../types/preferences';
import type { RootStackScreenProps } from '../types/navigation';
import {
  DEFAULT_CUSTOM_CALORIE_SAFETY_FLOOR,
  MAX_CALORIE_SAFETY_FLOOR,
  MAX_GOAL_MODE_PERCENTAGE,
  MIN_CALORIE_SAFETY_FLOOR,
  convertEnergyValue,
  type CalorieSafetyFloorMode,
  type GoalMode,
} from '@workspace/shared';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type CalorieSettingsScreenProps = RootStackScreenProps<'CalorieSettings'>;

function normalizePreferences(prefs: UserPreferences | undefined) {
  const raw = prefs?.calorie_goal_adjustment_mode;
  return {
    // Only Adaptive changes the target (calorieTarget.ts); every other stored
    // mode - dynamic, percentage, device projection - was a server-side
    // earn-back rule nothing on the device applies, so they all read as the
    // typed goal they behave as.
    mode: raw === 'adaptive' ? 'adaptive' : 'fixed',
    activityLevel: prefs?.activity_level ?? 'not_much',
    goalMode: prefs?.goal_mode ?? 'maintain',
    goalModeCustomPercentage: prefs?.goal_mode_custom_percentage ?? 0,
    calorieSafetyFloorMode: prefs?.calorie_safety_floor_mode ?? 'standard',
    calorieSafetyFloorValue:
      prefs?.calorie_safety_floor_value ?? DEFAULT_CUSTOM_CALORIE_SAFETY_FLOOR,
    energyUnit: prefs?.energy_unit ?? 'kcal',
  };
}

const displayEnergy = (kcal: number, unit: 'kcal' | 'kJ') =>
  Math.round(convertEnergyValue(kcal, 'kcal', unit));

const toKcal = (value: number, unit: 'kcal' | 'kJ') =>
  Math.round(convertEnergyValue(value, unit, 'kcal'));

const CalorieSettingsScreen: React.FC<CalorieSettingsScreenProps> = () => {
  const { t } = useTranslation();
  const safetyFloorOptions = useMemo(
    () => [
      {
        label: t('calorieSettings.safetyFloor.standard', {
          defaultValue: 'Standard',
        }),
        value: 'standard',
      },
      {
        label: t('calorieSettings.safetyFloor.custom', {
          defaultValue: 'Custom',
        }),
        value: 'custom',
      },
      {
        label: t('calorieSettings.safetyFloor.disabled', {
          defaultValue: 'Disabled',
        }),
        value: 'disabled',
      },
    ],
    [t]
  );
  const modeOptions = [
    {
      label: t('calorieSettings.modes.fixed', { defaultValue: 'Fixed Goal' }),
      value: 'fixed',
    },
    {
      label: t('calorieSettings.modes.adaptive', {
        defaultValue: 'Adaptive Goal',
      }),
      value: 'adaptive',
    },
  ];
  const goalModeOptions = [
    {
      label: t('calorieSettings.goalMode.maintain', {
        defaultValue: 'Maintain (0%)',
      }),
      value: 'maintain',
    },
    {
      label: t('calorieSettings.goalMode.recomp', {
        defaultValue: 'Body Recomposition (-10%)',
      }),
      value: 'recomp',
    },
    {
      label: t('calorieSettings.goalMode.cut', { defaultValue: 'Cut (-15%)' }),
      value: 'cut',
    },
    {
      label: t('calorieSettings.goalMode.highCut', {
        defaultValue: 'High Cut (-20%)',
      }),
      value: 'high_cut',
    },
    {
      label: t('calorieSettings.goalMode.leanBulk', {
        defaultValue: 'Lean Bulk (+10%)',
      }),
      value: 'lean_bulk',
    },
    {
      label: t('calorieSettings.goalMode.bulk', {
        defaultValue: 'Bulk (+20%)',
      }),
      value: 'bulk',
    },
    {
      label: t('calorieSettings.goalMode.manual', {
        defaultValue: 'Manual (Custom %)',
      }),
      value: 'manual',
    },
  ];
  const activityLevelOptions = [
    {
      label: t('calorieSettings.activity.none', {
        defaultValue: 'None (x1.0)',
      }),
      value: 'none',
    },
    {
      label: t('calorieSettings.activity.sedentary', {
        defaultValue: 'Sedentary (x1.2)',
      }),
      value: 'not_much',
    },
    {
      label: t('calorieSettings.activity.light', {
        defaultValue: 'Lightly Active (x1.375)',
      }),
      value: 'light',
    },
    {
      label: t('calorieSettings.activity.moderate', {
        defaultValue: 'Moderately Active (x1.55)',
      }),
      value: 'moderate',
    },
    {
      label: t('calorieSettings.activity.heavy', {
        defaultValue: 'Very Active (x1.725)',
      }),
      value: 'heavy',
    },
  ];
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();

  const queryClient = useQueryClient();
  const { preferences } = usePreferences();
  const normalized = normalizePreferences(preferences);

  const [goalModePercentageText, setGoalModePercentageText] = useState(() =>
    String(normalized.goalModeCustomPercentage)
  );
  const [safetyFloorText, setSafetyFloorText] = useState(() =>
    String(
      displayEnergy(normalized.calorieSafetyFloorValue, normalized.energyUnit)
    )
  );

  // Re-sync the input text when the saved percentage changes (e.g. a background
  // refetch). Done during render (instead of in an effect) so the field shows
  // the latest saved value on the first render after it changes.
  const [syncedGoalModePercentage, setSyncedGoalModePercentage] = useState(
    normalized.goalModeCustomPercentage
  );
  if (syncedGoalModePercentage !== normalized.goalModeCustomPercentage) {
    setSyncedGoalModePercentage(normalized.goalModeCustomPercentage);
    setGoalModePercentageText(String(normalized.goalModeCustomPercentage));
  }
  const [syncedSafetyFloor, setSyncedSafetyFloor] = useState(
    `${normalized.calorieSafetyFloorValue}:${normalized.energyUnit}`
  );
  const safetyFloorSyncKey = `${normalized.calorieSafetyFloorValue}:${normalized.energyUnit}`;
  if (syncedSafetyFloor !== safetyFloorSyncKey) {
    setSyncedSafetyFloor(safetyFloorSyncKey);
    setSafetyFloorText(
      String(
        displayEnergy(normalized.calorieSafetyFloorValue, normalized.energyUnit)
      )
    );
  }

  const mutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) => updatePreferences(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: preferencesQueryKey });
      const previous =
        queryClient.getQueryData<UserPreferences>(preferencesQueryKey);
      queryClient.setQueryData<UserPreferences>(preferencesQueryKey, (old) =>
        old ? { ...old, ...data } : (data as UserPreferences)
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(preferencesQueryKey, context.previous);
      }
      Toast.show({
        type: 'error',
        text1: t('common.error', { defaultValue: 'Error' }),
        text2: t('calorieSettings.updateFailed', {
          defaultValue: 'Failed to update setting.',
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
    },
  });

  const handleModeChange = useCallback(
    (value: string) => {
      mutation.mutate({ calorie_goal_adjustment_mode: value });
    },
    [mutation]
  );

  const handleGoalModeChange = useCallback(
    (value: string) => {
      mutation.mutate({ goal_mode: value as GoalMode });
    },
    [mutation]
  );

  const handleActivityLevelChange = useCallback(
    (value: string) => {
      mutation.mutate({ activity_level: value });
    },
    [mutation]
  );

  const handleSafetyFloorModeChange = useCallback(
    (value: string) => {
      mutation.mutate({
        calorie_safety_floor_mode: value as CalorieSafetyFloorMode,
      });
    },
    [mutation]
  );

  const handleSafetyFloorBlur = useCallback(() => {
    const trimmedValue = safetyFloorText.trim();
    if (trimmedValue === '') {
      setSafetyFloorText(
        String(
          displayEnergy(
            normalized.calorieSafetyFloorValue,
            normalized.energyUnit
          )
        )
      );
      return;
    }
    const parsed = Number(trimmedValue);
    const kcal = Number.isFinite(parsed)
      ? toKcal(parsed, normalized.energyUnit)
      : normalized.calorieSafetyFloorValue;
    const clamped = Math.max(
      MIN_CALORIE_SAFETY_FLOOR,
      Math.min(MAX_CALORIE_SAFETY_FLOOR, kcal)
    );
    setSafetyFloorText(String(displayEnergy(clamped, normalized.energyUnit)));
    if (clamped !== normalized.calorieSafetyFloorValue) {
      mutation.mutate({ calorie_safety_floor_value: clamped });
    }
  }, [
    mutation,
    normalized.calorieSafetyFloorValue,
    normalized.energyUnit,
    safetyFloorText,
  ]);

  const handleGoalModePercentageBlur = useCallback(() => {
    const trimmedValue = goalModePercentageText.trim();
    if (trimmedValue === '' || trimmedValue === '-') {
      setGoalModePercentageText(String(normalized.goalModeCustomPercentage));
      return;
    }
    const parsed = Math.round(Number(trimmedValue));
    const clamped = Number.isFinite(parsed)
      ? Math.max(
          -MAX_GOAL_MODE_PERCENTAGE,
          Math.min(MAX_GOAL_MODE_PERCENTAGE, parsed)
        )
      : normalized.goalModeCustomPercentage;
    setGoalModePercentageText(String(clamped));
    if (clamped !== normalized.goalModeCustomPercentage) {
      mutation.mutate({ goal_mode_custom_percentage: clamped });
    }
  }, [goalModePercentageText, mutation, normalized.goalModeCustomPercentage]);

  const optionsLayout = LinearTransition.delay(0).duration(250);

  // Activity Level only feeds the adaptive estimate (BMR × activity).
  const showActivityLevel = normalized.mode === 'adaptive';

  const explanation = useMemo(
    () => ({
      burned: t('calorieSettings.guide.burnedShown', {
        defaultValue:
          'Burned calories come from your recorded activity and your health app. They are shown in your diary, but do not add calories to your budget.',
      }),
      remaining:
        normalized.mode === 'adaptive'
          ? t('calorieSettings.guide.remainingAdaptive', {
              defaultValue:
                'Your target uses an estimate from your body data and Activity Level, or your saved goal if body data is missing. Eaten calories are subtracted from that target.',
            })
          : t('calorieSettings.guide.remainingFixed', {
              defaultValue:
                'Your daily target minus eaten calories. Activity is shown in your diary, but does not add calories to this budget.',
            }),
    }),
    [normalized.mode, t]
  );

  const openPickerHint = t('common.openSelectionMenu', {
    defaultValue: 'Opens selection menu',
  });

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('calorieSettings.title', {
      defaultValue: 'Calorie & BMR Settings',
    }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
        }}
      >
        {/* Mode */}
        <BottomSheetPicker
          value={normalized.mode}
          options={modeOptions}
          onSelect={handleModeChange}
          title={t('calorieSettings.adjustmentMode', {
            defaultValue: 'Adjustment Mode',
          })}
          renderTrigger={({ onPress, selectedOption }) => (
            <SettingsRow
              title={t('calorieSettings.modeLabel', {
                defaultValue: 'Calorie Mode',
              })}
              subtitle={
                <SettingsValueSubtitle
                  value={selectedOption?.label}
                  description={t('calorieSettings.modeSourceDescription', {
                    defaultValue:
                      'Where your daily calorie target comes from: the goal you set, or an estimate from your body data.',
                  })}
                />
              }
              onPress={onPress}
              accessibilityHint={openPickerHint}
            />
          )}
        />

        {/* Activity Level */}
        {showActivityLevel && (
          <Animated.View layout={optionsLayout}>
            <BottomSheetPicker
              value={normalized.activityLevel}
              options={activityLevelOptions}
              onSelect={handleActivityLevelChange}
              title={t('calorieSettings.activityLevel', {
                defaultValue: 'Activity Level',
              })}
              renderTrigger={({ onPress, selectedOption }) => (
                <SettingsRow
                  title={t('calorieSettings.activityLevel', {
                    defaultValue: 'Activity Level',
                  })}
                  subtitle={
                    <SettingsValueSubtitle
                      value={selectedOption?.label}
                      description={t('calorieSettings.activityBaseline', {
                        defaultValue: 'Used as a baseline for TDEE.',
                      })}
                    />
                  }
                  onPress={onPress}
                  accessibilityHint={openPickerHint}
                />
              )}
            />
          </Animated.View>
        )}

        {/* Goal Mode */}
        <Animated.View layout={optionsLayout}>
          <SettingsRowGroup>
            <BottomSheetPicker
              value={normalized.goalMode}
              options={goalModeOptions}
              onSelect={handleGoalModeChange}
              title={t('calorieSettings.goalMode.title', {
                defaultValue: 'Goal Mode',
              })}
              renderTrigger={({ onPress, selectedOption }) => (
                <SettingsRow
                  title={t('calorieSettings.goalMode.title', {
                    defaultValue: 'Goal Mode',
                  })}
                  subtitle={
                    <SettingsValueSubtitle
                      value={selectedOption?.label}
                      description={t('calorieSettings.goalMode.description', {
                        defaultValue:
                          'Adjusts your calorie target for maintenance, a deficit, or a surplus.',
                      })}
                    />
                  }
                  onPress={onPress}
                  accessibilityHint={openPickerHint}
                />
              )}
            />
            {normalized.goalMode === 'manual' && (
              <View className="p-4">
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  {t('calorieSettings.goalMode.customPercentage', {
                    defaultValue: 'Custom percentage',
                  })}
                </Text>
                <FormInput
                  value={goalModePercentageText}
                  onChangeText={setGoalModePercentageText}
                  onBlur={handleGoalModePercentageBlur}
                  keyboardType="numbers-and-punctuation"
                  maxLength={3}
                  returnKeyType="done"
                  accessibilityLabel={t(
                    'calorieSettings.goalMode.customPercentage',
                    { defaultValue: 'Custom percentage' }
                  )}
                />
                <Text className="text-text-secondary text-sm mt-3">
                  {t('calorieSettings.goalMode.customPercentageDescription', {
                    defaultValue:
                      'Positive adds calories; negative creates a deficit. Limited to ±40%.',
                  })}
                </Text>
              </View>
            )}
          </SettingsRowGroup>
        </Animated.View>

        <Animated.View layout={optionsLayout}>
          <SettingsRowGroup>
            <BottomSheetPicker
              value={normalized.calorieSafetyFloorMode}
              options={safetyFloorOptions}
              onSelect={handleSafetyFloorModeChange}
              title={t('calorieSettings.safetyFloor.title', {
                defaultValue: 'Safety Floor',
              })}
              renderTrigger={({ onPress, selectedOption }) => (
                <SettingsRow
                  title={t('calorieSettings.safetyFloor.title', {
                    defaultValue: 'Safety Floor',
                  })}
                  subtitle={
                    <SettingsValueSubtitle
                      value={selectedOption?.label}
                      description={
                        normalized.calorieSafetyFloorMode === 'standard'
                          ? t(
                              'calorieSettings.safetyFloor.standardDescription',
                              {
                                defaultValue:
                                  'Uses the higher of your estimated RMR and the clinical minimum.',
                              }
                            )
                          : normalized.calorieSafetyFloorMode === 'custom'
                            ? t(
                                'calorieSettings.safetyFloor.customDescription',
                                {
                                  defaultValue:
                                    'Replaces the standard floor with your chosen minimum. Health recommendations remain visible.',
                                }
                              )
                            : t(
                                'calorieSettings.safetyFloor.disabledDescription',
                                {
                                  defaultValue:
                                    'Stops automatic target clamping. Health warnings remain visible.',
                                }
                              )
                      }
                    />
                  }
                  onPress={onPress}
                  accessibilityHint={openPickerHint}
                />
              )}
            />
            {normalized.calorieSafetyFloorMode === 'custom' && (
              <View className="p-4">
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  {t('calorieSettings.safetyFloor.customMinimum', {
                    defaultValue: 'Custom minimum ({{unit}})',
                    unit: normalized.energyUnit,
                  })}
                </Text>
                <FormInput
                  value={safetyFloorText}
                  onChangeText={setSafetyFloorText}
                  onBlur={handleSafetyFloorBlur}
                  keyboardType="number-pad"
                  maxLength={5}
                  returnKeyType="done"
                />
              </View>
            )}
          </SettingsRowGroup>
        </Animated.View>

        <View className="pt-6" testID="calorie-settings-guide">
          <Text
            accessibilityRole="header"
            className="text-xl font-bold text-text-primary mb-2"
          >
            {t('calorieSettings.howThisWorks', {
              defaultValue: 'How this works',
            })}
          </Text>
          <Text className="text-base leading-6 text-text-secondary mb-4">
            {t('calorieSettings.guide.introSource', {
              defaultValue:
                'Choose where your target comes from. Goal Mode adjusts it, and Safety Floor sets a minimum when enabled.',
            })}
          </Text>
          <CoverFact
            image={require('../../assets/goal-facts/calorie-burn.jpg')}
            title={t('calorieSettings.burnedCalories', {
              defaultValue: 'Burned Calories',
            })}
            body={explanation.burned}
          />
          <CoverFact
            image={require('../../assets/goal-facts/calorie-food.jpg')}
            title={t('calorieSettings.guide.foodTitle', {
              defaultValue: 'Eaten Calories',
            })}
            body={t('calorieSettings.guide.foodBody', {
              defaultValue:
                'Add meals and snacks to your diary. Their calories count as eaten; eaten minus burned is your net energy.',
            })}
          />
          <CoverFact
            image={require('../../assets/goal-facts/calorie-remaining.jpg')}
            title={t('calorieSettings.remainingCalories', {
              defaultValue: 'Remaining Calories',
            })}
            body={explanation.remaining}
          />
        </View>
      </NativeHeaderScrollView>
    </View>
  );
};

export default CalorieSettingsScreen;
