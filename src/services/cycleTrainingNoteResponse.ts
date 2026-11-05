import * as Notifications from 'expo-notifications';
import i18n from '../localization/i18n';
import { navigationRef } from '../components/ActiveWorkoutBar';
import { addNotificationResponseListener } from './notifications';
import { addLog } from './LogService';

/**
 * Tapping a cycle training note opens MarkAI with the note as MarkAI's own
 * first message, so the user can carry on the conversation (more detail,
 * what to train today) instead of just landing in the app.
 *
 * The note's own wording is used, discreet wording included.
 */

// How long a cold-start tap waits for the app to reach its tabs. Startup
// can stop at onboarding or sign-in; the note is dropped rather than pushed
// over those.
const NAVIGATION_WAIT_MS = 15_000;
const NAVIGATION_POLL_MS = 250;

let initialized = false;
/** The request id last handled, so a cold-start tap seen twice opens once. */
let lastHandledId: string | null = null;

const isCycleTrainingNote = (response: Notifications.NotificationResponse) =>
  response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER &&
  !!response.notification.request.content.data?.cycleTrainingNote;

/**
 * MarkAI's opening message: the note as the user read it, then an offer to
 * go further. Nothing is sent until the user answers, so opening it is free.
 */
export function buildCycleTrainingNotePreset(title: string, body: string) {
  const followUp = i18n.t('cycleTraining.chatFollowUp', {
    defaultValue:
      'Would you like more information or recommendations for today?',
  });
  return {
    prompt: '',
    opener: [title, body, followUp].filter(Boolean).join('\n\n'),
    mode: 'training' as const,
  };
}

const onTabs = () =>
  navigationRef.isReady() &&
  (navigationRef.getRootState()?.routes ?? []).some(
    (route) => route.name === 'Tabs'
  );

function openInMarkAI(response: Notifications.NotificationResponse): void {
  const { identifier, content } = response.notification.request;
  if (identifier === lastHandledId) return;
  lastHandledId = identifier;

  const preset = buildCycleTrainingNotePreset(
    content.title ?? '',
    content.body ?? ''
  );
  const startedAt = Date.now();
  const attempt = () => {
    if (onTabs()) {
      navigationRef.navigate('MarkAI', { preset });
      return;
    }
    if (Date.now() - startedAt >= NAVIGATION_WAIT_MS) {
      addLog(
        '[CycleTrainingNote] App never reached tabs; note not opened',
        'DEBUG'
      );
      return;
    }
    setTimeout(attempt, NAVIGATION_POLL_MS);
  };
  attempt();
}

export function initCycleTrainingNoteResponses(): void {
  if (initialized) return;
  initialized = true;

  addNotificationResponseListener((response) => {
    if (isCycleTrainingNote(response)) openInMarkAI(response);
  });

  // A tap that launched the app can land before the listener exists.
  try {
    const launching = Notifications.getLastNotificationResponse();
    if (launching && isCycleTrainingNote(launching)) {
      openInMarkAI(launching);
      Notifications.clearLastNotificationResponse();
    }
  } catch (error) {
    addLog(
      `[CycleTrainingNote] Could not read the launching notification: ${String(error)}`,
      'WARNING'
    );
  }
}
