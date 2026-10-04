import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { profileSteps } from '../constants/setupSteps';
import { usePersonalSetup } from './usePersonalSetup';
import {
  fetchMeasurementsRange,
  upsertCheckIn,
} from '../services/api/measurementsApi';
import { fetchProfile } from '../services/api/profileApi';
import { localApiFetch } from '../services/local/localApi';
import { isLocalDataMode } from '../services/dataMode';
import { getTodayDate } from '../utils/dateUtils';
import { bmi, bmiCategory } from '../utils/bmi';
import { MACRO_RINGS } from '../constants/macroRings';

import { formatLocalizedNumber } from '../localization';
import type { SetupAnswers } from '../services/personalSetup';
import {
  isSetupComplete,
  isSetupWizardOpen,
  openSetupWizardSession,
  type SetupFlash,
  type SetupWizardSession,
} from '../services/setupWizardSession';

/** The stretch of BMI the result scale draws, from very low to very high. */
const BMI_SCALE_MIN = 15;

/** A nutrient's mark as the Tracker draws it, so a flash matches its ring. */
const macroGlyph = (key: string) =>
  MACRO_RINGS.find((spec) => spec.key === key)?.Glyph;

/** The goals MarkAI can work out from the tour, alone or as one plan. */
const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const;
const BMI_SCALE_SPAN = 25;

/**
 * The personal setup ("goals") wizard: its saved answers merged with what the
 * server already knows, whether every question is answered, and a way to open
 * it. Shared by the startup protocol and the Profile screen button.
 */
export function useProfileSetup(enabled: boolean) {
  const { t } = useTranslation();
  const setup = usePersonalSetup(enabled);
  const client = useQueryClient();
  const saveSetup = setup.save;
  const [green, amber, danger, blue, calorieColor, protein, carbs, fat] =
    useCSSVariable([
      '--color-cat-green',
      '--color-icon-warning',
      '--color-icon-danger',
      '--color-accent-primary',
      '--color-calories',
      '--color-macro-protein',
      '--color-macro-carbs',
      '--color-macro-fat',
    ]) as string[];
  const source = useQuery({
    queryKey: ['profileSetupSource'],
    enabled: enabled && !!setup.state,
    queryFn: async () => {
      const [profile, measurements] = await Promise.all([
        fetchProfile(),
        fetchMeasurementsRange('1900-01-01', getTodayDate()),
      ]);
      const sorted = measurements
        .slice()
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      const weight = sorted.find((row) => row.weight != null)?.weight;
      const height = sorted.find((row) => row.height != null)?.height;
      const result: SetupAnswers = {};
      if (weight != null) result.weight = String(weight);
      if (height != null) result.height = String(height);
      if (profile.date_of_birth) {
        const birth = new Date(profile.date_of_birth);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        if (
          now.getMonth() < birth.getMonth() ||
          (now.getMonth() === birth.getMonth() &&
            now.getDate() < birth.getDate())
        )
          age--;
        if (Number.isFinite(age)) result.age = String(age);
      }
      return result;
    },
  });

  const state = setup.state;
  const sourceData = source.data;
  const ready = !!state && !!sourceData;
  const existing: SetupAnswers = { ...state?.profile, ...sourceData };
  const isComplete = ready && isSetupComplete(profileSteps(t), existing);

  const save = useCallback(
    (data: SetupAnswers, single = false): SetupWizardSession['onSave'] =>
      async (answers, done) => {
        if (done) {
          // Age is asked as a number of years, but the profile stores a date
          // of birth, which is what the Profile's Age reads. It was only ever
          // kept in the wizard's own answers, so the tile stayed empty. A
          // changed age becomes the birth date that makes it true today.
          const age = Number(String(answers.age ?? '').trim());
          if (
            isLocalDataMode() &&
            Number.isInteger(age) &&
            age > 0 &&
            String(age) !== data.age
          ) {
            const now = new Date();
            const birth = `${now.getFullYear() - age}-${String(
              now.getMonth() + 1
            ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            await localApiFetch({
              endpoint: '/api/identity/profiles',
              method: 'PUT',
              body: { date_of_birth: birth },
            });
          }
          // Weight and height are pre-filled from the latest measurements.
          // Only a value the user actually changed is written, through the same
          // endpoint as manual check-ins, so untouched Health imports are left alone.
          const changed = (field: 'weight' | 'height') => {
            const answer = answers[field];
            if (typeof answer !== 'string' || !answer.trim()) return undefined;
            const value = Number(answer.replace(',', '.'));
            return data[field] !== undefined && Number(data[field]) === value
              ? undefined
              : value;
          };
          const weight = changed('weight');
          const height = changed('height');
          // Saving one answer (the Age tile) writes that answer and nothing
          // else: rewriting goals from the rest of the saved answers
          // could switch on a calorie goal the user never set from that screen.
          if (!single && (weight !== undefined || height !== undefined))
            await upsertCheckIn({
              entryDate: getTodayDate(),
              weight,
              height,
            });
          // Profile goal editing is currently local-only elsewhere in the app.
          // Keep the same contract; server mode retains these questionnaire choices locally.
          if (!single && isLocalDataMode()) {
            const goals: Record<string, number> = {};
            for (const field of [
              'steps',
              'water_goal_ml',
              'calories',
              'protein',
              'carbs',
              'fat',
            ])
              if (answers[field])
                goals[field] = Number(String(answers[field]).replace(',', '.'));
            if (Object.keys(goals).length)
              await localApiFetch({
                endpoint: '/api/goals',
                method: 'PUT',
                body: goals,
              });
          }
        }
        await saveSetup((s) => ({
          ...s,
          profile: answers,
          // Saving one answer does not finish, or unfinish, the tour.
          profileDone: single ? s.profileDone : done,
        }));
        if (done)
          await client.invalidateQueries({
            predicate: (q) =>
              [
                'measurements',
                'measurementsRange',
                'dailySummary',
                'goals',
                'profileSetupSource',
                'userProfile',
              ].includes(String(q.queryKey[0])),
          });
      },
    [client, saveSetup]
  );

  // The first round's result: the BMI from the height and weight just
  // answered, in the band it falls in. Worked out here, from the answers,
  // before any check-in is written.
  const bmiFlash = (answers: SetupAnswers): SetupFlash | null => {
    const value = bmi(
      Number(String(answers.weight ?? '').replace(',', '.')),
      Number(String(answers.height ?? '').replace(',', '.'))
    );
    if (value === null) return null;
    const band = bmiCategory(value);
    const labels = {
      underweight: t('setup.bmi.underweight', { defaultValue: 'Underweight' }),
      healthy: t('setup.bmi.healthy', { defaultValue: 'Healthy weight' }),
      overweight: t('setup.bmi.overweight', { defaultValue: 'Overweight' }),
      obese: t('setup.bmi.obese', { defaultValue: 'Obesity' }),
    };
    return {
      eyebrow: t('setup.bmi.eyebrow', { defaultValue: 'Your BMI' }),
      value: formatLocalizedNumber(value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      title: labels[band],
      caption: t('setup.bmi.caption', {
        defaultValue:
          'From your height and weight. A few optional questions to go.',
      }),
      tint: band === 'healthy' ? green : band === 'obese' ? danger : amber,
      meter: {
        position: (value - BMI_SCALE_MIN) / BMI_SCALE_SPAN,
        segments: [
          { weight: 18.5 - BMI_SCALE_MIN, color: blue },
          { weight: 25 - 18.5, color: green },
          { weight: 30 - 25, color: amber },
          { weight: BMI_SCALE_MIN + BMI_SCALE_SPAN - 30, color: danger },
        ],
        ticks: [18.5, 25, 30].map((at) => ({
          at: (at - BMI_SCALE_MIN) / BMI_SCALE_SPAN,
          label: formatLocalizedNumber(at),
        })),
      },
    };
  };

  // MarkAI's whole macro plan, applied from the tour: the last thing the tour
  // asks, so it ends it. A single goal (calories alone) is not a plan.
  const macroPlanFlash = (offered: SetupAnswers): SetupFlash | null => {
    const grams = (key: string) => Number(String(offered[key] ?? ''));
    if (!MACRO_KEYS.every((key) => grams(key) > 0)) return null;
    const g = (key: string) =>
      t('setup.macroFlash.grams', {
        defaultValue: '{{value}} g',
        value: formatLocalizedNumber(grams(key)),
      });
    return {
      icon: 'flame',
      eyebrow: t('setup.macroFlash.eyebrow', {
        defaultValue: 'Your daily goals',
      }),
      value: formatLocalizedNumber(grams('calories')),
      title: t('setup.macroFlash.title', { defaultValue: 'kcal a day' }),
      tint: calorieColor,
      stats: [
        {
          key: 'protein',
          icon: 'fish',
          glyph: macroGlyph('protein'),
          color: protein,
          value: g('protein'),
          label: t('setup.macroFlash.protein', { defaultValue: 'Protein' }),
        },
        {
          key: 'carbs',
          icon: 'leaf',
          glyph: macroGlyph('carbs'),
          color: carbs,
          value: g('carbs'),
          label: t('setup.macroFlash.carbs', { defaultValue: 'Carbs' }),
        },
        {
          key: 'fat',
          icon: 'hydration',
          glyph: macroGlyph('fat'),
          color: fat,
          value: g('fat'),
          label: t('setup.macroFlash.fat', { defaultValue: 'Fat' }),
        },
      ],
      caption: t('setup.macroFlash.caption', {
        defaultValue:
          'Saved as your goals. You can change any of them in Profile.',
      }),
    };
  };

  // One goal MarkAI worked out, applied from its question: shown in that
  // goal's own colour, and the tour goes on to the next question.
  const singleGoalFlash = (offered: SetupAnswers): SetupFlash | null => {
    const keys = MACRO_KEYS.filter((key) => Number(offered[key]) > 0);
    if (keys.length !== 1) return null;
    const key = keys[0];
    const look = {
      calories: { icon: 'flame', color: calorieColor },
      protein: { icon: 'fish', color: protein },
      carbs: { icon: 'leaf', color: carbs },
      fat: { icon: 'hydration', color: fat },
    } as const;
    return {
      icon: look[key].icon,
      // Calories has no glyph of its own; the Tracker uses the flame too.
      glyph: macroGlyph(key),
      tint: look[key].color,
      eyebrow:
        profileSteps(t).find((step) => step.id === key)?.fields[0]?.label ??
        key,
      value: formatLocalizedNumber(Number(offered[key])),
      title:
        key === 'calories'
          ? t('setup.macroFlash.title', { defaultValue: 'kcal a day' })
          : t('setup.macroFlash.gramsADay', { defaultValue: 'g a day' }),
      caption: t('setup.macroFlash.singleCaption', {
        defaultValue: 'Applied. You can change it any time in Profile.',
      }),
    };
  };
  const applyOffered: SetupWizardSession['applyOffered'] = (offered) => {
    const plan = macroPlanFlash(offered);
    if (plan) return { flash: plan, finish: true };
    const single = singleGoalFlash(offered);
    return single ? { flash: single, finish: false } : null;
  };

  /**
   * Parks the wizard session and calls `navigate` to show it. Returns false
   * when the data is not loaded yet or a wizard is already open.
   */
  const openWizard = (
    navigate: () => void,
    onClose: () => void = () => {},
    singleStep?: string
  ) => {
    if (!state || !sourceData || isSetupWizardOpen()) return false;
    openSetupWizardSession({
      steps: profileSteps(t),
      initial: existing,
      onClose,
      onSave: save(sourceData, singleStep !== undefined),
      singleStep,
      firstRound: singleStep
        ? undefined
        : {
            label: t('setup.calculateBmi', {
              defaultValue: 'Calculate my BMI',
            }),
            flash: bmiFlash,
          },
      applyOffered: singleStep ? undefined : applyOffered,
    });
    navigate();
    return true;
  };

  return {
    ready,
    isComplete,
    isError: source.isError || setup.isError,
    retry: () => {
      void setup.refetch();
      void source.refetch();
    },
    openWizard,
  };
}
