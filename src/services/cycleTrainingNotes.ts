import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SharedCycle, SharedCycleSettings } from '@workspace/shared';
import i18n from '../localization/i18n';
import { addDays, getTodayDate } from '../utils/dateUtils';
import { computeCyclePrediction } from '../hooks/useCyclePredictionData';
import {
  trainingGuidanceCopy,
  trainingGuidanceFor,
} from '../utils/cycleTrainingGuidance';
import { hasNotificationPermission } from './notifications';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { addLog } from './LogService';

const CHANNEL_ID = 'cycle-training-notes';
const NOTE_HOUR = 9;
// iOS keeps only the 64 soonest pending notifications, shared with the
// medication reminders, so a week ahead is scheduled and topped up on open.
const LOOKAHEAD_DAYS = 7;

let running = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('notifications.channels.cycleTrainingNotes', {
      defaultValue: 'Daily training notes',
    }),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Reconciles the 9:00 training notes with the cycle as it stands now: one per
 * day for the next week, worded from that day's predicted phase. Every note
 * is rebuilt on each run, so a logged period, changed settings or a language
 * switch never leaves stale advice pending. Cancels them all when cycle
 * tracking, the setting or notifications are off, and in modes with no cycle
 * to train around (pregnancy, postpartum, menopause).
 */
export async function reconcileCycleTrainingNotes(
  settings: SharedCycleSettings | null | undefined,
  cycles: SharedCycle[]
): Promise<void> {
  if (running) return;
  running = true;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.content.data?.cycleTrainingNote)
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(
            () => undefined
          )
        )
    );

    const prefs = useAppPreferencesStore.getState();
    const active =
      prefs.notificationsEnabled &&
      prefs.cycleTrainingNotesEnabled &&
      !!settings?.enabled &&
      (settings.mode === 'standard' || settings.mode === 'ttc');
    if (!active || !(await hasNotificationPermission())) return;

    await ensureChannel();
    const discreet = !!settings.discreet_mode;
    const today = getTodayDate();
    const now = Date.now();

    for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
      const date = addDays(today, offset);
      const [year, month, day] = date.split('-').map(Number);
      const fireAt = new Date(year, month - 1, day, NOTE_HOUR, 0, 0, 0);
      if (fireAt.getTime() <= now) continue;

      const data = computeCyclePrediction(settings, cycles, date);
      if (!data || data.day <= 0) continue;
      const copy = trainingGuidanceCopy(
        i18n.t,
        trainingGuidanceFor(data, date),
        discreet
      );
      await Notifications.scheduleNotificationAsync({
        identifier: `cycle_training_${date}`,
        content: {
          title: copy.title,
          body: copy.body,
          data: { cycleTrainingNote: true, date },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (error) {
    addLog(`Cycle training notes failed: ${(error as Error).message}`, 'ERROR');
  } finally {
    running = false;
  }
}
