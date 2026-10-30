import { localApiFetch } from '../local/localApi';

export { normalizeUrl } from '../../utils/serverUrl';

interface ApiFetchOptions {
  endpoint: string;
  serviceName: string;
  operation: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** Diary operations always read and write the on-device database. */
export async function apiFetch<T>(options: ApiFetchOptions): Promise<T> {
  return localApiFetch<T>(options);
}
