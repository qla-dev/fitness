import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

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
 * rather than up front: a program lists 20+ movements across its sessions, and
 * pre-resolving all of them would fire that many requests just to open the
 * page.
 */
export function useProgramExerciseLookup(enabled: boolean) {
  const { t } = useTranslation();
  const { providers } = useExternalProviders({
    enabled,
    category: 'exercise',
  });
  const provider = providers[0] ?? null;
  const [resolvingName, setResolvingName] = useState<string | null>(null);
  const inFlight = useRef(false);

  const resolve = useCallback(
    async (name: string): Promise<Exercise | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setResolvingName(name);
      try {
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
    [provider, t]
  );

  return { resolve, resolvingName };
}
