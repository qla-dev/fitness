import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useExternalProviders } from './useExternalProviders';
import {
  fetchProgramExercise,
  type ProgramLookupProvider,
} from './useProgramExerciseLookup';
import { programThumbnailQueryKey } from './queryKeys';
import type { ExerciseProgram } from '../types/exerciseProgram';

/**
 * How many of a program's movements are tried before it settles for its icon.
 *
 * A store program is static text, so its cover has to be looked up rather than
 * read off a saved row, and each attempt is a request. The walk stops early:
 * the opening movements characterise a session anyway, and a program whose
 * first three carry no artwork is unlikely to do better further down.
 */
const MAX_MOVEMENTS_TRIED = 3;

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** The movements to try, in program order, without repeating a name. */
export function programCoverCandidates(program: ExerciseProgram): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      const key = normalize(exercise.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(exercise.name);
      if (names.length >= MAX_MOVEMENTS_TRIED) return names;
    }
  }
  return names;
}

/**
 * Cover images for a list of store programs, keyed by program id.
 *
 * A saved workout program takes its thumbnail from the first exercise in it
 * that has artwork; this is the same rule for a program that is not saved yet.
 * The difference is that a store program only knows movement names, so each is
 * resolved through `fetchProgramExercise` — the library first, then the
 * provider. That is the same per-name cache the detail screen's rows read, so a
 * cover resolved on a shelf is already warm when the program is opened, and a
 * movement shared by two programs is fetched once.
 *
 * One query per program, so a slow or failing lookup never holds up the rest of
 * the shelf: each row shows its icon until its own cover arrives. Covers do not
 * change for a given program, so they are cached for the session.
 */
export function useProgramThumbnails(
  programs: readonly ExerciseProgram[],
  options: { enabled?: boolean } = {}
): Record<string, string> {
  const enabled = options.enabled ?? true;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { providers } = useExternalProviders({
    enabled,
    category: 'exercise',
  });
  const provider: ProgramLookupProvider | null = providers[0] ?? null;

  return useQueries({
    queries: programs.map((program) => ({
      queryKey: programThumbnailQueryKey(program.id, provider?.id ?? null),
      queryFn: async (): Promise<string | null> => {
        for (const name of programCoverCandidates(program)) {
          try {
            const exercise = await fetchProgramExercise(
              queryClient,
              name,
              provider,
              t
            );
            const image = exercise?.images?.[0];
            if (image) return image;
          } catch {
            // A cover is decoration: a failed lookup falls through to the next
            // movement, and ultimately to the program's own icon.
          }
        }
        return null;
      },
      enabled,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    })),
    combine: (results) => {
      const covers: Record<string, string> = {};
      results.forEach((result, index) => {
        const program = programs[index];
        if (program && typeof result.data === 'string' && result.data) {
          covers[program.id] = result.data;
        }
      });
      return covers;
    },
  });
}
