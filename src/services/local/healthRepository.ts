import {
  instantToDay,
  instantToDayWithOffset,
  isDayString,
} from '@workspace/shared';
import type {
  HealthDataPayloadItem,
  HealthDataSyncSummary,
} from '../api/healthDataApi';
import {
  asRecords,
  newId,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import { workoutRepository } from './workoutRepository';

/**
 * Apple's own exercise-minutes record, which is a daily total rather than a
 * session. It is keyed per day like Active Calories is, so a re-sync replaces
 * the day's figure instead of stacking another copy on top of it.
 */
export const APPLE_EXERCISE_TIME = 'apple_exercise_time';

/**
 * The daily active-energy total, under every name a reader gives it.
 *
 * Android's Health Connect transform emits 'Active Calories'; the iOS
 * statistics aggregator emits 'active_calories'. Only the first was recognised
 * here, so on iOS the Move ring's own source fell through to the custom
 * measurement branch and the ring read 0 — while the Apple Health screen,
 * which queries HealthKit directly, showed the number the whole time.
 */
const ACTIVE_ENERGY_TYPES = new Set(['Active Calories', 'active_calories']);

/** The name the rest of this importer, and every stored row, goes by. */
const ACTIVE_ENERGY = 'Active Calories';
/** The exercise this import files those minutes under. */
export const APPLE_EXERCISE_TIME_NAME = 'Apple Exercise Time';

/**
 * Record types HealthKit answers with many small samples that mean nothing
 * apart, and that this importer stores once per day.
 *
 * Apple exercise time arrives as a stream of short samples across the day —
 * the Health app adds them up to get the ring's minutes. Stored under a
 * per-day identity key without this, each sample overwrote the one before it
 * and the day ended up holding whichever happened to land last: a couple of
 * minutes where Apple showed twenty.
 */
const SUMMED_PER_DAY = new Set([APPLE_EXERCISE_TIME]);

/**
 * Collapses those samples to one record per source and day, carrying the sum.
 *
 * The first sample of each day keeps its place in the batch and takes the
 * total; the rest drop out. Re-syncing a day therefore replaces its figure
 * rather than adding to it, which is what the per-day key was always for.
 */
function sumDailyTotals(
  db: LocalDatabase,
  records: readonly LocalRecord[]
): LocalRecord[] {
  const firstOfDay = new Map<string, LocalRecord>();
  const collapsed: LocalRecord[] = [];
  for (const record of records) {
    if (typeof record.type !== 'string' || !SUMMED_PER_DAY.has(record.type)) {
      collapsed.push(record);
      continue;
    }
    const item = record as HealthDataPayloadItem;
    const key = `${item.source || 'Health'}|${recordDate(db, item)}|${item.type}`;
    const running = firstOfDay.get(key);
    if (running) {
      running.value = Number(running.value ?? 0) + Number(record.value ?? 0);
      continue;
    }
    // Copied rather than mutated in place: the caller's payload is not ours to
    // rewrite, and the running total below does exactly that.
    const seed = { ...record, value: Number(record.value ?? 0) };
    firstOfDay.set(key, seed);
    collapsed.push(seed);
  }
  return collapsed;
}

const measurementFields: Record<string, string> = {
  step: 'steps',
  // Metres, as both providers aggregate it: one record per day, so the merge
  // below replaces the day's figure rather than accumulating it the way steps
  // do. Stored raw and converted at the edge, like every other metric here.
  distance: 'distance_m',
  weight: 'weight',
  height: 'height',
  body_fat: 'body_fat_percentage',
  lean_body_mass: 'muscle_mass_kg',
  bone_mass: 'bone_mass_kg',
  basal_metabolic_rate: 'bmr',
};

function recordDate(db: LocalDatabase, record: HealthDataPayloadItem): string {
  const basis =
    (record.type === 'SleepSession' ? record.wake_time : undefined) ||
    record.timestamp ||
    record.date ||
    record.entry_date ||
    record.startTime;
  if (!basis) throw new Error('Health record has no date.');
  if (isDayString(basis)) return basis;
  const instant = new Date(basis);
  if (!Number.isFinite(instant.getTime()))
    throw new Error('Invalid health record date.');
  if (
    !record.record_timezone &&
    typeof record.record_utc_offset_minutes === 'number'
  ) {
    return instantToDayWithOffset(instant, record.record_utc_offset_minutes);
  }
  return instantToDay(
    instant,
    record.record_timezone ||
      String(
        table(db, 'preferences')[0]?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone
      )
  );
}

/** Stable source keys replace imported values; manual records are never overwritten. */
export function importHealthData(
  db: LocalDatabase,
  payload: unknown
): HealthDataSyncSummary {
  const records = asRecords(payload);

  // Every lookup below used to scan a table that grows with each sync, so an
  // import cost time proportional to (records arriving x records already
  // stored) and got slower every time it ran. These indexes are built once and
  // kept in step with what the loop writes. First match wins, as `find` did.
  const healthKeyIndexes = new Map<string, Map<string, LocalRecord>>();
  const byHealthKey = (name: string): Map<string, LocalRecord> => {
    let index = healthKeyIndexes.get(name);
    if (!index) {
      index = new Map();
      for (const row of table(db, name)) {
        const value = row.health_key;
        if (value != null && !index.has(String(value)))
          index.set(String(value), row);
      }
      healthKeyIndexes.set(name, index);
    }
    return index;
  };
  const saveByHealthKey = (
    name: string,
    key: string,
    body: LocalRecord
  ): LocalRecord => {
    const index = byHealthKey(name);
    const row = saveRecord(db, name, body, index.get(key)?.id);
    index.set(key, row);
    return row;
  };

  const exerciseKey = (name: unknown, source: unknown) =>
    `${String(name)}\u0000${String(source)}`;
  const exercisesByNameAndSource = new Map<string, LocalRecord>();
  for (const row of table(db, 'exercises')) {
    const composite = exerciseKey(row.name, row.source);
    if (!exercisesByNameAndSource.has(composite))
      exercisesByNameAndSource.set(composite, row);
  }
  const categoriesByName = new Map<string, LocalRecord>();
  for (const row of table(db, 'measurementCategories'))
    if (!categoriesByName.has(String(row.name)))
      categoriesByName.set(String(row.name), row);

  /**
   * `source|entry_date` for every day this batch put exercise or active-energy
   * data into. Only those days can have changed, and the reconciliation at the
   * end is limited to them.
   */
  const touchedDays = new Set<string>();

  for (const raw of sumDailyTotals(db, records)) {
    if (typeof raw.type !== 'string')
      throw new Error('Health record has no type.');
    const record = raw as HealthDataPayloadItem;
    // Canonicalised once, so the branch below, the per-day identity key and
    // the reconciliation pass all agree on what an active-energy row is.
    if (ACTIVE_ENERGY_TYPES.has(record.type)) record.type = ACTIVE_ENERGY;
    if (
      record.value !== undefined &&
      (typeof record.value !== 'number' || !Number.isFinite(record.value))
    ) {
      throw new Error('Invalid health record value.');
    }
    const date = recordDate(db, record);
    const source = record.source || 'Health';
    const key = JSON.stringify([
      source,
      record.type,
      record.type === 'step' ||
      record.type === 'Active Calories' ||
      record.type === APPLE_EXERCISE_TIME
        ? date
        : record.source_id || record.timestamp || date,
    ]);
    saveByHealthKey('healthRecords', key, {
      ...record,
      entry_date: date,
      health_key: key,
    });
    const upsert = (name: string, body: LocalRecord) =>
      saveByHealthKey(name, key, {
        ...body,
        source,
        health_key: key,
        entry_date: date,
      });
    if (
      record.type === 'ExerciseSession' ||
      record.type === 'Workout' ||
      record.type === 'Active Calories' ||
      record.type === APPLE_EXERCISE_TIME
    ) {
      const active = record.type === 'Active Calories';
      const exerciseTime = record.type === APPLE_EXERCISE_TIME;
      const name = active
        ? 'Active Calories'
        : exerciseTime
          ? APPLE_EXERCISE_TIME_NAME
          : record.title || record.activityType || 'Health workout';
      touchedDays.add(`${source}|${date}`);
      let exercise = exercisesByNameAndSource.get(exerciseKey(name, source));
      if (!exercise) {
        exercise = saveRecord(db, 'exercises', {
          name,
          modality: 'duration',
          source,
        });
        exercisesByNameAndSource.set(exerciseKey(name, source), exercise);
      }
      const previous = byHealthKey('activities').get(key);
      const result = workoutRepository(db, {
        path: `/api/exercise-entries${previous ? `/${String(previous.id)}` : ''}`,
        query: new URLSearchParams(),
        method: previous ? 'PUT' : 'POST',
        body: {
          exercise_id: exercise.id,
          entry_date: date,
          source,
          // Apple reports exercise time in seconds against the day, with no
          // calories of its own — the energy is already in Active Calories.
          duration_minutes: exerciseTime
            ? Number(record.value ?? 0) / 60
            : active
              ? 0
              : Number(record.duration ?? 0) / 60,
          calories_burned: exerciseTime
            ? 0
            : Number(
                active ? (record.value ?? 0) : (record.caloriesBurned ?? 0)
              ),
          distance: record.distance ?? null,
          notes: record.notes ?? null,
          sets: asRecords(record.sets).map(({ duration_seconds, ...set }) => ({
            ...set,
            duration: duration_seconds ?? set.duration ?? null,
          })),
          activity_details: [
            {
              id: newId(),
              provider_name: source,
              detail_type: 'health_import',
              detail_data: record,
            },
          ],
        },
      });
      const saved = result?.value as LocalRecord;
      const activity = saveRecord(
        db,
        'activities',
        { health_key: key },
        saved.id
      );
      byHealthKey('activities').set(key, activity);
    } else if (record.type === 'Nutrition') {
      const meal =
        table(db, 'mealTypes').find(
          (row) =>
            String(row.name).toLowerCase() ===
            String(record.meal_type).toLowerCase()
        ) || table(db, 'mealTypes')[0];
      upsert('entries', {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        ...record,
        quantity: 1,
        serving_size: 1,
        unit: 'serving',
        serving_unit: 'serving',
        meal_type_id: meal.id,
        meal_type: meal.name,
      });
    } else if (record.type === 'SleepSession') {
      upsert('sleep', {
        time_asleep_in_seconds: null,
        sleep_score: null,
        deep_sleep_seconds: null,
        light_sleep_seconds: null,
        rem_sleep_seconds: null,
        awake_sleep_seconds: null,
        average_spo2_value: null,
        lowest_spo2_value: null,
        highest_spo2_value: null,
        resting_heart_rate: null,
        record_timezone: null,
        record_utc_offset_minutes: null,
        stage_events: [],
        ...record,
      });
    } else if (!measurementFields[record.type] && record.type !== 'water') {
      let category = categoriesByName.get(String(record.type));
      if (!category) {
        category = saveRecord(db, 'measurementCategories', {
          name: record.type,
          measurement_type: record.unit || 'numeric',
          frequency: 'Daily',
          data_type: 'numeric',
        });
        categoriesByName.set(String(record.type), category);
      }
      upsert('customMeasurements', {
        category_id: category.id,
        value: String(record.value ?? ''),
        custom_categories: category,
      });
    }
  }
  // Daily active energy already includes the imported workouts. Keep only
  // the remainder in the synthetic entry; manual activities remain additive.
  //
  // Limited to the days this batch touched, and to one pass over the health
  // records. It used to re-derive every "Active Calories" row ever imported,
  // rescanning the whole activities and health-record tables for each one, on
  // every sync — including the one that runs each time the app is opened. Only
  // a touched day can have changed, so the rest was pure repetition.
  const workoutCaloriesByDay = new Map<string, number>();
  const workoutMinutesByDay = new Map<string, number>();
  const activeEnergyTotals: LocalRecord[] = [];
  const exerciseTimeTotals: LocalRecord[] = [];
  for (const row of table(db, 'healthRecords')) {
    const day = `${String(row.source)}|${String(row.entry_date)}`;
    if (!touchedDays.has(day)) continue;
    if (row.type === 'Active Calories') {
      activeEnergyTotals.push(row);
    } else if (row.type === APPLE_EXERCISE_TIME) {
      exerciseTimeTotals.push(row);
    } else if (row.type === 'ExerciseSession' || row.type === 'Workout') {
      workoutCaloriesByDay.set(
        day,
        (workoutCaloriesByDay.get(day) ?? 0) + Number(row.caloriesBurned ?? 0)
      );
      workoutMinutesByDay.set(
        day,
        (workoutMinutesByDay.get(day) ?? 0) + Number(row.duration ?? 0) / 60
      );
    }
  }
  for (const total of activeEnergyTotals) {
    const activity = byHealthKey('activities').get(String(total.health_key));
    if (!activity) continue;
    const day = `${String(total.source)}|${String(total.entry_date)}`;
    activity.calories_burned = Math.max(
      0,
      Number(total.value ?? 0) - (workoutCaloriesByDay.get(day) ?? 0)
    );
  }
  // Apple's exercise minutes count the imported workouts too, so the same
  // carve-out applies: the day's figure stays Apple's own, and a workout Apple
  // never saw still adds its minutes on top.
  for (const total of exerciseTimeTotals) {
    const activity = byHealthKey('activities').get(String(total.health_key));
    if (!activity) continue;
    const day = `${String(total.source)}|${String(total.entry_date)}`;
    activity.duration_minutes = Math.max(
      0,
      Number(total.value ?? 0) / 60 - (workoutMinutesByDay.get(day) ?? 0)
    );
  }
  return { recordsSent: records.length, recordErrors: [] };
}

export function importedWater(db: LocalDatabase, date: unknown): number {
  return table(db, 'healthRecords')
    .filter((row) => row.type === 'water' && row.entry_date === date)
    .reduce((sum, row) => sum + Number(row.value ?? 0), 0);
}

/**
 * Manual check-ins merged with the health records imported behind them.
 *
 * `range` is pushed down here rather than applied by the caller: without it
 * this copies, sorts and folds every health record the user has ever synced,
 * and the diary, the dashboard and the ring calendar all call it. Omit it only
 * when every day really is wanted.
 */
export function localMeasurements(
  db: LocalDatabase,
  range?: { start: string; end: string }
): LocalRecord[] {
  const inRange = (day: string) =>
    !range || (day >= range.start && day <= range.end);

  // Two views of the same rows, because the original held two: the merge target
  // takes the last row for a date, while the "did the user enter this by hand"
  // guard below took the first. Duplicate dates should not exist — the check-in
  // route upserts on the date — so in practice they are the same row.
  const days = new Map<string, LocalRecord>();
  const firstManualByDay = new Map<string, LocalRecord>();
  for (const row of table(db, 'measurements')) {
    const date = String(row.entry_date);
    if (!firstManualByDay.has(date)) firstManualByDay.set(date, row);
    if (inRange(date)) days.set(date, { ...row });
  }

  const imported = table(db, 'healthRecords').filter(
    (row) =>
      measurementFields[String(row.type)] !== undefined &&
      inRange(String(row.entry_date))
  );
  imported.sort((a, b) =>
    String(a.timestamp || a.date).localeCompare(String(b.timestamp || b.date))
  );
  for (const record of imported) {
    const field = measurementFields[String(record.type)];
    const date = String(record.entry_date);
    const row = days.get(date) || {
      id: record.id,
      user_id: db.userId,
      entry_date: date,
    };
    // Steps are additive with manually entered steps, but repeated imports replace the source total.
    if (field === 'steps')
      row.steps = Number(row.steps ?? 0) + Number(record.value ?? 0);
    else if (firstManualByDay.get(date)?.[field] == null)
      row[field] = record.value;
    days.set(date, row);
  }
  return [...days.values()];
}
