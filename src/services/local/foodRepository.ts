import {
  asRecord,
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

export function foodSnapshot(
  db: LocalDatabase,
  body: LocalRecord
): LocalRecord {
  const food = body.food_id ? findRecord(db, 'foods', body.food_id) : undefined;
  const variant = body.variant_id
    ? findRecord(db, 'variants', body.variant_id)
    : food
      ? asRecord(food.default_variant)
      : {};
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    serving_size: 1,
    ...variant,
    variant_id: variant.id,
    food_name: food?.name,
    brand_name: food?.brand,
    food_images: food?.images,
    ...body,
    // A variant's id must never become the diary entry's id.
    id: newId(),
  };
}

const searchable = (rows: LocalRecord[], query: URLSearchParams) => {
  const term = (query.get('searchTerm') ?? '').toLocaleLowerCase();
  return rows
    .filter((row) =>
      `${row.name} ${row.brand ?? ''}`.toLocaleLowerCase().includes(term)
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export function foodRepository(
  db: LocalDatabase,
  request: LocalRequest
): LocalResult | undefined {
  const { path, query, method, body } = request;
  const parts = path.split('/');
  const id = parts[3];
  if (path === '/api/food-entry-meals/by-date') return { value: [] };
  if (parts[2] === 'food-entry-meals') {
    if (method === 'GET') {
      if (id === 'by-date')
        return {
          value: table(db, 'loggedMeals').filter(
            (row) => row.entry_date === parts[4]
          ),
        };
      return { value: findRecord(db, 'loggedMeals', id) };
    }
    if (method === 'DELETE') {
      deleteRecord(db, 'loggedMeals', id);
      db.tables.entries = table(db, 'entries').filter(
        (row) => row.food_entry_meal_id !== id
      );
      return { value: undefined };
    }
    const previous = method === 'PUT' ? findRecord(db, 'loggedMeals', id) : {};
    const merged = { ...previous, ...body };
    const template = merged.meal_template_id
      ? findRecord(db, 'meals', merged.meal_template_id)
      : {};
    const foods = asRecords(body.foods ?? previous.foods ?? template.foods).map(
      (ingredient) => foodSnapshot(db, ingredient)
    );
    const yieldCount = Number(
      merged.entry_total_servings ?? template.total_servings ?? 1
    );
    const portionSize =
      merged.unit === 'serving' ? 1 : Number(template.serving_size ?? 1);
    const multiplier =
      merged.meal_template_id || merged.entry_total_servings
        ? Number(merged.quantity) / (yieldCount * portionSize)
        : 1;
    if (!Number.isFinite(multiplier) || multiplier <= 0)
      throw new Error('Invalid meal quantity.');
    const meal = saveRecord(
      db,
      'loggedMeals',
      {
        meal_template_id: null,
        description: null,
        notes: null,
        ...merged,
        foods,
        entry_total_servings: yieldCount,
        legacy_serving_unit_math: false,
      },
      method === 'PUT' ? id : undefined
    );
    db.tables.entries = table(db, 'entries').filter(
      (row) => row.food_entry_meal_id !== meal.id
    );
    for (const ingredient of foods) {
      saveRecord(db, 'entries', {
        ...ingredient,
        id: newId(),
        quantity: Number(ingredient.quantity) * multiplier,
        entry_date: meal.entry_date,
        meal_type: meal.meal_type,
        meal_type_id: meal.meal_type_id,
        food_entry_meal_id: meal.id,
      });
    }
    for (const nutrient of [
      'calories',
      'protein',
      'carbs',
      'fat',
      'dietary_fiber',
    ]) {
      meal[nutrient] = foods.reduce(
        (sum, food) =>
          sum +
          ((Number(food[nutrient] ?? 0) * Number(food.quantity)) /
            Number(food.serving_size || 1)) *
            multiplier,
        0
      );
    }
    return { value: meal };
  }
  if (path === '/api/foods/update-snapshot' && method === 'POST') {
    for (const entry of table(db, 'entries').filter(
      (row) =>
        row.food_id === body.foodId &&
        (!body.variantId || row.variant_id === body.variantId)
    )) {
      const variant = findRecord(
        db,
        'variants',
        entry.variant_id ??
          asRecord(findRecord(db, 'foods', entry.food_id).default_variant).id
      );
      Object.assign(entry, variant, {
        id: entry.id,
        food_id: entry.food_id,
        quantity: entry.quantity,
      });
    }
    return { value: undefined };
  }
  // Local-first half of the v2 barcode lookup: `providerCatalog` asks here
  // before it reaches Open Food Facts, so a saved food (and the user's own
  // corrections to it) always wins over the provider's copy. Both EAN-13 and
  // UPC-A forms match, since a scanner may report either for one product.
  if (parts[2] === 'foods' && parts[3] === 'by-barcode' && method === 'GET') {
    const code = parts[4] ?? '';
    const alternates = new Set(
      [
        code,
        code.length === 12 ? `0${code}` : null,
        code.length === 13 && code.startsWith('0') ? code.slice(1) : null,
      ].filter((value): value is string => !!value)
    );
    return {
      value:
        table(db, 'foods').find((row) => alternates.has(String(row.barcode))) ??
        null,
    };
  }
  if (path === '/api/foods' && method === 'GET') {
    const rows = table(db, 'foods');
    return {
      value: {
        recentFoods: rows.slice(-10).reverse(),
        topFoods: rows.map((row) => ({
          ...row,
          usage_count: table(db, 'entries').filter(
            (entry) => entry.food_id === row.id
          ).length,
        })),
      },
    };
  }
  if (path === '/api/foods/foods-paginated') {
    const rows = searchable(table(db, 'foods'), query);
    const page = Math.max(1, Number(query.get('currentPage')) || 1);
    const size = Math.max(1, Number(query.get('itemsPerPage')) || 20);
    return {
      value: {
        foods: rows.slice((page - 1) * size, page * size),
        totalCount: rows.length,
      },
    };
  }
  if (path.startsWith('/api/foods/food-variants')) {
    const variantId = parts[4];
    if (method === 'GET')
      return {
        value: table(db, 'variants').filter(
          (v) => v.food_id === query.get('food_id')
        ),
      };
    if (method === 'DELETE') {
      const variant = findRecord(db, 'variants', variantId);
      const food = findRecord(db, 'foods', variant.food_id);
      if (asRecord(food.default_variant).id === variantId)
        throw new Error('Cannot delete the default food variant.');
      deleteRecord(db, 'variants', variantId);
      return { value: {} };
    }
    const variant = saveRecord(
      db,
      'variants',
      body,
      method === 'PUT' ? variantId : undefined
    );
    const food = findRecord(db, 'foods', variant.food_id);
    if (variant.is_default || asRecord(food.default_variant).id === variant.id)
      food.default_variant = variant;
    return { value: variant };
  }
  if (path === '/api/foods' && method === 'POST') {
    const foodId = newId();
    const variant = saveRecord(db, 'variants', {
      ...body,
      food_id: foodId,
      is_default: true,
    });
    const food = saveRecord(db, 'foods', {
      ...body,
      id: foodId,
      brand: body.brand ?? null,
      is_custom: true,
      shared_with_public: false,
      default_variant: variant,
    });
    return { value: food };
  }
  if (parts[2] === 'foods' && id && parts.length === 4) {
    if (method === 'GET') return { value: findRecord(db, 'foods', id) };
    if (method === 'PUT') return { value: saveRecord(db, 'foods', body, id) };
    if (method === 'DELETE') {
      deleteRecord(db, 'foods', id);
      return { value: {} };
    }
  }
  if (path === '/api/food-entries/copy' && method === 'POST') {
    const target = table(db, 'mealTypes').find(
      (row) =>
        String(row.name).toLowerCase() ===
        String(body.targetMealType).toLowerCase()
    );
    if (!target) throw new Error('Target meal type not found.');
    const entries = table(db, 'entries').filter(
      (entry) =>
        entry.entry_date === body.sourceDate &&
        String(entry.meal_type).toLowerCase() ===
          String(body.sourceMealType).toLowerCase()
    );
    entries.forEach((entry) =>
      saveRecord(db, 'entries', {
        ...entry,
        id: newId(),
        entry_date: body.targetDate,
        meal_type_id: target.id,
        meal_type: target.name,
      })
    );
    return { value: undefined };
  }
  if (path === '/api/food-entries' && method === 'POST') {
    if (body.meal_id)
      throw new Error('Use the local meal logging flow to log a meal.');
    const mealType = findRecord(db, 'mealTypes', body.meal_type_id);
    return {
      value: saveRecord(db, 'entries', {
        ...foodSnapshot(db, body),
        meal_type: mealType.name,
      }),
    };
  }
  if (parts[2] === 'food-entries' && id) {
    if (method === 'GET') return { value: findRecord(db, 'entries', id) };
    if (method === 'PUT') {
      const previous = findRecord(db, 'entries', id);
      const next: LocalRecord =
        body.variant_id && body.variant_id !== previous.variant_id
          ? {
              ...previous,
              ...findRecord(db, 'variants', body.variant_id),
              ...body,
              id,
            }
          : { ...previous, ...body };
      if (body.meal_type_id)
        next.meal_type = findRecord(db, 'mealTypes', body.meal_type_id).name;
      return { value: saveRecord(db, 'entries', next, id) };
    }
    if (method === 'DELETE') {
      deleteRecord(db, 'entries', id);
      return { value: undefined };
    }
  }
  if (path === '/api/favorites' && method === 'GET') {
    const favorites = table(db, 'favorites');
    return {
      value: {
        favoriteFoods: table(db, 'foods').filter((row) =>
          favorites.some((f) => f.type === 'food' && f.entity_id === row.id)
        ),
        favoriteMeals: table(db, 'meals').filter((row) =>
          favorites.some((f) => f.type === 'meal' && f.entity_id === row.id)
        ),
      },
    };
  }
  if (parts[2] === 'favorites' && parts[4]) {
    const rows = table(db, 'favorites');
    const previous = rows.find(
      (r) => r.type === id && r.entity_id === parts[4]
    );
    if (method === 'POST' && !previous)
      saveRecord(db, 'favorites', { type: id, entity_id: parts[4] });
    if (method === 'DELETE' && previous)
      deleteRecord(db, 'favorites', previous.id);
    return {
      value: { type: id, id: parts[4], is_favorite: method === 'POST' },
    };
  }
  if (parts[2] === 'meals') {
    if (parts[4] === 'deletion-impact')
      return { value: { usedByOtherUsers: false, usedByCurrentUser: false } };
    if (method === 'GET') {
      if (!id || ['recent', 'top', 'search'].includes(id))
        return { value: searchable(table(db, 'meals'), query) };
      return { value: findRecord(db, 'meals', id) };
    }
    if (method === 'DELETE') {
      deleteRecord(db, 'meals', id);
      return { value: {} };
    }
    const foods =
      body.foods === undefined
        ? undefined
        : asRecords(body.foods).map((ingredient) => {
            if (ingredient.item_type === 'meal')
              throw new Error(
                'Nested meals are not supported in local mode yet.'
              );
            const snapshot = foodSnapshot(db, ingredient);
            return { ...snapshot, brand: snapshot.brand_name ?? null };
          });
    return {
      value: saveRecord(
        db,
        'meals',
        {
          description: null,
          notes: null,
          is_public: false,
          serving_size: 1,
          serving_unit: 'serving',
          total_servings: 1,
          ...(method === 'PUT' ? findRecord(db, 'meals', id) : {}),
          ...body,
          ...(foods ? { foods } : {}),
        },
        method === 'PUT' ? id : undefined
      ),
    };
  }
  return undefined;
}
