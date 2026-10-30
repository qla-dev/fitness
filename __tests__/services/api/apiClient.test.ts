import { normalizeUrl, apiFetch } from '../../../src/services/api/apiClient';
import { localApiFetch } from '../../../src/services/local/localApi';
import { TimeoutError, fetchWithTimeout } from '../../../src/utils/concurrency';

jest.mock('../../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn(),
}));

describe('apiClient', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Signal-aware mock that rejects on abort (like real fetch)
  const mockFetchThatNeverResponds = () => {
    mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
  };

  describe('fetchWithTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('resolves when fetch completes before timeout', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout(
        'https://example.com',
        { method: 'GET' },
        5000
      );

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('throws TimeoutError when fetch exceeds timeout', async () => {
      mockFetchThatNeverResponds();

      const promise = fetchWithTimeout('https://example.com', {}, 5000);
      // Attach handler BEFORE advancing timers to avoid unhandled rejection
      const assertion = expect(promise).rejects.toThrow(TimeoutError);

      await jest.advanceTimersByTimeAsync(5000);

      await assertion;
    });

    test('timeout message includes the timeout budget', async () => {
      mockFetchThatNeverResponds();

      const promise = fetchWithTimeout('https://example.com', {}, 5000);
      const assertion = expect(promise).rejects.toThrow(
        'Request timed out after 5000ms'
      );

      await jest.advanceTimersByTimeAsync(5000);

      await assertion;
    });

    test('passes options through to fetch', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const headers = { Authorization: 'Bearer token' };
      await fetchWithTimeout(
        'https://example.com',
        { method: 'POST', headers, body: '{}' },
        5000
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ method: 'POST', headers, body: '{}' })
      );
    });
  });

  describe('normalizeUrl', () => {
    test('removes trailing slash from URL', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });

    test('returns URL unchanged if no trailing slash', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    test('handles URL with path and trailing slash', () => {
      expect(normalizeUrl('https://example.com/api/')).toBe(
        'https://example.com/api'
      );
    });

    test('handles URL with path and no trailing slash', () => {
      expect(normalizeUrl('https://example.com/api')).toBe(
        'https://example.com/api'
      );
    });
  });

  describe('diary API', () => {
    test('uses the device repository without making a network request', async () => {
      jest
        .mocked(localApiFetch)
        .mockResolvedValue({ default_weight_unit: 'lbs' });
      const result = await apiFetch({
        endpoint: '/api/user-preferences',
        serviceName: 'Test',
        operation: 'read preferences',
      });
      expect(result).toEqual({ default_weight_unit: 'lbs' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('propagates failed saves without falling through to the network', async () => {
      jest.mocked(localApiFetch).mockRejectedValue(new Error('Storage full'));
      await expect(
        apiFetch({
          endpoint: '/api/user-preferences',
          method: 'PUT',
          body: { default_weight_unit: 'lbs' },
          serviceName: 'Test',
          operation: 'save preferences',
        })
      ).rejects.toThrow('Storage full');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
