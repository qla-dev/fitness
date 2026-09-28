import {
  deleteRecord,
  findRecord,
  newId,
  saveRecord,
  table,
  type LocalDatabase,
  type LocalRecord,
} from './database';
import type { LocalRequest, LocalResult } from './request';

const TABLE = 'mealPlanTemplates';
const BASE = '/api/meal-plan-templates';

/**
 * Manually built meal plans (the form: library foods and meals assigned to
 * meal types per weekday), kept on the device so the editor works without a
 * server. `currentClientDate` only matters to a server that fills diary days
 * from active plans; here it is dropped.
 */
function withAssignments(db: LocalDatabase, body: LocalRecord): LocalRecord {
  const { currentClientDate: _date, ...rest } = body;
  const mealTypes = table(db, 'mealTypes');
  const assignments = Array.isArray(rest.assignments) ? rest.assignments : [];
  return {
    ...rest,
    assignments: assignments.map((item) => {
      const assignment = item as LocalRecord;
      const mealType = mealTypes.find(
        (type) => String(type.id) === String(assignment.meal_type_id)
      );
      return {
        ...assignment,
        id: assignment.id ?? newId(),
        meal_type: assignment.meal_type ?? mealType?.name ?? null,
      };
    }),
  };
}

export function mealPlanRepository(
  db: LocalDatabase,
  { path, method, body }: LocalRequest
): LocalResult | undefined {
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return undefined;
  const [id, action] = path.slice(BASE.length + 1).split('/');
  if (method === 'GET' && !id)
    return {
      value: [...table(db, TABLE)].sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      ),
    };
  if (method === 'POST' && !id)
    return { value: saveRecord(db, TABLE, withAssignments(db, body)) };
  if (method === 'PUT' && id)
    return { value: saveRecord(db, TABLE, withAssignments(db, body), id) };
  if (method === 'DELETE' && id) {
    deleteRecord(db, TABLE, id);
    return { value: undefined };
  }
  if (method === 'POST' && id && action === 'duplicate') {
    const {
      id: _id,
      created_at: _created,
      ...source
    } = findRecord(db, TABLE, id);
    return {
      value: saveRecord(db, TABLE, {
        ...source,
        plan_name: `${String(source.plan_name)} (copy)`,
        is_active: false,
      }),
    };
  }
  return undefined;
}
