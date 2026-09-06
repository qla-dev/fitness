import type { DailyGoals } from '../../types/goals';
import { asRecord, asRecords, deleteRecord, findRecord, localTransaction, newId, saveRecord, table, type LocalDatabase, type LocalRecord } from './database';
import { foodRepository } from './foodRepository';
import { localSessions, workoutRepository } from './workoutRepository';
import type { LocalRequest } from './request';

// Starter display values, not a personalised recommendation. Stored goals can
// later be imported/edited through the same API contract.
const initialGoals: DailyGoals = { calories: 2000, protein: 100, carbs: 250, fat: 67, dietary_fiber: 30, water_goal_ml: 2000 };

function initialise(db: LocalDatabase) {
  if (!db.tables.mealTypes) db.tables.mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((name, index) => ({ id: newId(), name, sort_order: index, user_id: db.userId, created_at: new Date().toISOString(), is_visible: true, show_in_quick_log: true, default_time: null }));
  if (!db.tables.preferences) db.tables.preferences = [{ id: 'preferences', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, default_weight_unit: 'kg', default_distance_unit: 'km', default_measurement_unit: 'cm', water_display_unit: 'ml', energy_unit: 'kcal', ai_assisted_conversions: false }];
  if (!db.tables.goals) db.tables.goals = [{ id: 'goals', ...initialGoals }];
  if (!db.tables.waterContainers) db.tables.waterContainers = [{ id: 1, name: '250 ml', volume: 250, unit: 'ml', is_primary: true, servings_per_container: 1 }];
}

function route(db: LocalDatabase, request: LocalRequest): unknown {
  initialise(db);
  const { path, query, method, body } = request;
  const parts = path.split('/');
  if (path === '/api/daily-summary') {
    const date = query.get('date') ?? '';
    return { goals: table(db, 'goals')[0], foodEntries: table(db, 'entries').filter((row) => row.entry_date === date), exerciseSessions: localSessions(db, date), waterIntake: Number(table(db, 'water').find((row) => row.entry_date === date)?.water_ml ?? 0) };
  }
  if (path === '/api/identity/profiles') return { id: db.userId, full_name: null, phone_number: null, date_of_birth: null, bio: null, avatar_url: null, gender: null };
  if (path === '/api/user-preferences' || path === '/api/user-preferences/bootstrap-timezone') {
    if (method === 'GET') return table(db, 'preferences')[0];
    return saveRecord(db, 'preferences', body, 'preferences');
  }
  if (path.startsWith('/api/goals')) {
    if (method === 'GET') return table(db, 'goals')[0];
    return saveRecord(db, 'goals', body, 'goals');
  }
  if (path.startsWith('/api/preferences/nutrient-display')) {
    if (method === 'GET') return table(db, 'nutrientDisplay');
    const existing = table(db, 'nutrientDisplay').find((row) => row.view_group === parts[4] && row.platform === parts[5]);
    return saveRecord(db, 'nutrientDisplay', { ...body, view_group: parts[4], platform: parts[5] }, existing?.id);
  }
  if (path.startsWith('/api/meal-types')) {
    const id = parts[3];
    if (method === 'GET') return table(db, 'mealTypes').sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    if (method === 'DELETE') {
      if (table(db, 'entries').some((row) => row.meal_type_id === id)) throw new Error('A meal type used by diary entries cannot be deleted.');
      deleteRecord(db, 'mealTypes', id); return undefined;
    }
    return saveRecord(db, 'mealTypes', { is_visible: true, show_in_quick_log: true, sort_order: table(db, 'mealTypes').length, ...body }, method === 'PUT' ? id : undefined);
  }
  if (path === '/api/water-containers') return table(db, 'waterContainers');
  if (path.startsWith('/api/measurements/check-in-measurements-range/')) return table(db, 'measurements').filter((row) => String(row.entry_date) >= parts[4] && String(row.entry_date) <= parts[5]).sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  if (path === '/api/measurements/check-in' && method === 'POST') {
    const existing = table(db, 'measurements').find((row) => row.entry_date === body.entry_date);
    return saveRecord(db, 'measurements', body, existing?.id);
  }
  if (path.startsWith('/api/measurements/water-intake')) {
    const date = method === 'GET' ? parts[4] : body.entry_date;
    const existing = table(db, 'water').find((row) => row.entry_date === date);
    if (method === 'GET') return { water_ml: existing?.water_ml ?? 0, manual_ml: existing?.water_ml ?? 0 };
    const container = findRecord(db, 'waterContainers', body.container_id);
    const amount = Number(container.volume) / Number(container.servings_per_container);
    const total = Math.max(0, Number(existing?.water_ml ?? 0) + Number(body.change_drinks) * amount);
    if (!Number.isFinite(total)) throw new Error('Invalid water amount.');
    return saveRecord(db, 'water', { entry_date: date, water_ml: total }, existing?.id);
  }
  if (path.startsWith('/api/measurements/custom-categories') || path.startsWith('/api/measurements/custom-entries')) {
    const name = parts[3] === 'custom-categories' ? 'measurementCategories' : 'customMeasurements';
    const id = parts[4];
    if (method === 'GET') return table(db, name).filter((row) => !id || row.entry_date === id);
    if (method === 'DELETE') { deleteRecord(db, name, id); return undefined; }
    return saveRecord(db, name, body, method === 'PUT' ? id : undefined);
  }
  const food = foodRepository(db, request);
  if (food) return food.value;
  const workout = workoutRepository(db, request);
  if (workout) return workout.value;
  // Optional server-backed surfaces return their empty state; unknown writes
  // always fail instead of pretending a save succeeded.
  if (method === 'GET') {
    if (['/api/external-providers', '/api/custom-nutrients', '/api/identity/users/accessible-users', '/api/sleep', '/api/meal-plan-templates', '/api/measurements/check-in-photos', '/api/measurements/check-in-photos/dates'].includes(path)) return [];
    if (['/api/fasting/current', '/api/v2/cycle/settings', '/api/v2/pregnancy/current'].includes(path)) return null;
  }
  throw new Error(`Local data does not support ${method} ${path}. A backend is required for this feature.`);
}

export async function localApiFetch<T>(options: { endpoint: string; method?: LocalRequest['method']; body?: unknown }): Promise<T> {
  const method = options.method ?? 'GET';
  const [rawPath, search = ''] = options.endpoint.split('?');
  const path = rawPath.replace(/\/$/, '');
  // Match the HTTP transport's JSON semantics: omitted values stay omitted,
  // explicit null clears a field, and caller-owned objects cannot mutate storage.
  const body = asRecord(JSON.parse(JSON.stringify(options.body ?? {})));
  const request: LocalRequest = { path, query: new URLSearchParams(search), method, body };
  return localTransaction((db) => route(db, request) as T,
    method === 'GET' ? undefined : { method, endpoint: options.endpoint, body });
}
