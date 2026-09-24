import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import type { SetupAnswers } from '../services/personalSetup';
import {
  isSetupComplete,
  isSetupWizardOpen,
  openSetupWizardSession,
  type SetupWizardSession,
} from '../services/setupWizardSession';

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
    (
      data: SetupAnswers,
      single = false
    ): SetupWizardSession['onSave'] =>
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
