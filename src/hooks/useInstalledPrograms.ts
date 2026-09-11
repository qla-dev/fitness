import { useQuery } from '@tanstack/react-query';
import {
  programAccessScope,
  readInstalledPrograms,
} from '../services/programAccess';

export const installedProgramsQueryKey = ['installedPrograms'] as const;

/**
 * The ids of store programs already installed as presets, so Start can read
 * "Added" and the purchase sheet can warn before creating a second copy.
 * Invalidate `installedProgramsQueryKey` after an install.
 */
export function useInstalledPrograms(): Set<string> {
  const { data } = useQuery({
    queryKey: installedProgramsQueryKey,
    queryFn: async () => readInstalledPrograms(await programAccessScope()),
    staleTime: Infinity,
  });
  return new Set(data ?? []);
}
