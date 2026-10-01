import {
  deleteRecord,
  findRecord,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import type { LocalRequest, LocalResult } from './request';

const BASE = '/api/v2/medications';
export const MEDICATIONS = 'medications';
export const MEDICATION_SCHEDULES = 'medicationSchedules';
export const MEDICATION_ENTRIES = 'medicationEntries';

// What the server fills in on create, so a row saved here has every field the
// shared contract (`@workspace/shared` medications) marks as present.
const MEDICATION_DEFAULTS: LocalRecord = {
  display_name: null,
  type_id: null,
  route_id: null,
  strength_value: null,
  strength_unit: null,
  dose_amount: null,
  dose_unit: null,
  reason_text: null,
  effectiveness_rating: null,
  color: null,
  icon: null,
  photo_path: null,
  is_active: true,
  is_quick: false,
  is_glp1: false,
  notes: null,
  source: 'manual',
  custom_fields: {},
};
const SCHEDULE_DEFAULTS: LocalRecord = {
  time_of_day: null,
  dose_amount: null,
  days_of_week: null,
  interval_days: null,
  day_of_month: null,
  cycle_on_days: null,
  cycle_off_days: null,
  prn_reason: null,
  prn_max_per_day: null,
  with_meal: null,
  start_date: null,
  end_date: null,
  active: true,
  source: 'manual',
  custom_fields: {},
};

const withSchedules = (db: LocalDatabase, medication: LocalRecord) => ({
  ...medication,
  schedules: table(db, MEDICATION_SCHEDULES)
    .filter((row) => String(row.medication_id) === String(medication.id))
    .sort((a, b) =>
      String(a.time_of_day ?? '').localeCompare(String(b.time_of_day ?? ''))
    ),
});

/**
 * A dose as the server records it: taken now unless said otherwise, dated by
 * when it was taken, and carrying the medication's name and dose as they
 * were, so renaming the medication later does not rewrite its history.
 */
function newEntry(db: LocalDatabase, body: LocalRecord): LocalRecord {
  const medication = findRecord(db, MEDICATIONS, body.medication_id);
  const schedule =
    body.schedule_id == null
      ? undefined
      : table(db, MEDICATION_SCHEDULES).find(
          (row) => String(row.id) === String(body.schedule_id)
        );
  const takenAt = String(body.taken_at ?? new Date().toISOString());
  return {
    schedule_id: null,
    status: 'taken',
    scheduled_for: null,
    entry_date: takenAt.slice(0, 10),
    med_name_snapshot: medication.display_name ?? medication.name ?? null,
    dose_amount_snapshot:
      schedule?.dose_amount ?? medication.dose_amount ?? null,
    dose_unit_snapshot: medication.dose_unit ?? null,
    notes: null,
    source: 'manual',
    custom_fields: {},
    ...body,
    taken_at: takenAt,
  };
}

function listEntries(db: LocalDatabase, query: URLSearchParams) {
  const from = query.get('fromDate');
  const to = query.get('toDate');
  const medicationId = query.get('medicationId');
  return table(db, MEDICATION_ENTRIES)
    .filter(
      (row) =>
        (!from || String(row.entry_date) >= from) &&
        (!to || String(row.entry_date) <= to) &&
        (!medicationId || String(row.medication_id) === medicationId)
    )
    .sort((a, b) => String(b.taken_at).localeCompare(String(a.taken_at)));
}

/**
 * Medications, their schedules and the doses logged against them, kept on the
 * device under the same `/api/v2/medications` contract the screens call.
 * `entries` and `schedules` sit where a medication id would, so they are
 * matched first.
 */
export function medicationRepository(
  db: LocalDatabase,
  { path, method, body, query }: LocalRequest
): LocalResult | undefined {
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return undefined;
  const [first, second, third] = path
    .slice(BASE.length + 1)
    .split('/')
    .map(decodeURIComponent);

  if (first === 'entries') {
    if (method === 'GET' && !second) return { value: listEntries(db, query) };
    if (method === 'POST' && !second)
      return {
        value: saveRecord(db, MEDICATION_ENTRIES, newEntry(db, body)),
      };
    if (method === 'PUT' && second)
      return { value: saveRecord(db, MEDICATION_ENTRIES, body, second) };
    if (method === 'DELETE' && second) {
      deleteRecord(db, MEDICATION_ENTRIES, second);
      return { value: undefined };
    }
    return undefined;
  }

  if (first === 'schedules' && second) {
    if (method === 'PUT')
      return { value: saveRecord(db, MEDICATION_SCHEDULES, body, second) };
    if (method === 'DELETE') {
      deleteRecord(db, MEDICATION_SCHEDULES, second);
      return { value: undefined };
    }
    return undefined;
  }

  if (!first) {
    if (method === 'GET') {
      const activeOnly = query.get('activeOnly') === 'true';
      return {
        value: table(db, MEDICATIONS)
          .filter((row) => !activeOnly || row.is_active !== false)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .map((row) => withSchedules(db, row)),
      };
    }
    if (method === 'POST')
      return {
        value: saveRecord(db, MEDICATIONS, { ...MEDICATION_DEFAULTS, ...body }),
      };
    return undefined;
  }

  if (second === 'schedules' && !third && method === 'POST') {
    findRecord(db, MEDICATIONS, first);
    return {
      value: saveRecord(db, MEDICATION_SCHEDULES, {
        ...SCHEDULE_DEFAULTS,
        ...body,
        medication_id: first,
      }),
    };
  }
  if (second) return undefined;

  if (method === 'GET')
    return { value: withSchedules(db, findRecord(db, MEDICATIONS, first)) };
  if (method === 'PUT') {
    const { schedules: _schedules, ...changes } = body;
    return { value: saveRecord(db, MEDICATIONS, changes, first) };
  }
  if (method === 'DELETE') {
    deleteRecord(db, MEDICATIONS, first);
    // A deleted medication takes its schedules and dose history with it, as
    // the server's foreign keys do.
    for (const name of [MEDICATION_SCHEDULES, MEDICATION_ENTRIES]) {
      const rows = table(db, name);
      for (const row of rows.filter(
        (item) => String(item.medication_id) === first
      ))
        deleteRecord(db, name, row.id);
    }
    return { value: undefined };
  }
  return undefined;
}
