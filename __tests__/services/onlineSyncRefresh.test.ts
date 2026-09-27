import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { syncOnline } from '../../src/services/online/sync';
import { onlineRequest } from '../../src/services/online/account';
import { queryClient } from '../../src/hooks/queryClient';
import { resetLocalDatabaseCache } from '../../src/services/local/database';

jest.mock('../../src/services/online/account', () => ({
  loadOnlineAccount: jest.fn().mockResolvedValue(undefined),
  useOnlineAccount: { getState: () => ({ session: { user: { id: 'one' } } }) },
  onlineRequest: jest.fn(),
  OnlineError: class OnlineError extends Error {},
}));
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
  jest.mocked(onlineRequest).mockReset();
});

it('marks queries stale after background sync without starting background refetches', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'background';
  try {
    jest.mocked(onlineRequest).mockResolvedValue({ tables: {} });
    await syncOnline();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      refetchType: 'none',
    });
  } finally {
    AppState.currentState = previous;
  }
});

it('refreshes restored data even if the following upload fails', async () => {
  const previous = AppState.currentState;
  AppState.currentState = 'active';
  try {
    jest
      .mocked(onlineRequest)
      .mockResolvedValueOnce({
        tables: {
          foods: [
            {
              id: 'food',
              version: 1,
              deleted: false,
              data: { id: 'food', name: 'Oats' },
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error('Offline'));
    await expect(syncOnline()).rejects.toThrow('Offline');
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      refetchType: 'active',
    });
  } finally {
    AppState.currentState = previous;
  }
});
