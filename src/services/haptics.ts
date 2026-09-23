import * as Haptics from 'expo-haptics';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';

export function fireSuccessHaptic(): void {
  if (!useAppPreferencesStore.getState().hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}

/** Light selection tick — used for drag-reorder position changes. */
export function fireSelectionHaptic(): void {
  if (!useAppPreferencesStore.getState().hapticsEnabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/**
 * The thud a pull-to-refresh makes when the pull is let go and the load
 * starts.
 *
 * An impact rather than a selection tick: this answers a gesture that had
 * weight to it, and the same light tap the system gives its own refreshes.
 * Success is wrong here — it fires when the pull commits, not when the data
 * arrives, and there is nothing yet to have succeeded.
 */
export function fireRefreshHaptic(): void {
  if (!useAppPreferencesStore.getState().hapticsEnabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
