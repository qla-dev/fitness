import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppBootstrap } from '../../src/hooks/useAppBootstrap';
import { apiFetch } from '../../src/services/api/apiClient';
import { getActiveServerConfig } from '../../src/services/storage';
import { isLocalDataMode } from '../../src/services/dataMode';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { dataMode: 'local' } } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/localization', () => ({
  initializeAppLanguage: jest.fn(async () => 'en'),
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(async () => null),
  proxyHeadersToRecord: jest.fn(),
}));
jest.mock('../../src/services/api/authService', () => ({
  getAuthHeaders: jest.fn(),
  notifySessionExpired: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => undefined),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('local startup opens tabs without consulting a server configuration', async () => {
  expect(isLocalDataMode()).toBe(true);
  const { result } = renderHook(() => useAppBootstrap());
  await waitFor(() => expect(result.current.initialRoute).toBe('Tabs'));
  expect(result.current.linkingEnabled).toBe(true);
  expect(getActiveServerConfig).not.toHaveBeenCalled();
});

test('the API boundary saves locally and never falls through to fetch', async () => {
  const previousFetch = global.fetch;
  const fetchSpy = jest.fn();
  global.fetch = fetchSpy;
  try {
    const settings = {
      endpoint: '/api/user-preferences',
      serviceName: 'Test',
      operation: 'preferences',
    };
    await apiFetch({
      ...settings,
      method: 'PUT',
      body: { default_weight_unit: 'lbs' },
    });
    expect(await apiFetch(settings)).toMatchObject({
      default_weight_unit: 'lbs',
    });
    await expect(
      apiFetch({ ...settings, endpoint: '/api/unsupported', method: 'POST' })
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getActiveServerConfig).not.toHaveBeenCalled();
  } finally {
    global.fetch = previousFetch;
  }
});
