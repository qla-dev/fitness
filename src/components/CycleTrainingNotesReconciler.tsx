import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useCycleSettings } from '../hooks/useCycleSettings';
import { useCycleHistory } from '../hooks/useCycleHistory';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { reconcileCycleTrainingNotes } from '../services/cycleTrainingNotes';
import { getTodayDate } from '../utils/dateUtils';
import i18n from '../localization/i18n';

/**
 * Keeps the week of 9:00 training notes in step with the cycle: rebuilt when
 * the settings or history change, when either toggle flips, on a language
 * switch, and each time the app comes back to the foreground on a new day.
 */
const CycleTrainingNotesReconciler: React.FC = () => {
  const { settings, isLoading: isLoadingSettings } = useCycleSettings();
  const { cycles, isLoading: isLoadingCycles } = useCycleHistory();
  const notesEnabled = useAppPreferencesStore(
    (s) => s.cycleTrainingNotesEnabled
  );
  const notificationsEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const [revision, setRevision] = useState(0);
  const [today, setToday] = useState(getTodayDate);

  useEffect(() => {
    if (isLoadingSettings || isLoadingCycles) return;
    void reconcileCycleTrainingNotes(settings, cycles);
  }, [
    settings,
    cycles,
    isLoadingSettings,
    isLoadingCycles,
    notesEnabled,
    notificationsEnabled,
    revision,
    today,
  ]);

  useEffect(() => {
    const onLanguageChanged = () => setRevision((value) => value + 1);
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(getTodayDate());
    });
    return () => subscription.remove();
  }, []);

  return null;
};

export default CycleTrainingNotesReconciler;
