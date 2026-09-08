import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';

import { fetchExercisesPage } from '../services/api/exerciseApi';
import { searchExternalExercises } from '../services/api/externalExerciseSearchApi';
import { exerciseFromExternalItem } from '../utils/workoutSession';
import { useExternalProviders } from './useExternalProviders';
import type { Exercise } from '../types/exercise';

function bestMatch<T extends { name: string }>(
  items: T[],
  wanted: string
): T | undefined {
  const target = wanted.trim().toLowerCase();
  return (
    items.find((item) => item.name.trim().toLowerCase() === target) ?? items[0]
  );
}

/**
 * Resolves a program's exercise name to a real exercise.
 *
 * Programs store names rather than ids, because the same movement exists under
 * a different id in every library and provider. Resolution happens on tap
 * or as rows become visible. Cached lookups are shared by repeated movements.
 */
export function useProgramExerciseLookup(enabled: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { providers } = useExternalProviders({
    enabled,
    category: 'exercise',
  });
  const provider = providers[0] ?? null;
  const [resolvingName, setResolvingName] = useState<string | null>(null);
  const inFlight = useRef(false);

  const lookup = useCallback(
    (name: string) =>
      queryClient.fetchQuery({
        queryKey: [
          'programExerciseLookup',
          provider?.id ?? null,
          name.trim().toLowerCase(),
        ],
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async (): Promise<Exercise | null> => {
          const page = await fetchExercisesPage({
            searchTerm: name,
            page: 1,
            pageSize: 10,
          });
          const saved = bestMatch(page.exercises, name);
          if (saved) return saved;
          if (provider) {
            const online = await searchExternalExercises(
              name,
              provider.provider_type,
              provider.id,
              1
            );
            const match = bestMatch(online.items, name);
            if (match) return exerciseFromExternalItem(match, t);
          }
          return null;
        },
      }),
    [provider, queryClient, t]
  );

  const resolve = useCallback(
    async (name: string): Promise<Exercise | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setResolvingName(name);
      try {
        const exercise = await lookup(name);
        if (exercise) return exercise;

        Toast.show({
          type: 'error',
          text1: t('programs.exerciseNotFound', {
            defaultValue: 'Could not find {{name}}',
            name,
          }),
        });
        return null;
      } catch {
        Toast.show({
          type: 'error',
          text1: t('programs.exerciseLookupFailed', {
            defaultValue: 'Could not load this exercise.',
          }),
        });
        return null;
      } finally {
        inFlight.current = false;
        setResolvingName(null);
      }
    },
    [lookup, t]
  );

  return { resolve, resolvingName, lookup };
}
