import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { resetProviderCatalogCache } from '../../src/services/local/providerCatalog';
import type { LocalRecord } from '../../src/services/local/database';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

const request = <T = LocalRecord>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

const FREE_EXERCISES = [
  {
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    category: 'strength',
    level: 'intermediate',
    force: 'push',
    mechanic: 'compound',
    // Upstream stores equipment as a bare string, not a list.
    equipment: 'barbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes'],
    instructions: ['Unrack the bar.', 'Squat to depth.'],
    images: ['Barbell_Squat/0.jpg', 'Barbell_Squat/1.jpg'],
  },
  {
    id: 'Push_Up',
    name: 'Push Up',
    category: 'strength',
    level: 'beginner',
    equipment: 'body only',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Lower yourself.'],
    images: ['Push_Up/0.jpg'],
  },
];

const NUTELLA = {
  code: '3017620422003',
  product_name: 'Nutella',
  // Search-a-licious returns brands as a list; Product Opener as a string.
  brands: ['Ferrero'],
  serving_size: '2 tbsp (37 g)',
  serving_quantity: 37,
  serving_quantity_unit: 'g',
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    'saturated-fat_100g': 10.6,
    sodium_100g: 0.0428,
    sugars_100g: 56.3,
  },
  image_front_url: 'https://images.openfoodfacts.org/nutella.jpg',
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);

let fetchMock: jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  resetProviderCatalogCache();

  fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (url.includes('free-exercise-db')) {
      return jsonResponse(FREE_EXERCISES);
    }
    if (url.startsWith('https://search.openfoodfacts.org/search')) {
      const body = JSON.parse(String(init?.body ?? '{}'));
      return jsonResponse({
        hits: String(body.q).toLowerCase().includes('nutella') ? [NUTELLA] : [],
        count: String(body.q).toLowerCase().includes('nutella') ? 1 : 0,
        page: body.page,
        page_size: body.page_size,
        is_count_exact: true,
      });
    }
    if (url.includes('/api/v2/product/')) {
      const found = url.includes(NUTELLA.code);
      return jsonResponse(
        found
          ? { status: 1, product: { ...NUTELLA, brands: 'Ferrero' } }
          : { status: 0 }
      );
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

test('seeds only the providers the catalog can answer for', async () => {
  const providers = await request<LocalRecord[]>('/api/external-providers');

  expect(
    providers.map((p) => [p.provider_type, p.categories, p.supports_barcode])
  ).toEqual([
    ['free-exercise-db', ['exercise'], false],
    ['openfoodfacts', ['food'], true],
  ]);
  expect(providers.every((p) => p.is_active === true)).toBe(true);
  // Seeding must be idempotent across calls, not re-generated per request.
  const again = await request<LocalRecord[]>('/api/external-providers');
  expect(again.map((p) => p.id)).toEqual(providers.map((p) => p.id));
});

test('searches Free Exercise DB, mapping upstream fields and hotlinking images', async () => {
  const result = await request<{
    items: LocalRecord[];
    pagination: LocalRecord;
  }>(
    '/api/exercises/search-external?providerType=free-exercise-db&query=squat&page=1&pageSize=20'
  );

  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    source: 'free-exercise-db',
    category: 'strength',
    modality: 'weight_reps',
    // A bare upstream string still has to reach the client as a list.
    equipment: ['barbell'],
    primary_muscles: ['quadriceps'],
    images: [
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg',
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/1.jpg',
    ],
  });
  expect(result.pagination).toMatchObject({ totalCount: 1, hasMore: false });

  // The catalog is one document for every search; it must be fetched once.
  await request(
    '/api/exercises/search-external?providerType=free-exercise-db&query=push&page=1&pageSize=20'
  );
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('free-exercise-db')
    )
  ).toHaveLength(1);
});

test('imports an exercise into the library once, then reuses the local copy', async () => {
  const imported = await request('/api/freeexercisedb/add', 'POST', {
    exerciseId: 'Barbell_Squat',
  });

  expect(imported).toMatchObject({
    name: 'Barbell Squat',
    source: 'free-exercise-db',
    source_id: 'Barbell_Squat',
    is_custom: true,
    // MET 5.0 (strength/intermediate) at the 70kg fallback weight.
    calories_per_hour: 368,
    description: 'Unrack the bar.',
  });

  const library = await request<{ exercises: LocalRecord[] }>('/api/exercises');
  expect(library.exercises).toHaveLength(1);

  // Re-importing must return the existing row, not a second copy.
  const again = await request('/api/freeexercisedb/add', 'POST', {
    exerciseId: 'Barbell_Squat',
  });
  expect(again.id).toBe(imported.id);
  const after = await request<{ exercises: LocalRecord[] }>('/api/exercises');
  expect(after.exercises).toHaveLength(1);
});

test('scales an imported exercise estimate to the latest recorded weight', async () => {
  await request('/api/measurements/check-in', 'POST', {
    entry_date: '2026-09-06',
    weight: 90,
  });

  const imported = await request('/api/freeexercisedb/add', 'POST', {
    exerciseId: 'Push_Up',
  });

  // MET 4.0 (strength/beginner) at 90kg: (4 * 3.5 * 90) / 200 * 60.
  expect(imported.calories_per_hour).toBe(378);
});

test('maps an Open Food Facts hit to the normalized food contract', async () => {
  const result = await request<{
    foods: LocalRecord[];
    pagination: LocalRecord;
  }>('/api/v2/foods/search/openfoodfacts?query=nutella&page=1');

  expect(result.foods).toHaveLength(1);
  const food = result.foods[0];
  expect(food).toMatchObject({
    name: 'Nutella',
    brand: 'Ferrero',
    barcode: '3017620422003',
    provider_type: 'openfoodfacts',
    is_custom: false,
    image_url: 'https://images.openfoodfacts.org/nutella.jpg',
  });

  // Nutrients are declared per 100g and scaled to the 37g declared serving.
  expect(food.default_variant).toMatchObject({
    serving_size: 37,
    serving_unit: 'g',
    calories: 199,
    protein: 2.3,
    carbs: 21.3,
    fat: 11.4,
    sodium: 16,
    is_default: true,
  });

  // "2 tbsp (37 g)" is the same physical serving, so it reuses the nutrients.
  const variants = food.variants as LocalRecord[];
  expect(variants).toHaveLength(2);
  expect(variants[1]).toMatchObject({
    serving_size: 2,
    serving_unit: 'tbsp',
    calories: 199,
    is_default: false,
  });
});

test('reports 100g values when the caller disables auto-scaling', async () => {
  const result = await request<{ foods: LocalRecord[] }>(
    '/api/v2/foods/search/openfoodfacts?query=nutella&page=1&autoScale=false'
  );

  expect(result.foods[0].default_variant).toMatchObject({
    serving_size: 100,
    calories: 539,
    protein: 6.3,
  });
});

test('barcode lookup prefers a saved food and falls back to the provider', async () => {
  const provider = await request<{ source: string; food: LocalRecord }>(
    `/api/v2/foods/barcode/${NUTELLA.code}`
  );
  expect(provider.source).toBe('openfoodfacts');
  expect(provider.food.name).toBe('Nutella');

  await request('/api/foods', 'POST', {
    name: 'My Corrected Nutella',
    brand: 'Ferrero',
    barcode: NUTELLA.code,
    serving_size: 15,
    serving_unit: 'g',
    calories: 80,
    protein: 1,
    carbs: 8,
    fat: 4.5,
  });

  const local = await request<{ source: string; food: LocalRecord }>(
    `/api/v2/foods/barcode/${NUTELLA.code}`
  );
  expect(local.source).toBe('local');
  expect(local.food.name).toBe('My Corrected Nutella');

  const missing = await request<{ source: string; food: null }>(
    '/api/v2/foods/barcode/0000000000000'
  );
  expect(missing).toEqual({ source: 'not_found', food: null });
});

test('a scanned UPC-A code still matches a saved EAN-13 food', async () => {
  await request('/api/foods', 'POST', {
    name: 'Saved By EAN',
    barcode: '0012345678905',
    serving_size: 100,
    serving_unit: 'g',
    calories: 100,
  });

  const result = await request<{ source: string; food: LocalRecord }>(
    '/api/v2/foods/barcode/012345678905'
  );
  expect(result.source).toBe('local');
  expect(result.food.name).toBe('Saved By EAN');
});

test('an unimplemented provider still fails loudly instead of returning nothing', async () => {
  await expect(
    request(
      '/api/exercises/search-external?providerType=wger&query=squat&page=1&pageSize=20'
    )
  ).rejects.toThrow(/Local data does not support/);

  await expect(
    request('/api/v2/foods/search/usda?query=apple&page=1')
  ).rejects.toThrow(/Local data does not support/);
});

test('a provider outage never reaches the database queue as a partial write', async () => {
  fetchMock.mockImplementation(() => jsonResponse({}, false, 503));

  await expect(
    request('/api/freeexercisedb/add', 'POST', { exerciseId: 'Barbell_Squat' })
  ).rejects.toThrow(/HTTP 503/);

  // The failed import must leave the library and the mutation journal untouched.
  const library = await request<{ exercises: LocalRecord[] }>('/api/exercises');
  expect(library.exercises).toHaveLength(0);
});
