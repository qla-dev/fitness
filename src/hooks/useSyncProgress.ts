import { useSyncExternalStore } from 'react';
import {
  getSyncProgress,
  subscribeSyncProgress,
  type SyncProgress,
} from '../services/shared/syncProgress';

/** The running sync's metric progress, or null when nothing is running. */
export const useSyncProgress = (): SyncProgress | null =>
  useSyncExternalStore(subscribeSyncProgress, getSyncProgress, getSyncProgress);
