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

const measurementFields: Record<string, string> = {
  step: 'steps',
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

  for (const raw of records) {
    if (typeof raw.type !== 'string')
      throw new Error('Health record has no type.');
    const record = raw as HealthDataPayloadItem;
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
      record.type === 'step' || record.type === 'Active Calories'
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
      record.type === 'Active Calories'
    ) {
      const active = record.type === 'Active Calories';
      const name = active
        ? 'Active Calories'
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
          duration_minutes: active ? 0 : Number(record.duration ?? 0) / 60,
          calories_burned: Number(
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
  const activeEnergyTotals: LocalRecord[] = [];
  for (const row of table(db, 'healthRecords')) {
    const day = `${String(row.source)}|${String(row.entry_date)}`;
    if (!touchedDays.has(day)) continue;
    if (row.type === 'Active Calories') {
      activeEnergyTotals.push(row);
    } else if (row.type === 'ExerciseSession' || row.type === 'Workout') {
      workoutCaloriesByDay.set(
        day,
        (workoutCaloriesByDay.get(day) ?? 0) + Number(row.caloriesBurned ?? 0)
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
