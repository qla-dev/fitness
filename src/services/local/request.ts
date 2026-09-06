import type { LocalRecord } from './database';

export interface LocalRequest {
  path: string;
  query: URLSearchParams;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body: LocalRecord;
}
export interface LocalResult {
  value: unknown;
}
