import { AppState } from 'react-native';
import { updateWatchPrograms } from '../../modules/watch-link';
import type { WatchProgramsSnapshot } from '../../modules/watch-link';
import {
  fetchWorkoutPresetsPage,
  subscribeWorkoutPresetChanges,
} from './api/workoutPresetsApi';
import { programAccessScope, readProgramAccess } from './programAccess';
import { addLog } from './LogService';

/** Read every page: weekly installs can easily exceed the phone list's first 50. */
export async function syncWatchPrograms() {
  const scope = await programAccessScope();
  const programs: WatchProgramsSnapshot['programs'] = [];
  let page = 1;
  while (true) {
    const result = await fetchWorkoutPresetsPage({ page, pageSize: 50 });
    for (const preset of result.presets) {
      const access = await readProgramAccess(scope, preset.id);
      programs.push({
        id: preset.id,
        name: preset.name,
        ...(access ? { expiresAt: access.expiresAt } : {}),
        exercises: preset.exercises.map((exercise) => ({
          name: exercise.exercise_name,
          sets: exercise.sets.map((set) => ({
            ...(set.reps == null ? {} : { reps: set.reps }),
            ...(set.weight == null ? {} : { weight: set.weight }),
            ...(set.duration == null ? {} : { duration: set.duration }),
            ...(set.distance == null ? {} : { distance: set.distance }),
            ...(set.rest_time == null ? {} : { rest: set.rest_time }),
            ...(set.notes ? { notes: set.notes } : {}),
          })),
        })),
      });
    }
    if (!result.pagination.hasMore) break;
    page += 1;
  }
  if (scope !== (await programAccessScope())) return;
  await updateWatchPrograms({ updatedAt: Date.now(), programs });
}

/** Serialize refreshes; edits during a transfer request one more fresh snapshot. */
export function subscribeWatchPrograms() {
  let stopped = false;
  let running = false;
  let pending = false;
  const refresh = async () => {
    pending = true;
    if (running) return;
    running = true;
    try {
      while (pending && !stopped) {
        pending = false;
        await syncWatchPrograms();
      }
    } catch (error) {
      addLog('[Watch] Program sync failed', 'WARNING', [String(error)]);
    } finally {
      running = false;
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = subscribeWorkoutPresetChanges(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 300);
  });
  const foreground = AppState.addEventListener('change', (state) => {
    if (state === 'active') void refresh();
  });
  void refresh();
  return {
    remove() {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      foreground.remove();
    },
  };
}
