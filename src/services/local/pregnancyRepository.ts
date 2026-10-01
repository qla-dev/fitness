import {
  addDays,
  babyWeek,
  checklistForWeek,
  compareDays,
  gestationalAge,
  weightGainRange,
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
import { MEDICATIONS, MEDICATION_ENTRIES } from './medicationRepository';
import { getTodayDate } from '../../utils/dateUtils';

const BASE = '/api/v2/pregnancy';
export const PREGNANCIES = 'pregnancies';
export const PREGNANCY_CHECKLIST = 'pregnancyChecklist';
export const PREGNANCY_PHOTOS = 'pregnancyPhotos';

const current = (db: LocalDatabase) =>
  table(db, PREGNANCIES)
    .filter((row) => row.status === 'active')
    .sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    )[0] ?? null;

/** The prenatal or supplement medication and whether it was taken today. */
function medicationStatus(db: LocalDatabase, id: unknown, date: string) {
  if (id == null) return null;
  const medication = table(db, MEDICATIONS).find(
    (row) => String(row.id) === String(id)
  );
  if (!medication) return null;
  const entry = table(db, MEDICATION_ENTRIES).find(
    (row) =>
      String(row.medication_id) === String(id) &&
      row.entry_date === date &&
      row.status !== 'skipped'
  );
  return {
    id: String(medication.id),
    name: (medication.display_name ?? medication.name ?? null) as string | null,
    entryId: entry ? String(entry.id) : null,
    loggedToday: !!entry,
  };
}

function vitals(db: LocalDatabase, pregnancy: LocalRecord, date: string, week: number) {
  const lmp = addDays(String(pregnancy.due_date), -280);
  const measurements = localMeasurements(db).sort((a, b) =>
    compareDays(String(a.entry_date), String(b.entry_date))
  );
  const latest = (field: string, until = date) =>
    measurements
      .filter((row) => row[field] != null && String(row.entry_date) <= until)
      .map((row) => Number(row[field]))
      .pop() ?? null;
  const latestWeight = latest('weight');
  // The last weight from before the pregnancy, or the first one logged in it.
  const prePregnancyWeight =
    latest('weight', addDays(lmp, -1)) ??
    (measurements.find((row) => row.weight != null)?.weight as number | undefined) ??
    null;
  const height = latest('height');
  const prePregnancyBmi =
    prePregnancyWeight && height
      ? Math.round((prePregnancyWeight / (height / 100) ** 2) * 10) / 10
      : null;
  const weightDelta =
    latestWeight != null && prePregnancyWeight != null
      ? Math.round((latestWeight - prePregnancyWeight) * 10) / 10
      : null;
  const gainRange =
    prePregnancyBmi != null
      ? weightGainRange(prePregnancyBmi, week, Number(pregnancy.fetus_count) || 1)
      : null;
  return {
    latestWeight,
    prePregnancyWeight,
    height,
    prePregnancyBmi,
    weightDelta,
    weightGainStatus:
      gainRange && weightDelta != null
        ? weightDelta < gainRange.lowKg
          ? ('below_range' as const)
          : weightDelta > gainRange.highKg
            ? ('above_range' as const)
            : ('within_range' as const)
        : null,
    gainRange,
    bpValue: null,
    prenatalMedication: medicationStatus(db, pregnancy.prenatal_medication_id, date),
    supplementMedication: medicationStatus(db, pregnancy.supplement_medication_id, date),
  };
}

/**
 * This week's checklist: the templates due now, with what the user ticked or
 * dismissed, plus their own items for the week.
 */
function weekChecklist(db: LocalDatabase, pregnancyId: string, week: number) {
  const items = table(db, PREGNANCY_CHECKLIST).filter(
    (row) => String(row.pregnancy_id) === pregnancyId
  );
  const fromTemplates = checklistForWeek(week).map((template) => {
    const item = items.find((row) => row.template_key === template.key);
    return {
      id: item ? String(item.id) : null,
      template_key: template.key,
      title: template.title,
      week,
      completed: !!item?.completed_at,
      dismissed: !!item?.dismissed,
    };
  });
  const custom = items
    .filter((row) => !row.template_key && Number(row.week) === week)
    .map((row) => ({
      id: String(row.id),
      template_key: null,
      title: String(row.custom_title ?? ''),
      week,
      completed: !!row.completed_at,
      dismissed: !!row.dismissed,
    }));
  return [...fromTemplates, ...custom];
}

function overview(db: LocalDatabase, date: string) {
  const pregnancy = current(db);
  if (!pregnancy) return { pregnancy: null };
  const gestation = gestationalAge(String(pregnancy.due_date), date);
  const checklist = weekChecklist(db, String(pregnancy.id), gestation.week);
  const shown = checklist.filter((item) => !item.dismissed);
  return {
    pregnancy,
    date,
    gestation,
    baby: babyWeek(gestation.week),
    checklist,
    checklistProgress: {
      done: shown.filter((item) => item.completed).length,
      total: shown.length,
    },
    nextAppointment: null,
    recentKickSessions: [],
    vitals: vitals(db, pregnancy, date, gestation.week),
  };
}

/** Ticking takes `completed`; the stored item keeps when it was done. */
function upsertChecklistItem(db: LocalDatabase, body: LocalRecord) {
  const { completed, ...changes } = body;
  const previous =
    changes.id != null
      ? findRecord(db, PREGNANCY_CHECKLIST, changes.id)
      : table(db, PREGNANCY_CHECKLIST).find(
          (row) =>
            changes.template_key != null &&
            String(row.pregnancy_id) === String(changes.pregnancy_id) &&
            row.template_key === changes.template_key
        );
  return saveRecord(
    db,
    PREGNANCY_CHECKLIST,
    {
      ...(previous
        ? {}
        : { template_key: null, custom_title: null, week: null, dismissed: false }),
      ...changes,
      ...(completed === undefined
        ? null
        : {
            completed_at: completed
              ? (previous?.completed_at ?? new Date().toISOString())
              : null,
          }),
    },
    previous?.id
  );
}

/**
 * Pregnancies, their weekly checklist and bump-photo records on the device,
 * under the `/api/v2/pregnancy` contract the screens call. The overview a
 * server would assemble is built here from the shared pregnancy helpers, the
 * check-in measurements and the medications. Photo files themselves are kept
 * by `pregnancyPhotosApi`; these rows only point at them.
 */
export function pregnancyRepository(
  db: LocalDatabase,
  { path, method, body, query }: LocalRequest
): LocalResult | undefined {
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return undefined;
  const [first, second] = path
    .slice(BASE.length + 1)
    .split('/')
    .map(decodeURIComponent);

  if (first === 'current' && method === 'GET') return { value: current(db) };
  if (first === 'overview' && method === 'GET')
    return { value: overview(db, query.get('date') ?? getTodayDate()) };

  if (first === 'checklist') {
    if (method === 'GET')
      return {
        value: table(db, PREGNANCY_CHECKLIST).filter(
          (row) => String(row.pregnancy_id) === query.get('pregnancy_id')
        ),
      };
    if (method === 'PUT') return { value: upsertChecklistItem(db, body) };
    return undefined;
  }

  if (first === 'photos') {
    if (method === 'GET' && !second)
      return {
        value: table(db, PREGNANCY_PHOTOS)
          .filter((row) => String(row.pregnancy_id) === query.get('pregnancy_id'))
          .sort((a, b) => Number(a.week) - Number(b.week)),
      };
    if (method === 'POST' && !second)
      return {
        value: saveRecord(db, PREGNANCY_PHOTOS, {
          notes: null,
          entry_date: getTodayDate(),
          ...body,
          file_path: `${String(body.id)}.jpg`,
        }),
      };
    if (method === 'DELETE' && second) {
      deleteRecord(db, PREGNANCY_PHOTOS, second);
      return { value: undefined };
    }
    return undefined;
  }

  if (!first && method === 'POST')
    return {
      value: saveRecord(db, PREGNANCIES, {
        due_date_basis: 'manual',
        lmp_date: null,
        conception_date: null,
        fetus_count: 1,
        status: 'active',
        ended_on: null,
        outcome: null,
        prenatal_medication_id: null,
        supplement_medication_id: null,
        notes: null,
        ...body,
      }),
    };
  if (first && !second) {
    if (method === 'PUT') return { value: saveRecord(db, PREGNANCIES, body, first) };
    if (method === 'DELETE') {
      deleteRecord(db, PREGNANCIES, first);
      for (const name of [PREGNANCY_CHECKLIST, PREGNANCY_PHOTOS])
        for (const row of table(db, name).filter(
          (item) => String(item.pregnancy_id) === first
        ))
          deleteRecord(db, name, row.id);
      return { value: undefined };
    }
  }
  return undefined;
}
