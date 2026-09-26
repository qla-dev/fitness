import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadOnlineAccount, useOnlineAccount } from './account';
import { loadSyncSettings, syncOnline, useOnlineSync } from './sync';

const TASK = 'qlaOnlineSync';
TaskManager.defineTask(TASK, async () => {
  try {
    await Promise.all([loadOnlineAccount(), loadSyncSettings()]);
    if (useOnlineSync.getState().enabled && useOnlineAccount.getState().session)
      await syncOnline();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function configureOnlineBackgroundSync(
  enabled: boolean,
  interval: number
) {
  if (!(await TaskManager.isAvailableAsync())) return;
  if (enabled)
    await BackgroundTask.registerTaskAsync(TASK, {
      minimumInterval: Math.max(15, interval),
    });
  else if (await TaskManager.isTaskRegisteredAsync(TASK))
    await BackgroundTask.unregisterTaskAsync(TASK);
}
