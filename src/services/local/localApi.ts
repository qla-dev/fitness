import type { DailyGoals } from '../../types/goals';
import {
  asRecord,
  deleteRecord,
  findRecord,
  localTransaction,
  newId,
  markLocalDatabaseDirty,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import { foodRepository } from './foodRepository';
import { localSessions, workoutRepository } from './workoutRepository';
import { calculateExerciseStats } from '../../utils/workoutSession';
import type { ExerciseSessionResponse } from '@workspace/shared';
import { LOCAL_PROVIDER_SEEDS, catalogRoute } from './providerCatalog';
import type { LocalRequest } from './request';
import { goalsForDate, saveGoalsFromToday } from './goalHistory';
import { getTodayDate } from '../../utils/dateUtils';
import {
  importedWater,
  localHourlyActivity,
  localTotalCalories,
  importHealthData,
  localMeasurements,
} from './healthRepository';

// Starter display values, not a personalised recommendation. Stored goals can
// later be imported/edited through the same API contract.
const initialGoals: DailyGoals = {
  calories: 2000,
  protein: 100,
  carbs: 250,
  fat: 67,
  dietary_fiber: 30,
  water_goal_ml: 2000,
  // The three Activity ring goals. Without them every ring divides by 0 and
  // renders empty; `goalHistory.ts` backfills the same values for goals rows
  // saved before these fields existed.
  steps: 10000,
  target_exercise_calories_burned: 500,
  target_exercise_duration_minutes: 30,
};

// Seeding assigns tables directly rather than going through `saveRecord`, so
// it has to say so itself: a read-only request skips persistence unless
// something marks the database dirty, and first launch seeds on a GET.
function initialise(db: LocalDatabase) {
  if (
    !db.tables.mealTypes ||
    !db.tables.preferences ||
    !db.tables.goals ||
    !db.tables.providers ||
    !db.tables.waterContainers
  )
    markLocalDatabaseDirty();
  if (!db.tables.mealTypes)
    db.tables.mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map(
      (name, index) => ({
        id: newId(),
        name,
        sort_order: index,
        user_id: null,
        created_at: new Date().toISOString(),
        is_visible: true,
        show_in_quick_log: true,
        default_time: null,
      })
    );
  if (!db.tables.preferences)
    db.tables.preferences = [
      {
        id: 'preferences',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        default_weight_unit: 'kg',
        default_distance_unit: 'km',
        default_measurement_unit: 'cm',
        water_display_unit: 'ml',
        energy_unit: 'kcal',
        ai_assisted_conversions: false,
      },
    ];
  if (!db.tables.goals) db.tables.goals = [{ id: 'goals', ...initialGoals }];
  // The upstream server creates these rows per user at signup; local mode
  // seeds the ones `providerCatalog` can actually answer for.
  if (!db.tables.providers)
    db.tables.providers = LOCAL_PROVIDER_SEEDS.map((provider) => ({
      id: newId(),
      ...provider,
      is_active: true,
      shared_with_public: false,
      created_at: new Date().toISOString(),
    }));
  if (!db.tables.waterContainers)
    db.tables.waterContainers = [
      {
        id: 1,
        name: '250 ml',
        volume: 250,
        unit: 'ml',
        is_primary: true,
        servings_per_container: 1,
      },
    ];
}

function route(db: LocalDatabase, request: LocalRequest): unknown {
  initialise(db);
  const { path, query, method, body } = request;
  const parts = path.split('/');
  if (path === '/api/health-data' && method === 'POST')
    return importHealthData(db, body.records);
  if (path === '/api/sleep' && method === 'GET')
    return table(db, 'sleep').filter(
      (row) =>
        (!query.get('startDate') ||
          String(row.entry_date) >= query.get('startDate')!) &&
        (!query.get('endDate') ||
          String(row.entry_date) <= query.get('endDate')!)
    );
  if (path === '/api/daily-summary') {
    const date = query.get('date') ?? '';
    return {
      goals: goalsForDate(db, date),
      foodEntries: table(db, 'entries').filter(
        (row) => row.entry_date === date
      ),
      exerciseSessions: localSessions(db, date),
      hourlyActivity: localHourlyActivity(db, date),
      totalCaloriesBurned: localTotalCalories(db, date),
      waterIntake:
        importedWater(db, date) +
        Number(
          table(db, 'water').find((row) => row.entry_date === date)?.water_ml ??
            0
        ),
    };
  }
  if (path === '/api/identity/profiles') {
    if (method !== 'GET')
      return saveRecord(db, 'profile', body, table(db, 'profile')[0]?.id);
    return {
      id: db.userId,
      full_name: null,
      username: null,
      email: null,
      phone_number: null,
      date_of_birth: null,
      bio: null,
      avatar_url: null,
      gender: null,
      ...table(db, 'profile')[0],
    };
  }
  if (
    path === '/api/user-preferences' ||
    path === '/api/user-preferences/bootstrap-timezone'
  ) {
    if (method === 'GET') return table(db, 'preferences')[0];
    return saveRecord(db, 'preferences', body, 'preferences');
  }
  if (path.startsWith('/api/goals')) {
    if (method === 'GET')
      return goalsForDate(db, query.get('date') ?? getTodayDate());
    return saveGoalsFromToday(db, body);
  }
  if (path.startsWith('/api/preferences/nutrient-display')) {
    if (method === 'GET') return table(db, 'nutrientDisplay');
    const existing = table(db, 'nutrientDisplay').find(
      (row) => row.view_group === parts[4] && row.platform === parts[5]
    );
    return saveRecord(
      db,
      'nutrientDisplay',
      { ...body, view_group: parts[4], platform: parts[5] },
      existing?.id
    );
  }
  if (path.startsWith('/api/meal-types')) {
    const id = parts[3];
    if (method === 'GET')
      return table(db, 'mealTypes').sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order)
      );
    if (method === 'DELETE') {
      if (table(db, 'entries').some((row) => row.meal_type_id === id))
        throw new Error('A meal type used by diary entries cannot be deleted.');
      deleteRecord(db, 'mealTypes', id);
      return undefined;
    }
    return saveRecord(
      db,
      'mealTypes',
      {
        is_visible: true,
        show_in_quick_log: true,
        sort_order: table(db, 'mealTypes').length,
        ...body,
      },
      method === 'PUT' ? id : undefined
    );
  }
  if (path === '/api/water-containers') return table(db, 'waterContainers');
  if (path === '/api/external-providers' && method === 'GET')
    return table(db, 'providers');
  // One transaction for a whole month of rings. The ring calendar used to ask
  // for each day's full daily summary separately, which re-read and re-parsed
  // the entire database once per day on screen, and wrote into the same cache
  // entries the Dashboard reads. Only days that actually hold something are
  // returned, so a day with no data draws no ring.
  if (path.startsWith('/api/activity-rings-range/')) {
    const [start, end] = [parts[3], parts[4]];

    const stepsByDay = new Map<string, unknown>();
    for (const row of localMeasurements(db, { start, end })) {
      const day = String(row.entry_date);
      if (row.steps != null) stepsByDay.set(day, row.steps);
    }

    const sessionsByDay = new Map<string, LocalRecord[]>();
    for (const session of localSessions(db, undefined, { start, end })) {
      const day = String(session.entry_date);
      sessionsByDay.set(day, [...(sessionsByDay.get(day) ?? []), session]);
    }

    return [...new Set([...stepsByDay.keys(), ...sessionsByDay.keys()])]
      .sort()
      .map((day) => {
        const goals = goalsForDate(db, day);
        const stats = calculateExerciseStats(
          (sessionsByDay.get(day) ?? []) as unknown as ExerciseSessionResponse[]
        );
        return {
          entry_date: day,
          activeCalories: stats.activeCalories,
          otherExerciseCalories: stats.otherExerciseCalories,
          exerciseMinutes: stats.durationMinutes,
          steps: Number(stepsByDay.get(day) ?? 0),
          exerciseCaloriesGoal: Number(
            goals.target_exercise_calories_burned ?? 0
          ),
          exerciseMinutesGoal: Number(
            goals.target_exercise_duration_minutes ?? 0
          ),
          stepsGoal: Number(goals.steps ?? 0),
        };
      });
  }
  // One day per row for the four activity metrics, so their detail screens can
  // draw a history the way steps and weight already do. Stand and distance sit
  // on the check-in row; move and exercise are the day's sessions folded
  // through the same stats the ring uses, so a history can never tell a
  // different story from the number it sits under.
  if (path.startsWith('/api/measurements/activity-range/')) {
    const [start, end] = [parts[4], parts[5]];
    const byDay = new Map<string, Record<string, number>>();
    for (const row of localMeasurements(db, { start, end })) {
      byDay.set(String(row.entry_date), {
        stand_hours: Number(row.stand_hours ?? 0),
        distance_m: Number(row.distance_m ?? 0),
        active_calories: 0,
        exercise_minutes: 0,
      });
    }
    const sessionsByDay = new Map<string, ExerciseSessionResponse[]>();
    for (const session of localSessions(db, undefined, { start, end })) {
      const day = String(session.entry_date);
      const list = sessionsByDay.get(day) ?? [];
      list.push(session as unknown as ExerciseSessionResponse);
      sessionsByDay.set(day, list);
    }
    for (const [day, sessions] of sessionsByDay) {
      const stats = calculateExerciseStats(sessions);
      const row = byDay.get(day) ?? {
        stand_hours: 0,
        distance_m: 0,
        active_calories: 0,
        exercise_minutes: 0,
      };
      row.active_calories = stats.activeCalories + stats.otherExerciseCalories;
      row.exercise_minutes = stats.durationMinutes;
      byDay.set(day, row);
    }
    return [...byDay.entries()]
      .map(([entry_date, values]) => ({ entry_date, ...values }))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }
  if (path.startsWith('/api/measurements/check-in-measurements-range/'))
    return localMeasurements(db, { start: parts[4], end: parts[5] }).sort(
      (a, b) => String(a.entry_date).localeCompare(String(b.entry_date))
    );
  if (path === '/api/measurements/check-in' && method === 'POST') {
    const existing = table(db, 'measurements').find(
      (row) => row.entry_date === body.entry_date
    );
    return saveRecord(db, 'measurements', body, existing?.id);
  }
  if (path.startsWith('/api/measurements/water-range/')) {
    const [start, end] = [parts[4], parts[5]];
    const manual = new Map<string, number>();
    for (const row of table(db, 'water')) {
      const day = String(row.entry_date);
      if (day >= start && day <= end)
        manual.set(day, Number(row.water_ml ?? 0));
    }
    // Imported hydration is per health record, so the days it covers are not
    // necessarily the days a manual entry exists for.
    const importedDays = new Set<string>();
    for (const row of table(db, 'healthRecords')) {
      const day = String(row.entry_date);
      if (row.type === 'water' && day >= start && day <= end)
        importedDays.add(day);
    }
    return [...new Set([...manual.keys(), ...importedDays])]
      .sort()
      .map((day) => ({
        entry_date: day,
        water_ml: (manual.get(day) ?? 0) + importedWater(db, day),
      }));
  }
  if (path.startsWith('/api/measurements/water-intake')) {
    const date = method === 'GET' ? parts[4] : body.entry_date;
    const existing = table(db, 'water').find((row) => row.entry_date === date);
    if (method === 'GET')
      return {
        water_ml: Number(existing?.water_ml ?? 0) + importedWater(db, date),
        manual_ml: existing?.water_ml ?? 0,
      };
    const container = findRecord(db, 'waterContainers', body.container_id);
    const amount =
      Number(container.volume) / Number(container.servings_per_container);
    const total = Math.max(
      0,
      Number(existing?.water_ml ?? 0) + Number(body.change_drinks) * amount
    );
    if (!Number.isFinite(total)) throw new Error('Invalid water amount.');
    return saveRecord(
      db,
      'water',
      { entry_date: date, water_ml: total },
      existing?.id
    );
  }
  if (
    path.startsWith('/api/measurements/custom-categories') ||
    path.startsWith('/api/measurements/custom-entries')
  ) {
    const name =
      parts[3] === 'custom-categories'
        ? 'measurementCategories'
        : 'customMeasurements';
    const id = parts[4];
    if (method === 'GET')
      return table(db, name).filter((row) => !id || row.entry_date === id);
    if (method === 'DELETE') {
      deleteRecord(db, name, id);
      return undefined;
    }
    return saveRecord(db, name, body, method === 'PUT' ? id : undefined);
  }
  const food = foodRepository(db, request);
  if (food) return food.value;
  const workout = workoutRepository(db, request);
  if (workout) return workout.value;
  // Optional server-backed surfaces return their empty state; unknown writes
  // always fail instead of pretending a save succeeded.
  if (method === 'GET') {
    if (
      [
        '/api/v2/medications',
        '/api/custom-nutrients',
        '/api/identity/users/accessible-users',
        '/api/sleep',
        '/api/meal-plan-templates',
        '/api/measurements/check-in-photos',
        '/api/measurements/check-in-photos/dates',
      ].includes(path)
    )
      return [];
    if (
      [
        '/api/fasting/current',
        '/api/v2/cycle/settings',
        '/api/v2/pregnancy/current',
      ].includes(path)
    )
      return null;
  }
  throw new Error(
    `Local data does not support ${method} ${path}. A backend is required for this feature.`
  );
}

export async function localApiFetch<T>(options: {
  endpoint: string;
  method?: LocalRequest['method'];
  body?: unknown;
}): Promise<T> {
  const method = options.method ?? 'GET';
  const [rawPath, search = ''] = options.endpoint.split('?');
  const path = rawPath.replace(/\/$/, '');
  // Match the HTTP transport's JSON semantics: omitted values stay omitted,
  // explicit null clears a field, and caller-owned objects cannot mutate storage.
  const body = asRecord(
    JSON.parse(
      JSON.stringify(
        path === '/api/health-data'
          ? { records: options.body }
          : (options.body ?? {})
      )
    )
  );
  const request: LocalRequest = {
    path,
    query: new URLSearchParams(search),
    method,
    body,
  };
  // Provider catalogs are network reads and must resolve before the
  // transaction opens: `localTransaction` serializes the whole database behind
  // one queue, so awaiting a remote call inside it would stall every other
  // read and write for the length of that request. Anything the catalog does
  // not own falls through to the local database router below.
  const catalog = await catalogRoute(
    request,
    (endpoint, innerMethod, innerBody) =>
      localApiFetch({ endpoint, method: innerMethod, body: innerBody })
  );
  if (catalog) return catalog.value as T;
  return localTransaction(
    (db) => route(db, request) as T,
    method === 'GET' ? undefined : { method, endpoint: options.endpoint, body }
  );
}
