import { useCallback, useRef, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getWorkoutPresetById } from '../services/api/workoutPresetsApi';
import {
  programAccessScope,
  readProgramPresetAccess,
} from '../services/programAccess';
import { buildPresetStartExercisesPayload } from '../utils/workoutSession';
import { useStartLiveWorkout } from './useStartLiveWorkout';
import type { RootStackParamList } from '../types/navigation';
import type { WorkoutPreset } from '../types/workoutPresets';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "… · Week 3" → 3; presets without a week number sort last. */
const weekOf = (preset: WorkoutPreset) =>
  Number(/(\d+)\s*$/.exec(preset.name)?.[1] ?? Number.MAX_SAFE_INTEGER);

/**
 * Starts an installed store program: the week the program is in now, counted
 * from when it was added, clamped to its last week. Resolves false when none
 * of its presets is left (deleted from My programs), so the caller can offer
 * to add it again instead.
 */
export function useStartInstalledProgram(
  navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    'replace' | 'isFocused' | 'navigate'
  >
) {
  const { startLiveWorkout, isStarting } = useStartLiveWorkout(navigation);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const start = useCallback(
    async (programId: string): Promise<boolean> => {
      if (busy.current) return true;
      busy.current = true;
      setLoading(true);
      try {
        const records = await readProgramPresetAccess(
          await programAccessScope(),
          programId
        );
        const presets = (
          await Promise.allSettled(
            records.map((record) => getWorkoutPresetById(record.presetId))
          )
        )
          .flatMap((result) =>
            result.status === 'fulfilled' ? [result.value] : []
          )
          .sort((a, b) => weekOf(a) - weekOf(b));
        if (presets.length === 0) return false;
        const startedAt = Math.min(
          ...records.map((record) => Date.parse(record.access.startedAt))
        );
        const week = Math.floor((Date.now() - startedAt) / WEEK_MS);
        const preset = presets[Math.min(Math.max(0, week), presets.length - 1)];
        await startLiveWorkout({
          name: preset.name,
          exercises: buildPresetStartExercisesPayload(preset),
          sourcePresetId: preset.id,
        });
        return true;
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [startLiveWorkout]
  );
  return { startInstalledProgram: start, isStarting: isStarting || loading };
}
