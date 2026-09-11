import { fetchExercisesPage } from './api/exerciseApi';
import {
  importExercise,
  searchExternalExercises,
} from './api/externalExerciseSearchApi';
import { createWorkoutPreset } from './api/workoutPresetsApi';
import { addLog } from './LogService';
import {
  createProgramAccess,
  markProgramInstalled,
  programAccessScope,
  saveProgramAccess,
} from './programAccess';
import type {
  ExerciseProgram,
  ProgramExercise,
  ProgramSession,
} from '../types/exerciseProgram';
import type { WorkoutPresetCreatePayload } from './api/workoutPresetsApi';

export interface ProgramProvider {
  id: string;
  provider_type: string;
}

export interface ProgramInstallProgress {
  /** Movements resolved so far, across every session. */
  resolved: number;
  total: number;
  /** Session currently being built, 1-based. */
  session: number;
  sessions: number;
}

export interface ProgramInstallResult {
  presetsCreated: number;
  exercisesAdded: number;
  /** Movement names no library or provider could match. */
  skipped: string[];
}

/**
 * Parses a program's rep prescription into a set count and a rep number.
 *
 * Program reps are human text ('8-10', '45 s', 'AMRAP', '10 each leg'). The
 * preset schema wants a number or nothing, so a range takes its lower bound
 * and anything non-numeric stores no reps rather than a wrong number.
 */
export function parseProgramReps(reps: string): number | null {
  const match = reps.trim().match(/^(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Finds a real exercise id for a program movement: the user's library first,
 * then the provider (importing the match so the id survives).
 *
 * Returns null when nothing matches — the caller skips that movement rather
 * than failing the whole install.
 */
export async function resolveProgramExerciseId(
  name: string,
  provider: ProgramProvider | null
): Promise<string | null> {
  try {
    const page = await fetchExercisesPage({
      searchTerm: name,
      page: 1,
      pageSize: 10,
    });
    const exact = page.exercises.find(
      (item) => normalize(item.name) === normalize(name)
    );
    const saved = exact ?? page.exercises[0];
    if (saved) return saved.id;
  } catch (error) {
    addLog(
      `[Programs] Library lookup failed for "${name}": ${String(error)}`,
      'WARNING'
    );
  }

  if (!provider) return null;

  try {
    const online = await searchExternalExercises(
      name,
      provider.provider_type,
      provider.id,
      1
    );
    const exact = online.items.find(
      (item) => normalize(item.name) === normalize(name)
    );
    const match = exact ?? online.items[0];
    if (!match) return null;
    const imported = await importExercise(match.source, match.id);
    return imported.id;
  } catch (error) {
    addLog(
      `[Programs] Provider lookup failed for "${name}": ${String(error)}`,
      'WARNING'
    );
    return null;
  }
}

function buildPresetExercise(
  exerciseId: string,
  exercise: ProgramExercise,
  sortOrder: number
) {
  const reps = parseProgramReps(exercise.reps);
  return {
    exercise_id: exerciseId,
    sort_order: sortOrder,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      set_number: index + 1,
      reps,
      rest_time: exercise.restSec,
      notes: exercise.note ?? null,
    })),
  };
}

function presetName(program: ExerciseProgram, session: ProgramSession): string {
  return `${program.name} · ${session.name}`;
}

/**
 * Installs a program as workout presets — one preset per session.
 *
 * A session's movements are stored as names, so each one is resolved to a real
 * exercise id first; unresolvable movements are reported back rather than
 * silently dropped, and a session that resolves nothing creates no preset.
 */
export async function installProgramAsPresets(
  program: ExerciseProgram,
  provider: ProgramProvider | null,
  onProgress?: (progress: ProgramInstallProgress) => void
): Promise<ProgramInstallResult> {
  const scope = await programAccessScope();
  const access = createProgramAccess(program.id, program.weeks);
  const total = program.sessions.reduce(
    (sum, session) => sum + session.exercises.length,
    0
  );
  const skipped: string[] = [];
  // One id per distinct movement: programs repeat exercises across sessions,
  // and resolving the same name twice would double the requests and imports.
  const resolvedIds = new Map<string, string | null>();
  let resolved = 0;
  let presetsCreated = 0;
  let exercisesAdded = 0;

  for (const [index, session] of program.sessions.entries()) {
    const payloadExercises: NonNullable<
      WorkoutPresetCreatePayload['exercises']
    > = [];

    for (const exercise of session.exercises) {
      const key = normalize(exercise.name);
      if (!resolvedIds.has(key)) {
        resolvedIds.set(
          key,
          await resolveProgramExerciseId(exercise.name, provider)
        );
      }
      const exerciseId = resolvedIds.get(key) ?? null;
      resolved += 1;
      onProgress?.({
        resolved,
        total,
        session: index + 1,
        sessions: program.sessions.length,
      });

      if (!exerciseId) {
        skipped.push(exercise.name);
        continue;
      }
      payloadExercises.push(
        buildPresetExercise(exerciseId, exercise, payloadExercises.length)
      );
    }

    if (payloadExercises.length === 0) continue;

    const preset = await createWorkoutPreset({
      name: presetName(program, session),
      description: `${program.tagline} — ${session.focus}`,
      exercises: payloadExercises,
    });
    await saveProgramAccess(scope, preset.id, access);
    presetsCreated += 1;
    exercisesAdded += payloadExercises.length;
  }

  // A session that resolved nothing creates no preset; only a real install is
  // recorded, so a fully unresolvable program can be retried from Start.
  if (presetsCreated > 0) await markProgramInstalled(scope, program.id);

  addLog(
    `[Programs] Installed "${program.name}": ${presetsCreated} presets, ${exercisesAdded} exercises, ${skipped.length} skipped.`,
    'INFO'
  );

  return { presetsCreated, exercisesAdded, skipped };
}
