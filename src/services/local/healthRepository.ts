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
    const existing = table(db, 'healthRecords').find(
      (row) => row.health_key === key
    );
    saveRecord(
      db,
      'healthRecords',
      { ...record, entry_date: date, health_key: key },
      existing?.id
    );
    const upsert = (name: string, body: LocalRecord) => {
      const previous = table(db, name).find((row) => row.health_key === key);
      return saveRecord(
        db,
        name,
        { ...body, source, health_key: key, entry_date: date },
        previous?.id
      );
    };
    if (
      record.type === 'ExerciseSession' ||
      record.type === 'Workout' ||
      record.type === 'Active Calories'
    ) {
      const active = record.type === 'Active Calories';
      const name = active
        ? 'Active Calories'
        : record.title || record.activityType || 'Health workout';
      let exercise = table(db, 'exercises').find(
        (row) => row.name === name && row.source === source
      );
      if (!exercise)
        exercise = saveRecord(db, 'exercises', {
          name,
          modality: 'duration',
          source,
        });
      const previous = table(db, 'activities').find(
        (row) => row.health_key === key
      );
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
      saveRecord(db, 'activities', { health_key: key }, saved.id);
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
      let category = table(db, 'measurementCategories').find(
        (row) => row.name === record.type
      );
      if (!category)
        category = saveRecord(db, 'measurementCategories', {
          name: record.type,
          measurement_type: record.unit || 'numeric',
          frequency: 'Daily',
          data_type: 'numeric',
        });
      upsert('customMeasurements', {
        category_id: category.id,
        value: String(record.value ?? ''),
        custom_categories: category,
      });
    }
  }
  // Daily active energy already includes the imported workouts. Keep only
  // the remainder in the synthetic entry; manual activities remain additive.
  for (const total of table(db, 'healthRecords').filter(
    (row) => row.type === 'Active Calories'
  )) {
    const activity = table(db, 'activities').find(
      (row) => row.health_key === total.health_key
    );
    if (!activity) continue;
    const workoutCalories = table(db, 'healthRecords')
      .filter(
        (row) =>
          (row.type === 'ExerciseSession' || row.type === 'Workout') &&
          row.source === total.source &&
          row.entry_date === total.entry_date
      )
      .reduce((sum, row) => sum + Number(row.caloriesBurned ?? 0), 0);
    activity.calories_burned = Math.max(
      0,
      Number(total.value ?? 0) - workoutCalories
    );
  }
  return { recordsSent: records.length, recordErrors: [] };
}

export function importedWater(db: LocalDatabase, date: unknown): number {
  return table(db, 'healthRecords')
    .filter((row) => row.type === 'water' && row.entry_date === date)
    .reduce((sum, row) => sum + Number(row.value ?? 0), 0);
}

export function localMeasurements(db: LocalDatabase): LocalRecord[] {
  const days = new Map(
    table(db, 'measurements').map((row) => [String(row.entry_date), { ...row }])
  );
  for (const record of table(db, 'healthRecords')
    .slice()
    .sort((a, b) =>
      String(a.timestamp || a.date).localeCompare(String(b.timestamp || b.date))
    )) {
    const field = measurementFields[String(record.type)];
    if (!field) continue;
    const date = String(record.entry_date);
    const row = days.get(date) || {
      id: record.id,
      user_id: db.userId,
      entry_date: date,
    };
    // Steps are additive with manually entered steps, but repeated imports replace the source total.
    if (field === 'steps')
      row.steps = Number(row.steps ?? 0) + Number(record.value ?? 0);
    else if (
      table(db, 'measurements').find((manual) => manual.entry_date === date)?.[
        field
      ] == null
    )
      row[field] = record.value;
    days.set(date, row);
  }
  return [...days.values()];
}
