import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useOnlineSync } from '../../src/hooks/useOnlineSync';
import { queryClient } from '../../src/hooks/queryClient';
import { syncOnline } from '../../src/services/online/sync';

const mockSyncState = {
  enabled: true,
  intervalMinutes: 15,
  lastSynced: new Date().toISOString(),
};
jest.mock('../../src/services/online/account', () => ({
  loadOnlineAccount: jest.fn().mockResolvedValue(undefined),
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: { user: { id: 'one' } } }),
}));
jest.mock('../../src/services/online/sync', () => ({
  loadSyncSettings: jest.fn().mockResolvedValue(undefined),
  syncOnline: jest.fn().mockResolvedValue(undefined),
  useOnlineSync: Object.assign(
    (selector: (state: unknown) => unknown) => selector(mockSyncState),
    { getState: () => mockSyncState }
  ),
}));
jest.mock('../../src/services/online/background', () => ({
  configureOnlineBackgroundSync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));

it('refreshes screens on resume even when background sync just finished', () => {
  let resume!: (state: AppStateStatus) => void;
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      resume = callback;
      return { remove: jest.fn() };
    });
  const screen = renderHook(() => useOnlineSync());
  expect(syncOnline).not.toHaveBeenCalled();
  act(() => resume('active'));
  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  expect(syncOnline).not.toHaveBeenCalled();
  screen.unmount();
  listener.mockRestore();
});
