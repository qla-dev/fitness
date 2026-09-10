import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import SetupWizard from './SetupWizard';
import { profileSteps } from '../constants/setupSteps';
import { usePersonalSetup } from '../hooks/usePersonalSetup';
import { fetchMeasurementsRange, upsertCheckIn } from '../services/api/measurementsApi';
import { fetchProfile } from '../services/api/profileApi';
import { localApiFetch } from '../services/local/localApi';
import { isLocalDataMode } from '../services/dataMode';
import { getTodayDate } from '../utils/dateUtils';
import type { SetupAnswers } from '../services/personalSetup';

export default function ProfileSetup({ enabled, manual = false }: { enabled: boolean; manual?: boolean }) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const setup = usePersonalSetup(enabled);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const source = useQuery({
    queryKey: ['profileSetupSource'], enabled: enabled && (!!setup.state && (!setup.state.profileDone || open)),
    queryFn: async () => {
      const [profile, measurements] = await Promise.all([fetchProfile(), fetchMeasurementsRange('1900-01-01', getTodayDate())]);
      const sorted = measurements.slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      const weight = sorted.find(row => row.weight != null)?.weight;
      const height = sorted.find(row => row.height != null)?.height;
      const result: SetupAnswers = {};
      if (weight != null) result.weight = String(weight);
      if (height != null) result.height = String(height);
      if (profile.date_of_birth) {
        const birth = new Date(profile.date_of_birth);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
        if (Number.isFinite(age)) result.age = String(age);
      }
      return result;
    },
  });
  const state = setup.state;
  const existing = { ...source.data, ...state?.profile };
  const missing = !existing.age || !existing.height || !existing.weight || !existing.focus;
  const visible = enabled && focused && state && source.data && (open || (!manual && !dismissed && !state.profileDone && missing));
  const close = () => { setOpen(false); setDismissed(true); };
  return <>
    {manual && <Button variant="secondary" onPress={() => setOpen(true)}>{t('setup.edit', { defaultValue: 'Personal setup & goals' })}</Button>}
    {visible && <SetupWizard title={t('setup.title', { defaultValue: 'Made for you' })} steps={profileSteps(t, source.data)} initial={existing} onClose={close} onSave={async (answers, done) => {
      if (done) {
        // Measurement writes use the same endpoint as manual check-ins and
        // omit existing values, including Health imports, rather than overwrite them.
        const weight = !source.data.weight && answers.weight ? Number(String(answers.weight).replace(',', '.')) : undefined;
        const height = !source.data.height && answers.height ? Number(String(answers.height).replace(',', '.')) : undefined;
        if (weight !== undefined || height !== undefined) await upsertCheckIn({ entryDate: getTodayDate(), weight, height });
        // Profile goal editing is currently local-only elsewhere in the app.
        // Keep the same contract; server mode retains these questionnaire choices locally.
        if (isLocalDataMode()) {
          const goals: Record<string, number> = {};
          for (const field of ['steps', 'water_goal_ml']) if (answers[field]) goals[field] = Number(String(answers[field]).replace(',', '.'));
          if (Object.keys(goals).length) await localApiFetch({ endpoint: '/api/goals', method: 'PUT', body: goals });
        }
      }
      await setup.save(s => ({ ...s, profile: answers, profileDone: done }));
      if (done) await client.invalidateQueries({ predicate: q => ['measurements', 'measurementsRange', 'dailySummary', 'goals', 'profileSetupSource'].includes(String(q.queryKey[0])) });
    }} />}
  </>;
}
