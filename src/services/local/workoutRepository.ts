import {
  exerciseEntryResponseSchema,
  presetSessionResponseSchema,
  workoutPresetResponseSchema,
} from '@workspace/shared';
import {
  asRecords,
  deleteRecord,
  findRecord,
  newId,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import type { LocalRequest, LocalResult } from './request';

function presetWithImages(db: LocalDatabase, row: LocalRecord) {
  return workoutPresetResponseSchema.parse({
    ...row,
    exercises: asRecords(row.exercises).map((entry) => {
      const exercise = table(db, 'exercises').find(
        (candidate) => String(candidate.id) === String(entry.exercise_id)
      );
      const image = Array.isArray(exercise?.images)
        ? exercise.images.find(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0
          )
        : undefined;
      return { ...entry, image_url: image ?? entry.image_url ?? null };
    }),
  });
}

function sets(db: LocalDatabase, value: unknown) {
  return asRecords(value).map((set, index) => ({
    set_number: index + 1,
    set_type: null,
    reps: null,
    weight: null,
    duration: null,
    distance: null,
    rest_time: null,
    notes: null,
    rpe: null,
    completed_at: null,
    is_pr: false,
    ...set,
    id: typeof set.id === 'number' ? set.id : db.nextId++,
  }));
}

function exerciseEntry(
  db: LocalDatabase,
  body: LocalRecord,
  entryDate: unknown
): LocalRecord {
  const exercise = findRecord(db, 'exercises', body.exercise_id);
  return exerciseEntryResponseSchema.strip().parse({
    id: newId(),
    duration_minutes: 0,
    calories_burned: 0,
    notes: null,
    distance: null,
    avg_heart_rate: null,
    source: 'manual',
    superset_group: null,
    activity_details: [],
    ...body,
    entry_date: entryDate,
    exercise_snapshot: {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category ?? null,
      modality: exercise.modality,
      images: exercise.images ?? [],
      primary_muscles: exercise.primary_muscles ?? [],
      secondary_muscles: exercise.secondary_muscles ?? [],
      equipment: exercise.equipment ?? [],
      instructions: exercise.instructions ?? [],
      force: exercise.force ?? null,
      level: exercise.level ?? null,
      mechanic: exercise.mechanic ?? null,
      // Which provider this exercise came from, or null for one the user owns.
      // The day's totals need it: a workout imported from Apple Health is
      // already inside Apple's own exercise minutes, and one logged here is not.
      source: exercise.source ?? null,
      calories_per_hour: exercise.calories_per_hour ?? 0,
    },
    sets: sets(db, body.sets),
  });
}

/**
 * Sessions for one day, or for a range. Narrow first, parse second: every row
 * that survives the filter is validated through Zod and has its exercise name
 * looked up, so a caller that wants a month must say so rather than ask for
 * all time and discard the rest.
 */
export function localSessions(
  db: LocalDatabase,
  date?: string,
  range?: { start: string; end: string }
): LocalRecord[] {
  const keep = (row: LocalRecord): boolean => {
    const day = String(row.entry_date);
    if (date !== undefined && day !== date) return false;
    if (range && (day < range.start || day > range.end)) return false;
    return true;
  };
  // One pass over the exercises table instead of one scan per activity.
  const exercisesById = new Map(
    table(db, 'exercises').map((row) => [String(row.id), row])
  );
  const individual = table(db, 'activities')
    .filter(keep)
    .map((row) => ({
      ...exerciseEntryResponseSchema.strip().parse(row),
      type: 'individual',
      name: (
        exercisesById.get(String(row.exercise_id)) ??
        findRecord(db, 'exercises', row.exercise_id)
      ).name,
    }));
  const workouts = table(db, 'workouts')
    .filter(keep)
    .map((row) => presetSessionResponseSchema.strip().parse(row));
  return [...individual, ...workouts];
}

export function workoutRepository(
  db: LocalDatabase,
  request: LocalRequest
): LocalResult | undefined {
  const { path, query, method, body } = request;
  const parts = path.split('/');
  const id = parts[3];
  const search = (rows: LocalRecord[]) =>
    rows.filter((row) =>
      String(row.name)
        .toLowerCase()
        .includes((query.get('searchTerm') ?? '').toLowerCase())
    );
  const page = Math.max(1, Number(query.get('page')) || 1);
  const size = Math.max(
    1,
    Number(query.get('pageSize') ?? query.get('limit')) || 20
  );
  const paginate = (rows: LocalRecord[]) => ({
    page,
    pageSize: size,
    totalCount: rows.length,
    totalPages: Math.ceil(rows.length / size),
    hasMore: page * size < rows.length,
  });
  if (path === '/api/exercises/suggested')
    return {
      value: {
        recentExercises: table(db, 'exercises').slice(-10),
        topExercises: table(db, 'exercises').slice(0, 10),
      },
    };
  if (path === '/api/v2/exercises/search') {
    const rows = search(table(db, 'exercises'));
    return {
      value: {
        exercises: rows.slice((page - 1) * size, page * size),
        pagination: paginate(rows),
      },
    };
  }
  if (path === '/api/v2/exercise-entries/history') {
    const rows = localSessions(db)
      .filter(
        (row) =>
          !query.get('exerciseId') ||
          row.exercise_id === query.get('exerciseId') ||
          asRecords(row.exercises).some(
            (ex) => ex.exercise_id === query.get('exerciseId')
          )
      )
      .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)));
    return {
      value: {
        sessions: rows.slice((page - 1) * size, page * size),
        pagination: paginate(rows),
      },
    };
  }
  if (path.startsWith('/api/v2/exercises/') && path.endsWith('/stats'))
    return { value: { bestSet: null, lastSet: null, recentSessions: [] } };
  if (parts[2] === 'exercises') {
    if (method === 'GET') {
      if (id === 'search') return { value: search(table(db, 'exercises')) };
      if (!id)
        return {
          value: {
            exercises: table(db, 'exercises'),
            totalCount: table(db, 'exercises').length,
          },
        };
      return { value: findRecord(db, 'exercises', id) };
    }
    if (method === 'DELETE') {
      if (
        table(db, 'activities').some((row) => row.exercise_id === id) ||
        table(db, 'workouts').some((row) =>
          asRecords(row.exercises).some((ex) => ex.exercise_id === id)
        )
      )
        throw new Error(
          'An exercise used in a local workout cannot be deleted.'
        );
      deleteRecord(db, 'exercises', id);
      return { value: undefined };
    }
    return {
      value: saveRecord(
        db,
        'exercises',
        {
          category: null,
          modality: 'weight_reps',
          description: null,
          equipment: [],
          primary_muscles: [],
          secondary_muscles: [],
          images: [],
          tags: [],
          instructions: [],
          calories_per_hour: 0,
          source: 'custom',
          is_custom: true,
          shared_with_public: false,
          ...(method === 'PUT' ? findRecord(db, 'exercises', id) : {}),
          ...body,
        },
        method === 'PUT' ? id : undefined
      ),
    };
  }
  if (parts[2] === 'exercise-entries') {
    if (method === 'DELETE') {
      deleteRecord(db, 'activities', id);
      return { value: undefined };
    }
    if (method === 'GET')
      return {
        value: exerciseEntryResponseSchema
          .strip()
          .parse(findRecord(db, 'activities', id)),
      };
    // Native recordings carry a stable marker across retries. The local
    // transaction serializes lookup + insert, including after process death.
    if (method === 'POST') {
      const marker = asRecords(body.activity_details).find(
        (detail) => detail.detail_type === 'fitness_recording_v1'
      );
      const recordingId =
        marker &&
        typeof marker.detail_data === 'object' &&
        marker.detail_data !== null &&
        'recordingId' in marker.detail_data
          ? marker.detail_data.recordingId
          : undefined;
      if (typeof recordingId === 'string') {
        const existing = table(db, 'activities').find((row) =>
          asRecords(row.activity_details).some(
            (detail) =>
              detail.detail_type === 'fitness_recording_v1' &&
              typeof detail.detail_data === 'object' &&
              detail.detail_data !== null &&
              'recordingId' in detail.detail_data &&
              detail.detail_data.recordingId === recordingId
          )
        );
        if (existing)
          return { value: exerciseEntryResponseSchema.strip().parse(existing) };
      }
    }
    const previous = method === 'PUT' ? findRecord(db, 'activities', id) : {};
    const row = exerciseEntry(
      db,
      { ...previous, ...body },
      body.entry_date ?? previous.entry_date
    );
    const saved = saveRecord(
      db,
      'activities',
      row,
      method === 'PUT' ? id : undefined
    );
    return { value: exerciseEntryResponseSchema.strip().parse(saved) };
  }
  if (parts[2] === 'exercise-preset-entries') {
    if (method === 'DELETE') {
      deleteRecord(db, 'workouts', id);
      return { value: undefined };
    }
    if (method === 'GET')
      return {
        value: presetSessionResponseSchema
          .strip()
          .parse(findRecord(db, 'workouts', id)),
      };
    const previous = method === 'PUT' ? findRecord(db, 'workouts', id) : {};
    const preset = body.workout_preset_id
      ? findRecord(db, 'presets', body.workout_preset_id)
      : {};
    const merged = { ...previous, ...body };
    const date = merged.entry_date;
    const exercises = asRecords(
      body.exercises ?? previous.exercises ?? preset.exercises
    ).map((ex) => exerciseEntry(db, ex, date));
    const row = saveRecord(
      db,
      'workouts',
      {
        type: 'preset',
        workout_preset_id: null,
        name: preset.name,
        description: null,
        notes: null,
        source: 'manual',
        activity_details: [],
        ...merged,
        exercises,
        total_duration_minutes: exercises.reduce(
          (sum, ex) => sum + Number(ex.duration_minutes),
          0
        ),
      },
      method === 'PUT' ? id : undefined
    );
    return { value: presetSessionResponseSchema.strip().parse(row) };
  }
  if (parts[2] === 'workout-presets') {
    if (method === 'GET') {
      const rows = search(table(db, 'presets')).map((row) =>
        presetWithImages(db, row)
      );
      if (id === 'search') return { value: rows };
      if (id)
        return {
          value: presetWithImages(db, findRecord(db, 'presets', id)),
        };
      return {
        value: {
          presets: rows.slice((page - 1) * size, page * size),
          total: rows.length,
          page,
          limit: size,
        },
      };
    }
    if (method === 'DELETE') {
      deleteRecord(db, 'presets', id);
      return { value: {} };
    }
    const previous = method === 'PUT' ? findRecord(db, 'presets', id) : {};
    const exercises = asRecords(body.exercises ?? previous.exercises).map(
      (ex) => {
        const exercise = findRecord(db, 'exercises', ex.exercise_id);
        return {
          id: db.nextId++,
          exercise_name: exercise.name,
          image_url: null,
          category: exercise.category ?? null,
          superset_group: null,
          ...ex,
          sets: sets(db, ex.sets),
        };
      }
    );
    const row = saveRecord(
      db,
      'presets',
      {
        id: previous.id ?? db.nextId++,
        description: null,
        is_public: false,
        ...previous,
        ...body,
        exercises,
      },
      method === 'PUT' ? id : undefined
    );
    return { value: presetWithImages(db, row) };
  }
  return undefined;
}
