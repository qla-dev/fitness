import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  countLogsBetween,
  deleteAllLogs,
  deleteLogsBefore,
  insertLogs,
  readLogs,
  _resetLogDatabaseForTesting,
} from './logDatabase';

// Unified status type (replaces both LogLevel and LogStatus)
export type LogStatus = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

// Threshold used by both the capture-level and view-filter settings.
export type LogThreshold =
  'all' | 'no_debug' | 'warnings_errors' | 'errors_only';

export interface LogEntry {
  timestamp: string;
  message: string;
  status: LogStatus;
  details: string[];
}

// Shape of log entries as they may appear on disk — older writes can still
// carry legacy `level` or `status: 'SUCCESS'` values that have not yet been
// migrated. Normalized into LogEntry by `migrateLogEntry`.
interface StoredLogEntry {
  timestamp: string;
  message: string;
  status: LogStatus | 'SUCCESS';
  details?: string[];
  level?: string;
}

export interface LogSummary {
  DEBUG: number;
  INFO: number;
  WARNING: number;
  ERROR: number;
}

/** Where entries lived before they moved to SQLite; imported once, then removed. */
const LEGACY_LOG_KEY = 'app_logs';
const LOG_CAPTURE_LEVEL_KEY = 'log_capture_level';
const LOG_VIEW_FILTER_KEY = 'log_view_filter';
const LOG_VIEW_SELECTED_STATUSES_KEY = 'log_view_selected_statuses';
const OLD_LOG_FILTER_KEY = 'log_filter'; // Migrated into view filter, then deleted
const OLD_LOG_LEVEL_KEY = 'log_level'; // Migrated into view filter, then deleted

const ALL_LOG_STATUSES: LogStatus[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];
const isLogStatus = (value: unknown): value is LogStatus =>
  typeof value === 'string' && (ALL_LOG_STATUSES as string[]).includes(value);

// Status severity for filtering (lower = more critical)
const STATUS_SEVERITY: Record<LogStatus, number> = {
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
  DEBUG: 4,
};

// Threshold table shared by capture and view settings.
const THRESHOLD_LEVEL: Record<LogThreshold, number> = {
  all: 4,
  no_debug: 3,
  warnings_errors: 2,
  errors_only: 1,
};

// Translation from the legacy threshold filter to the chip-selection model
// used by the Log screen. `all` maps to `[]` (the "show all" sentinel) so
// users who never narrowed their filter keep seeing every level.
const THRESHOLD_TO_STATUSES: Record<LogThreshold, LogStatus[]> = {
  all: [],
  no_debug: ['ERROR', 'WARNING', 'INFO'],
  warnings_errors: ['ERROR', 'WARNING'],
  errors_only: ['ERROR'],
};

// --- Write buffering and setting caching state ---
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 20;
const MAX_LOG_ENTRIES = 1000;
const MAX_FLUSH_FAILURES = 3;

let cachedCaptureLevel: LogThreshold | null = null;
let cachedViewFilter: LogThreshold | null = null;
let cachedSelectedStatuses: LogStatus[] | null = null;
let writeBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
// Serializes the one-shot view-filter migration chain so concurrent callers
// at init don't see intermediate states (e.g. old key deleted, new key not
// yet written).
let getViewPromise: Promise<LogThreshold> | null = null;
let consecutiveFlushFailures = 0;
// The one-time import of the old AsyncStorage array, shared by every first
// caller in a process.
let legacyImport: Promise<void> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;

/**
 * Normalizes a stored log entry to the current on-disk shape. Returns
 * `changed: true` when the input required rewriting (legacy `level` field
 * or `status: 'SUCCESS'`) so callers can decide whether to write back.
 */
const migrateLogEntry = (
  entry: StoredLogEntry
): { entry: LogEntry; changed: boolean } => {
  let changed = false;
  let status: LogStatus;

  if (entry.level === 'debug') {
    // Legacy 'debug' level always wins over whatever status was written.
    status = 'DEBUG';
    changed = true;
  } else if (entry.status === 'SUCCESS') {
    // Fold legacy SUCCESS into INFO.
    status = 'INFO';
    changed = true;
  } else {
    status = entry.status || 'INFO';
    if (entry.level !== undefined || entry.status === undefined) {
      changed = true;
    }
  }

  return {
    entry: {
      timestamp: entry.timestamp,
      message: entry.message,
      status,
      details: entry.details || [],
    },
    changed,
  };
};

/**
 * Moves entries written by older builds (one AsyncStorage array, newest
 * first) into the log database, normalizing legacy shapes on the way, then
 * deletes the array. Runs at most once per process; a failure leaves the
 * array in place for the next launch.
 */
const importLegacyLogs = (): Promise<void> => {
  if (!legacyImport) {
    legacyImport = (async () => {
      const raw = await AsyncStorage.getItem(LEGACY_LOG_KEY);
      if (raw === null) return;
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* Unreadable old logs are not worth keeping the key around for. */
      }
      const entries = (Array.isArray(parsed) ? parsed : []).map(
        (entry: StoredLogEntry) => migrateLogEntry(entry).entry
      );
      await insertLogs(entries, MAX_LOG_ENTRIES);
      await AsyncStorage.removeItem(LEGACY_LOG_KEY);
    })().catch((error) => {
      legacyImport = null;
      throw error;
    });
  }
  return legacyImport;
};

/** Statuses at or above a threshold's severity, e.g. no_debug → ERROR…INFO. */
const statusesFor = (threshold: LogThreshold): LogStatus[] =>
  ALL_LOG_STATUSES.filter(
    (status) => STATUS_SEVERITY[status] <= THRESHOLD_LEVEL[threshold]
  );

/**
 * Flushes the write buffer to the log database./**
 * Flushes the write buffer to AsyncStorage.
 * Serializes concurrent flush calls via flushPromise.
 */
const flushBuffer = async (): Promise<void> => {
  // Wait for all in-flight flushes so callers read fully committed data.
  // Loop because another caller can start a new flush in the gap after
  // our await resolves (e.g. concurrent getLogs + getLogSummary).
  while (flushPromise) {
    await flushPromise;
  }

  if (writeBuffer.length === 0) return;

  // Swap buffer to local variable so new addLog() calls go to a fresh buffer
  const entriesToFlush = writeBuffer;
  writeBuffer = [];

  // Clear any pending timer since we're flushing now
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const doFlush = async (): Promise<void> => {
    try {
      // Rows, not a rewritten array: a burst of sync errors used to parse and
      // re-serialize the full ~240 KB of logs on every 20 entries (#2191).
      // One transaction, so a failed flush inserts nothing and the requeue
      // below cannot persist an entry twice.
      await importLegacyLogs();
      await insertLogs(entriesToFlush, MAX_LOG_ENTRIES);
      consecutiveFlushFailures = 0;
    } catch (error) {
      consecutiveFlushFailures++;
      if (consecutiveFlushFailures < MAX_FLUSH_FAILURES) {
        // Restore entries to buffer for retry
        writeBuffer = [...entriesToFlush, ...writeBuffer];
      } else {
        // A warning, not an error: losing a few log lines is not worth the
        // red screen a console.error raises in development.
        console.warn(
          '[LogService] Dropping buffered entries after repeated flush failures',
          error
        );
      }
    }
  };

  flushPromise = doFlush();
  await flushPromise;
  flushPromise = null;
};

/**
 * Schedules a deferred flush if one isn't already pending.
 */
const scheduleFlush = (): void => {
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushBuffer().catch((error) => {
        console.error('[LogService] Scheduled flush failed:', error);
      });
    }, FLUSH_INTERVAL_MS);
  }
};

/**
 * Adds a new log entry with a specified status and optional details.
 * Entries whose severity exceeds the capture-level threshold are dropped
 * at write time.
 */
export const addLog = async (
  message: string,
  status: LogStatus = 'INFO',
  details: string[] = []
): Promise<void> => {
  try {
    const captureLevel = await getCaptureLevel();
    const statusSeverity = STATUS_SEVERITY[status];
    const captureThreshold = THRESHOLD_LEVEL[captureLevel];

    if (statusSeverity > captureThreshold) {
      return; // Don't capture entries below the capture threshold
    }

    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      message,
      status,
      details,
    };
    writeBuffer.unshift(newLog);
    console.log(`[LogService] Logged: [${status}] ${message}`);

    if (writeBuffer.length >= FLUSH_THRESHOLD) {
      await flushBuffer();
    } else {
      scheduleFlush();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LogService] Failed to add log: ${errorMessage}`, error);
  }
};

/**
 * Clears logs older than a specified number of days. Legacy-format
 * entries (SUCCESS→INFO, level→status) are normalized when imported.
 */
export const pruneLogs = async (daysToKeep: number = 3): Promise<void> => {
  try {
    await flushBuffer();
    await importLegacyLogs();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    cutoffDate.setHours(0, 0, 0, 0); // Set to beginning of the day

    const removedCount = await deleteLogsBefore(cutoffDate.toISOString());
    if (removedCount !== 0) {
      console.log(
        '[LogService] Pruned logs: removed ' + removedCount + ' old entries.'
      );
    }
  } catch (error) {
    console.error('[LogService] Failed to prune logs', error);
  }
};

/**
 * Retrieves log entries with pagination, filtered by the view filter
 * (or an explicit override) at read time.
 */
export const getLogs = async (
  offset: number = 0,
  limit: number = 30,
  filter: LogThreshold | null = null
): Promise<LogEntry[]> => {
  try {
    await flushBuffer();
    await importLegacyLogs();

    const viewFilter = filter || (await getViewFilter());
    return await readLogs(statusesFor(viewFilter), offset, limit);
  } catch (error) {
    console.error('Failed to get logs', error);
    return [];
  }
};

/**
 * Clears all log entries.
 */
export const clearLogs = async (): Promise<void> => {
  try {
    writeBuffer = [];
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    // Wait for all in-flight flushes before removing storage.
    // Use a while loop (like flushBuffer does) because another waiter
    // (e.g. getLogs) can resume from the same flush and start a new one
    // before we reach removeItem. Re-clear the buffer each iteration
    // because a failed flush restores entries into writeBuffer.
    while (flushPromise) {
      await flushPromise;
      writeBuffer = [];
    }
    await deleteAllLogs();
    // Not imported yet (a clear before anything was read): drop it too.
    await AsyncStorage.removeItem(LEGACY_LOG_KEY);
    console.log('[LogService] All logs cleared.');
  } catch (error) {
    console.error('Failed to clear logs', error);
  }
};

/**
 * Sets the capture level (what addLog writes to disk).
 */
export const setCaptureLevel = async (level: LogThreshold): Promise<void> => {
  try {
    if (THRESHOLD_LEVEL[level] !== undefined) {
      await AsyncStorage.setItem(LOG_CAPTURE_LEVEL_KEY, level);
      cachedCaptureLevel = level;
    } else {
      console.warn(`Invalid log capture level: ${level}. Not setting.`);
    }
  } catch (error) {
    console.error('Failed to set log capture level', error);
  }
};

/**
 * Retrieves the current capture level.
 * Plain cached read with no migration chain — default is `all`.
 */
export const getCaptureLevel = async (): Promise<LogThreshold> => {
  if (cachedCaptureLevel !== null) return cachedCaptureLevel;

  try {
    const stored = await AsyncStorage.getItem(LOG_CAPTURE_LEVEL_KEY);
    if (stored && THRESHOLD_LEVEL[stored as LogThreshold] !== undefined) {
      cachedCaptureLevel = stored as LogThreshold;
      return cachedCaptureLevel;
    }

    cachedCaptureLevel = 'all'; // Default: capture everything
    return cachedCaptureLevel;
  } catch (error) {
    console.error('Failed to get log capture level', error);
    return 'all';
  }
};

/**
 * Sets the view filter (what the Log screen reads back).
 */
export const setViewFilter = async (filter: LogThreshold): Promise<void> => {
  try {
    if (THRESHOLD_LEVEL[filter] !== undefined) {
      await AsyncStorage.setItem(LOG_VIEW_FILTER_KEY, filter);
      cachedViewFilter = filter;
    } else {
      console.warn(`Invalid log view filter: ${filter}. Not setting.`);
    }
  } catch (error) {
    console.error('Failed to set log view filter', error);
  }
};

/**
 * Retrieves the current view filter.
 * Migrates from the old combined `log_filter` setting (or the even older
 * `log_level` preference) on first read. Serialized via `getViewPromise`
 * so concurrent callers don't observe intermediate migration states.
 */
export const getViewFilter = async (): Promise<LogThreshold> => {
  if (cachedViewFilter !== null) return cachedViewFilter;
  if (getViewPromise) return getViewPromise;

  const run = async (): Promise<LogThreshold> => {
    try {
      // 1) New key.
      const stored = await AsyncStorage.getItem(LOG_VIEW_FILTER_KEY);
      if (stored && THRESHOLD_LEVEL[stored as LogThreshold] !== undefined) {
        cachedViewFilter = stored as LogThreshold;
        return cachedViewFilter;
      }

      // 2) Old combined `log_filter` — users set this expecting it to
      // control what they *saw*, so it migrates into the view filter.
      const oldFilter = await AsyncStorage.getItem(OLD_LOG_FILTER_KEY);
      if (
        oldFilter &&
        THRESHOLD_LEVEL[oldFilter as LogThreshold] !== undefined
      ) {
        await AsyncStorage.setItem(LOG_VIEW_FILTER_KEY, oldFilter);
        await AsyncStorage.removeItem(OLD_LOG_FILTER_KEY);
        cachedViewFilter = oldFilter as LogThreshold;
        return cachedViewFilter;
      }

      // 3) Even older `log_level` preference.
      const oldLevel = await AsyncStorage.getItem(OLD_LOG_LEVEL_KEY);
      if (oldLevel) {
        const migrationMap: Record<string, LogThreshold> = {
          debug: 'all',
          info: 'no_debug',
          warn: 'warnings_errors',
          error: 'errors_only',
          silent: 'errors_only',
        };
        const newFilter = migrationMap[oldLevel] || 'no_debug';
        await AsyncStorage.setItem(LOG_VIEW_FILTER_KEY, newFilter);
        await AsyncStorage.removeItem(OLD_LOG_LEVEL_KEY);
        cachedViewFilter = newFilter;
        return cachedViewFilter;
      }

      cachedViewFilter = 'no_debug'; // Default
      return cachedViewFilter;
    } catch (error) {
      console.error('Failed to get log view filter', error);
      return 'no_debug';
    }
  };

  getViewPromise = run();
  try {
    return await getViewPromise;
  } finally {
    getViewPromise = null;
  }
};

/**
 * Retrieves the per-status chip selection used by the Log screen.
 * An empty array means "no explicit selection — show all" and is the
 * default on a fresh install. Unknown values in the stored array are
 * dropped silently.
 *
 * When no chip selection is stored, translate a previously persisted
 * threshold filter (`log_view_filter`) into an equivalent chip selection
 * so users who had set `errors_only`, `no_debug`, etc. before this
 * screen was refactored don't silently have their filter reset to
 * "show all" on upgrade.
 */
export const getViewSelectedStatuses = async (): Promise<LogStatus[]> => {
  if (cachedSelectedStatuses !== null) return cachedSelectedStatuses;

  try {
    const stored = await AsyncStorage.getItem(LOG_VIEW_SELECTED_STATUSES_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      cachedSelectedStatuses = Array.isArray(parsed)
        ? parsed.filter(isLogStatus)
        : [];
      return cachedSelectedStatuses;
    }

    const legacyThreshold = await AsyncStorage.getItem(LOG_VIEW_FILTER_KEY);
    if (
      legacyThreshold &&
      THRESHOLD_LEVEL[legacyThreshold as LogThreshold] !== undefined
    ) {
      cachedSelectedStatuses = [
        ...THRESHOLD_TO_STATUSES[legacyThreshold as LogThreshold],
      ];
      return cachedSelectedStatuses;
    }

    cachedSelectedStatuses = [];
    return cachedSelectedStatuses;
  } catch (error) {
    console.error('Failed to get selected log statuses', error);
    cachedSelectedStatuses = [];
    return cachedSelectedStatuses;
  }
};

/**
 * Persists the per-status chip selection used by the Log screen.
 * Unknown values are filtered out before writing so callers cannot
 * corrupt storage.
 */
export const setViewSelectedStatuses = async (
  statuses: LogStatus[]
): Promise<void> => {
  try {
    const sanitized = statuses.filter(isLogStatus);
    await AsyncStorage.setItem(
      LOG_VIEW_SELECTED_STATUSES_KEY,
      JSON.stringify(sanitized)
    );
    cachedSelectedStatuses = sanitized;
  } catch (error) {
    console.error('Failed to set selected log statuses', error);
  }
};

/**
 * Retrieves a summary of log entries by status for today.
 * Filters by the view filter (or an explicit override) so the summary
 * reflects what the log list is showing.
 */
export const getLogSummary = async (
  filter: LogThreshold | null = null
): Promise<LogSummary> => {
  try {
    await flushBuffer();
    await importLegacyLogs();

    const viewFilter = filter || (await getViewFilter());

    // Today in local time, as the ISO range the rows are stamped in.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const counts = await countLogsBetween(
      statusesFor(viewFilter),
      today.toISOString(),
      tomorrow.toISOString()
    );
    return {
      DEBUG: counts.DEBUG ?? 0,
      INFO: counts.INFO ?? 0,
      WARNING: counts.WARNING ?? 0,
      ERROR: counts.ERROR ?? 0,
    };
  } catch (error) {
    console.error('Failed to get log summary', error);
    return { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };
  }
};

/**
 * Initializes the log service. Call once at app startup.
 * Warms the filter caches, imports any pre-SQLite logs, prunes, and registers
 * an AppState listener to flush the buffer when the app backgrounds.
 */
export const initLogService = async (): Promise<void> => {
  await getCaptureLevel();
  await getViewFilter();
  await pruneLogs();

  appStateSubscription?.remove();
  appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background' || nextState === 'inactive') {
      flushBuffer().catch((error) => {
        console.error('[LogService] Background flush failed:', error);
      });
    }
  });
};

/**
 * Resets all module-level state for testing. Not for production use.
 */
export const _resetForTesting = (): void => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  cachedCaptureLevel = null;
  cachedViewFilter = null;
  cachedSelectedStatuses = null;
  writeBuffer = [];
  flushPromise = null;
  getViewPromise = null;
  consecutiveFlushFailures = 0;
  legacyImport = null;
  _resetLogDatabaseForTesting();
  appStateSubscription?.remove();
  appStateSubscription = null;
};

/**
 * Direct reference to flushBuffer for explicit test control.
 */
export const _flushBuffer = flushBuffer;
