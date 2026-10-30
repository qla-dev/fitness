import {
  syncHealthData,
  checkServerConnection,
} from '../../src/services/api/healthDataApi';
import { localApiFetch } from '../../src/services/local/localApi';

jest.mock('../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test('health imports report the repository result without using HTTP', async () => {
  const previousFetch = global.fetch;
  const fetchSpy = jest.fn();
  global.fetch = fetchSpy;
  const summary = { recordsSent: 1, recordErrors: [] };
  jest.mocked(localApiFetch).mockResolvedValue(summary);
  try {
    expect(
      await syncHealthData([{ type: 'Steps', value: 10, date: '2026-10-30' }])
    ).toEqual(summary);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    global.fetch = previousFetch;
  }
});

test('a failed health import rejects so the sync cursor cannot advance', async () => {
  jest.mocked(localApiFetch).mockRejectedValue(new Error('Storage full'));
  await expect(syncHealthData([{ type: 'Steps', value: 10 }])).rejects.toThrow(
    'Storage full'
  );
});

test('diary readiness succeeds only when storage can be read', async () => {
  jest.mocked(localApiFetch).mockResolvedValue({});
  await expect(checkServerConnection()).resolves.toBe(true);
  jest
    .mocked(localApiFetch)
    .mockRejectedValue(new Error('Storage unavailable'));
  await expect(checkServerConnection()).rejects.toThrow('Storage unavailable');
});
