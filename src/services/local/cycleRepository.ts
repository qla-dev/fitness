import {
  addDays,
  compareDays,
  computeCycleStats,
  correlateMetricWithPhase,
  daysBetween,
  deriveCycles,
  detectAnomalies,
  detectConditionFlags,
  estimateOvulation,
  forecastSymptoms,
  latePeriodStatus,
  phaseForDay,
  predictNextCycles,
  predictionAccuracy,
  productStats,
  selectDailyInsight,
  symptomPhaseMatrix,
  CYCLE_DEFAULTS,
  type CyclePrediction,
  type DerivedCycle,
  type SharedCycleDailyLog,
  type SharedCycleSettings,
} from '@workspace/shared';
import {
  deleteRecord,
  findRecord,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import type { LocalRequest, LocalResult } from './request';
import { localMeasurements } from './healthRepository';
import { getTodayDate } from '../../utils/dateUtils';

const CYCLE_BASE = '/api/v2/cycle';
const SYMPTOM_BASE = '/api/v2/symptoms/entries';
export const CYCLE_SETTINGS = 'cycleSettings';
export const CYCLE_LOGS = 'cycleLogs';
export const CYCLES = 'cycles';
export const CYCLE_TESTS = 'cycleTests';
export const SYMPTOM_ENTRIES = 'symptomEntries';
const BBT_CATEGORY = 'basal_body_temperature';

const SETTINGS_DEFAULTS: SharedCycleSettings = {
  enabled: true,
  mode: 'standard',
  avg_cycle_length_override: null,
  avg_period_length_override: null,
  luteal_phase_length: CYCLE_DEFAULTS.lutealLength,
  birth_control_method: 'none',
  conditions: [],
  show_fertile_window: true,
  preferred_products: [],
  dismissed_prompts: [],
  terminology: 'default',
  discreet_mode: false,
  onboarded_at: null,
};

const settingsRow = (db: LocalDatabase) => table(db, CYCLE_SETTINGS)[0];
const settingsOf = (db: LocalDatabase): SharedCycleSettings => ({
  ...SETTINGS_DEFAULTS,
  ...(settingsRow(db) as Partial<SharedCycleSettings> | undefined),
});

function saveSettings(db: LocalDatabase, body: LocalRecord) {
  const { mark_onboarded, reset_onboarding, ...changes } = body;
  const previous = settingsRow(db);
  return saveRecord(
    db,
    CYCLE_SETTINGS,
    {
      ...(previous ? {} : SETTINGS_DEFAULTS),
      ...changes,
      ...(mark_onboarded ? { onboarded_at: new Date().toISOString() } : null),
      ...(reset_onboarding ? { onboarded_at: null } : null),
    },
    previous?.id
  );
}

/**
 * Basal body temperature is a custom measurement, not a field of the log, so
 * the reading for each day is joined in on the way out — the last one
 * entered for a day wins.
 */
function bbtByDay(db: LocalDatabase): Map<string, number> {
  const category = table(db, 'measurementCategories').find(
    (row) => row.name === BBT_CATEGORY
  );
  const days = new Map<string, number>();
  if (!category) return days;
  for (const row of table(db, 'customMeasurements')) {
    const value = Number(row.value);
    if (String(row.category_id) === String(category.id) && Number.isFinite(value))
      days.set(String(row.entry_date), value);
  }
  return days;
}

function logs(db: LocalDatabase): SharedCycleDailyLog[] {
  const bbt = bbtByDay(db);
  return table(db, CYCLE_LOGS)
    .map(
      (row) =>
        ({
          product_usage: {},
          unusual_discharge: [],
          ...row,
          bbt: bbt.get(String(row.entry_date)) ?? null,
        }) as unknown as SharedCycleDailyLog
    )
    .sort((a, b) => compareDays(a.entry_date, b.entry_date));
}

function upsertLog(db: LocalDatabase, date: string, body: LocalRecord) {
  const { bbt: _bbt, id: _id, ...changes } = body;
  const previous = table(db, CYCLE_LOGS).find((row) => row.entry_date === date);
  return saveRecord(
    db,
    CYCLE_LOGS,
    {
      ...(previous ? {} : { product_usage: {}, unusual_discharge: [] }),
      ...changes,
      entry_date: date,
    },
    previous?.id
  );
}

/**
 * Cycles follow the logged bleeding: after any change to the logs the derived
 * cycles are worked out again, keeping the id and the excluded flag of a
 * cycle that still starts on the same day. Cycles entered by hand stay as
 * they are.
 */
function rebuildCycles(db: LocalDatabase) {
  const derived = deriveCycles(
    table(db, CYCLE_LOGS).map((row) => ({
      date: String(row.entry_date),
      flow_level: row.flow_level as SharedCycleDailyLog['flow_level'],
      product_usage: row.product_usage as Record<string, number> | null,
    }))
  );
  const previous = new Map(
    table(db, CYCLES)
      .filter((row) => row.source !== 'manual')
      .map((row) => [String(row.start_date), row])
  );
  for (const cycle of derived) {
    const kept = previous.get(cycle.start_date);
    previous.delete(cycle.start_date);
    saveRecord(
      db,
      CYCLES,
      { is_excluded: false, ...kept, ...cycle, source: 'derived' },
      kept?.id
    );
  }
  for (const stale of previous.values()) deleteRecord(db, CYCLES, stale.id);
}

/** Every cycle, oldest first; the excluded ones only when asked for. */
function cycles(db: LocalDatabase, includeExcluded = false): DerivedCycle[] {
  return (table(db, CYCLES) as unknown as (DerivedCycle & LocalRecord)[])
    .filter((row) => includeExcluded || !row.is_excluded)
    .sort((a, b) => compareDays(a.start_date, b.start_date));
}

function predict(db: LocalDatabase) {
  const settings = settingsOf(db);
  const history = cycles(db);
  const stats = computeCycleStats(history);
  const last = history[history.length - 1];
  const prediction: CyclePrediction = last
    ? predictNextCycles(stats, last.start_date, settings)
    : { cycles: [], basis: 'settings', confidence: 'low' };
  return { settings, history, stats, prediction };
}

function overview(db: LocalDatabase, date: string) {
  const { settings, history, stats, prediction } = predict(db);
  const { phase, cycleDay } = phaseForDay(date, history, prediction);
  const current = history.filter((c) => compareDays(c.start_date, date) <= 0);
  return {
    settings: settingsRow(db) ? settings : null,
    date,
    phase,
    cycleDay,
    currentCycleStart: current[current.length - 1]?.start_date ?? null,
    prediction,
    stats,
    log: logs(db).find((row) => row.entry_date === date) ?? null,
    late: latePeriodStatus(date, prediction),
    insightKey: selectDailyInsight(date, phase, settings),
  };
}

function fertility(db: LocalDatabase, date: string) {
  const { settings, history, prediction } = predict(db);
  const current = history[history.length - 1];
  const ovulationDate = current
    ? estimateOvulation(current, logs(db), table(db, CYCLE_TESTS) as never, settings)
        .date
    : (prediction.cycles[0]?.ovulation ?? null);
  const fertileWindow: string[] = [];
  if (ovulationDate)
    for (
      let day = addDays(ovulationDate, -CYCLE_DEFAULTS.fertileBefore);
      compareDays(day, addDays(ovulationDate, CYCLE_DEFAULTS.fertileAfter)) <= 0;
      day = addDays(day, 1)
    )
      fertileWindow.push(day);
  const next = prediction.cycles[0]?.periodStart;
  return {
    fertileWindow,
    ovulationDate,
    daysUntilNextPeriod: next ? Math.max(0, daysBetween(date, next)) : 0,
  };
}

function insights(db: LocalDatabase) {
  const { settings, history, stats, prediction } = predict(db);
  const dayLogs = logs(db);
  const matrix = symptomPhaseMatrix(
    table(db, SYMPTOM_ENTRIES) as never,
    history
  );
  return {
    stats,
    accuracy: predictionAccuracy(history).avgError,
    matrix,
    forecast: forecastSymptoms(matrix, prediction),
    anomalies: detectAnomalies(history, dayLogs, settings),
    productStats: productStats(history, dayLogs),
    bbtSeries: dayLogs
      .filter((row) => row.bbt != null)
      .map((row) => ({ date: row.entry_date, bbt: row.bbt as number })),
    cycles: cycles(db, true).reverse(),
  };
}

/** Weight from the check-ins and energy from the logs, read against phase. */
function correlations(db: LocalDatabase) {
  const { history, stats, prediction } = predict(db);
  const weight = localMeasurements(db)
    .filter((row) => row.weight != null)
    .map((row) => ({ date: String(row.entry_date), value: Number(row.weight) }));
  const energy = logs(db)
    .filter((row) => row.energy != null)
    .map((row) => ({ date: row.entry_date, value: Number(row.energy) }));
  return {
    correlations: [
      correlateMetricWithPhase('weight', weight, history, prediction),
      correlateMetricWithPhase('energy', energy, history, prediction),
    ],
    conditionFlags: detectConditionFlags(history, stats),
    stats,
  };
}

const inRange = (query: URLSearchParams, from: string, to: string) => {
  const start = query.get(from);
  const end = query.get(to);
  return (row: LocalRecord) =>
    (!start || String(row.entry_date) >= start) &&
    (!end || String(row.entry_date) <= end);
};

function symptomRepository(
  db: LocalDatabase,
  { path, method, body, query }: LocalRequest
): LocalResult | undefined {
  const id = decodeURIComponent(path.slice(SYMPTOM_BASE.length + 1));
  if (method === 'GET' && !id)
    return {
      value: table(db, SYMPTOM_ENTRIES)
        .filter(inRange(query, 'fromDate', 'toDate'))
        .sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date))),
    };
  if (method === 'POST' && !id)
    return {
      value: saveRecord(db, SYMPTOM_ENTRIES, {
        source: 'manual',
        notes: null,
        logged_at: new Date().toISOString(),
        ...body,
      }),
    };
  if (method === 'DELETE' && id) {
    deleteRecord(db, SYMPTOM_ENTRIES, id);
    return { value: undefined };
  }
  return undefined;
}

/**
 * Cycle tracking on the device, under the same `/api/v2/cycle` contract the
 * screens call. What a server worked out — the overview, predictions,
 * fertility, insights and correlations — is computed here from the stored
 * logs with the shared cycle helpers. Symptom entries live alongside, since
 * the insights read them.
 */
export function cycleRepository(
  db: LocalDatabase,
  request: LocalRequest
): LocalResult | undefined {
  const { path, method, body, query } = request;
  if (path === SYMPTOM_BASE || path.startsWith(`${SYMPTOM_BASE}/`))
    return symptomRepository(db, request);
  if (!path.startsWith(`${CYCLE_BASE}/`)) return undefined;
  const [resource, rawId] = path.slice(CYCLE_BASE.length + 1).split('/');
  const id = rawId === undefined ? undefined : decodeURIComponent(rawId);
  const date = query.get('date') ?? getTodayDate();

  switch (resource) {
    case 'settings':
      if (method === 'GET') return { value: settingsRow(db) ? settingsOf(db) : null };
      if (method === 'PUT') return { value: saveSettings(db, body) };
      return undefined;
    case 'overview':
      return method === 'GET' ? { value: overview(db, date) } : undefined;
    case 'fertility':
      return method === 'GET' ? { value: fertility(db, date) } : undefined;
    case 'insights':
      return method === 'GET' ? { value: insights(db) } : undefined;
    case 'correlations':
      return method === 'GET' ? { value: correlations(db) } : undefined;
    case 'export':
      return method === 'GET'
        ? {
            value: {
              settings: settingsRow(db) ?? null,
              logs: logs(db),
              cycles: cycles(db, true),
              tests: table(db, CYCLE_TESTS),
              symptoms: table(db, SYMPTOM_ENTRIES),
            },
          }
        : undefined;
    case 'logs': {
      if (method === 'GET' && !id)
        return {
          value: logs(db).filter(
            inRange(query, 'startDate', 'endDate') as never
          ),
        };
      if (method === 'GET' && id)
        return { value: logs(db).find((row) => row.entry_date === id) ?? null };
      if (method === 'PUT' && id) {
        const saved = upsertLog(db, id, body);
        rebuildCycles(db);
        return { value: saved };
      }
      if (method === 'PUT' && !id) {
        // The onboarding's past periods, as `{date, flow_level}` pairs.
        const items = Array.isArray(body.items) ? body.items : [];
        for (const item of items as LocalRecord[])
          upsertLog(db, String(item.date), { flow_level: item.flow_level });
        rebuildCycles(db);
        return { value: overview(db, getTodayDate()) };
      }
      if (method === 'DELETE' && id) {
        const row = table(db, CYCLE_LOGS).find((item) => item.entry_date === id);
        if (row) deleteRecord(db, CYCLE_LOGS, row.id);
        rebuildCycles(db);
        return { value: undefined };
      }
      return undefined;
    }
    case 'cycles': {
      if (method === 'GET' && !id) {
        const limit = Number(query.get('limit')) || undefined;
        return {
          value: (cycles(db, true).reverse() as unknown[]).slice(0, limit),
        };
      }
      if (method === 'POST' && !id)
        return {
          value: saveRecord(db, CYCLES, {
            end_date: null,
            period_length: null,
            cycle_length: null,
            is_excluded: false,
            ...body,
            source: 'manual',
          }),
        };
      if (method === 'PUT' && id) return { value: saveRecord(db, CYCLES, body, id) };
      if (method === 'DELETE' && id) {
        findRecord(db, CYCLES, id);
        deleteRecord(db, CYCLES, id);
        return { value: undefined };
      }
      return undefined;
    }
    case 'tests': {
      if (method === 'GET' && !id)
        return {
          value: table(db, CYCLE_TESTS)
            .filter(inRange(query, 'startDate', 'endDate'))
            .sort((a, b) => String(b.tested_at).localeCompare(String(a.tested_at))),
        };
      if (method === 'POST' && !id)
        return {
          value: saveRecord(db, CYCLE_TESTS, {
            notes: null,
            tested_at: new Date().toISOString(),
            ...body,
          }),
        };
      if (method === 'DELETE' && id) {
        deleteRecord(db, CYCLE_TESTS, id);
        return { value: undefined };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}
