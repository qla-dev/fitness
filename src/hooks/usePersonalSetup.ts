import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  readSetup,
  setupScope,
  updateSetup,
  type PersonalSetup,
} from '../services/personalSetup';
import { addLog } from '../services/LogService';

export function usePersonalSetup(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['personalSetup'],
    enabled,
    queryFn: async () => {
      try {
        const scope = await setupScope();
        return { scope, state: await readSetup(scope) };
      } catch (error) {
        // Behind the Profile's Retry row; this is the only trace of why.
        addLog(`[Setup] Reading the setup failed: ${String(error)}`, 'ERROR');
        throw error;
      }
    },
  });
  const mutation = useMutation({
    mutationFn: async (update: (state: PersonalSetup) => PersonalSetup) => {
      const scope = await setupScope();
      if (!query.data || query.data.scope !== scope)
        throw new Error('Account changed; reopen setup before saving');
      return { scope, state: await updateSetup(scope, update) };
    },
    onSuccess: async (data) => {
      if ((await setupScope()) === data.scope)
        client.setQueryData(['personalSetup'], data);
    },
  });
  return {
    ...query,
    state: query.data?.state,
    save: mutation.mutateAsync,
    saving: mutation.isPending,
    saveError: mutation.isError,
  };
}
