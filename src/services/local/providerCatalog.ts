import Constants from 'expo-constants';
import {
  deriveExerciseModality,
  filterAndSortByTerms,
  normalizeNutrientUnit,
} from '@workspace/shared';
import { addLog } from '../LogService';
import { fetchWithTimeout } from '../../utils/concurrency';
import type { LocalRequest, LocalResult } from './request';

/**
 * Provider catalogs for local data mode.
 *
 * A fresh local database has no foods or exercises because SparkyFitness has
 * never shipped a bundled catalog — not in this package and not upstream. The
 * server keeps none either: it proxies keyless public APIs and gives every new
 * account a provider row per source (`create_default_external_data_providers`
 * in the server's 202511220110 migration). None of that needs a backend, so
 * local mode calls the same sources straight from the device.
 *
 * Only the two providers implemented here are seeded, so the picker never
 * offers a source that cannot answer. wger is deliberately absent: its importer
 * needs the id->name lookups the server keeps in `wgerNameMapping`, and Free
 * Exercise DB already covers the exercise catalog on its own.
 *
 * Search callers (`useExternalFoodSearch`, `useAllProvidersSearch`) already
 * hold `offRateLimiter` before they reach the adapter, so nothing here acquires
 * it again — that would spend two slots per search against Open Food Facts'
 * budget instead of one.
 */

const FREE_EXERCISE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
const OFF_PRODUCT_BASE = 'https://world.openfoodfacts.org';

// Search-a-licious refuses to page past this many results.
const OFF_RESULT_WINDOW = 10_000;
// Upstream availability is intermittent; bound every call so a hung provider
// cannot hold a screen's query open indefinitely.
const OFF_TIMEOUT_MS = 10_000;
const FEDB_TIMEOUT_MS = 15_000;
// The dataset is one JSON document covering the whole catalog. Cache it for an
// hour and serve it stale on a refresh failure rather than emptying the screen.
const FEDB_DATASET_TTL_MS = 60 * 60 * 1000;
// After a cold-start failure, stop retrying on every keystroke.
const FEDB_RETRY_INTERVAL_MS = 5 * 60 * 1000;

// Open Food Facts asks API clients to identify themselves.
const USER_AGENT = `SparkyFitnessMobile/${
  Constants.expoConfig?.version ?? '0.0.0'
} (https://github.com/CodeWithCJ/SparkyFitness)`;

/** Seeded into the local database so the provider pickers have something to offer. */
export const LOCAL_PROVIDER_SEEDS = [
  {
    provider_name: 'Free Exercise DB',
    provider_type: 'free-exercise-db',
    categories: ['exercise'],
    supports_barcode: false,
  },
  {
    provider_name: 'Open Food Facts',
    provider_type: 'openfoodfacts',
    categories: ['food'],
    supports_barcode: true,
  },
];

export type LocalFetch = <T>(
  endpoint: string,
  method?: LocalRequest['method'],
  body?: unknown
) => Promise<T>;

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

// ---------------------------------------------------------------------------
// Free Exercise DB
// ---------------------------------------------------------------------------

interface FreeExercise extends Json {
  id: string;
  name: string;
}

let fedbDataset: { data: FreeExercise[]; fetchedAt: number } | null = null;
let fedbInFlight: Promise<FreeExercise[]> | null = null;
let fedbLastFailureAt: number | null = null;

const isFreeExerciseDataset = (value: unknown): value is FreeExercise[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === 'string' &&
      typeof item.id === 'string'
  );

async function getFreeExerciseDataset(): Promise<FreeExercise[]> {
  if (fedbDataset && Date.now() - fedbDataset.fetchedAt < FEDB_DATASET_TTL_MS) {
    return fedbDataset.data;
  }

  if (
    fedbLastFailureAt !== null &&
    Date.now() - fedbLastFailureAt < FEDB_RETRY_INTERVAL_MS
  ) {
    // A stale copy still answers searches; only a cold start has nothing.
    if (fedbDataset) return fedbDataset.data;
    throw new Error(
      'Exercise catalog is unavailable. Try again in a few minutes.'
    );
  }

  if (!fedbInFlight) {
    const current: Promise<FreeExercise[]> = (async () => {
      const response = await fetchWithTimeout(
        `${FREE_EXERCISE_DB_BASE}/dist/exercises.json`,
        { headers: { Accept: 'application/json' } },
        FEDB_TIMEOUT_MS
      );
      if (!response.ok) {
        throw new Error(
          `Exercise catalog request failed (HTTP ${response.status})`
        );
      }
      const data: unknown = await response.json();
      if (!isFreeExerciseDataset(data)) {
        throw new Error('Exercise catalog returned an unexpected response.');
      }
      return data;
    })()
      .then((data) => {
        if (fedbInFlight === current) {
          fedbDataset = { data, fetchedAt: Date.now() };
          fedbLastFailureAt = null;
        }
        return data;
      })
      .catch((error: unknown) => {
        if (fedbInFlight === current) fedbLastFailureAt = Date.now();
        if (fedbDataset) {
          addLog(
            '[LocalCatalog] Serving stale exercise catalog after a refresh failure',
            'WARNING',
            [String(error)]
          );
          return fedbDataset.data;
        }
        throw error;
      })
      .finally(() => {
        if (fedbInFlight === current) fedbInFlight = null;
      });
    fedbInFlight = current;
  }
  return fedbInFlight;
}

/** Images ship as paths relative to the dataset, e.g. `3_4_Sit-Up/0.jpg`. */
const freeExerciseImageUrl = (imagePath: string): string =>
  `${FREE_EXERCISE_DB_BASE}/exercises/${imagePath}`;

/** Equipment is a single string upstream; every other list is already an array. */
const freeExerciseEquipment = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : asStringArray(value);

/** Mirrors the server's `search-external` item mapping for this provider. */
function mapFreeExerciseSearchItem(exercise: FreeExercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    source: 'free-exercise-db',
    category: (exercise.category as string | null) ?? null,
    modality: deriveExerciseModality(exercise.category as string | null),
    calories_per_hour: 0,
    force: (exercise.force as string | null) ?? null,
    level: (exercise.level as string | null) ?? null,
    mechanic: (exercise.mechanic as string | null) ?? null,
    equipment: freeExerciseEquipment(exercise.equipment),
    primary_muscles: asStringArray(exercise.primaryMuscles),
    secondary_muscles: asStringArray(exercise.secondaryMuscles),
    instructions: asStringArray(exercise.instructions),
    images: asStringArray(exercise.images).map(freeExerciseImageUrl),
  };
}

// Approximate MET values by category and level, ported from the server's
// CalorieCalculationService so an imported exercise carries the same estimate.
const MET_VALUES: Record<string, Record<string, number>> = {
  cardio: { beginner: 6.0, intermediate: 7.0, expert: 8.0 },
  strength: { beginner: 4.0, intermediate: 5.0, expert: 6.0 },
  'olympic weightlifting': { beginner: 5.0, intermediate: 6.0, expert: 7.0 },
  powerlifting: { beginner: 5.0, intermediate: 6.0, expert: 7.0 },
  strongman: { beginner: 7.0, intermediate: 8.0, expert: 9.0 },
  plyometrics: { beginner: 6.0, intermediate: 7.0, expert: 8.0 },
  stretching: { beginner: 2.0, intermediate: 2.5, expert: 3.0 },
  default: { beginner: 3.0, intermediate: 3.5, expert: 4.0 },
};

/**
 * The server also applies age and gender adjustments from the user's profile.
 * The local profile has neither (`/api/identity/profiles` returns nulls), so
 * this stops at the weight term rather than inventing a birth date or gender.
 */
function estimateCaloriesPerHour(
  exercise: FreeExercise,
  weightKg: number
): number {
  const category = String(exercise.category ?? 'default').toLowerCase();
  const level = String(exercise.level ?? 'intermediate').toLowerCase();
  const met = Math.max(
    1.0,
    MET_VALUES[category]?.[level] ??
      MET_VALUES.default[level] ??
      MET_VALUES.default.intermediate
  );
  return Math.round(((met * 3.5 * weightKg) / 200) * 60);
}

/** Latest recorded check-in weight, or the server's 70kg default. */
async function latestWeightKg(localFetch: LocalFetch): Promise<number> {
  try {
    const rows = await localFetch<Json[]>(
      '/api/measurements/check-in-measurements-range/1970-01-01/2999-12-31'
    );
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const weight = Number(rows[index]?.weight);
      if (Number.isFinite(weight) && weight > 0) return weight;
    }
  } catch (error) {
    addLog(
      '[LocalCatalog] Could not read weight for calorie estimate',
      'DEBUG',
      [String(error)]
    );
  }
  return 70;
}

/**
 * Import is idempotent, matching the server's `(user_id, source, source_id)`
 * unique index: re-adding an exercise returns the existing local copy.
 *
 * Images stay as upstream URLs. The server downloads them into `/uploads`
 * because its clients reach images through it, but `useExerciseImageSource`
 * hands absolute URLs straight to `expo-image`, so the device loads them
 * directly and nothing has to be copied into the local database.
 */
async function importFreeExercise(
  exerciseId: string,
  localFetch: LocalFetch
): Promise<Json> {
  const existing = await localFetch<{ exercises: Json[] }>('/api/exercises');
  const alreadyImported = existing.exercises.find(
    (row) =>
      row.source === 'free-exercise-db' && String(row.source_id) === exerciseId
  );
  if (alreadyImported) return alreadyImported;

  const dataset = await getFreeExerciseDataset();
  const exercise = dataset.find((row) => row.id === exerciseId);
  if (!exercise) throw new Error('Free Exercise DB exercise not found.');

  const instructions = asStringArray(exercise.instructions);
  const weightKg = await latestWeightKg(localFetch);
  return localFetch<Json>('/api/exercises', 'POST', {
    source: 'free-exercise-db',
    source_id: exerciseId,
    name: exercise.name,
    category: (exercise.category as string | null) ?? null,
    modality: deriveExerciseModality(exercise.category as string | null),
    force: (exercise.force as string | null) ?? null,
    level: (exercise.level as string | null) ?? null,
    mechanic: (exercise.mechanic as string | null) ?? null,
    equipment: freeExerciseEquipment(exercise.equipment),
    primary_muscles: asStringArray(exercise.primaryMuscles),
    secondary_muscles: asStringArray(exercise.secondaryMuscles),
    instructions,
    images: asStringArray(exercise.images).map(freeExerciseImageUrl),
    // Same normalized array the instructions field uses: indexing the raw
    // (possibly bare-string) value would take its first character instead.
    description: instructions[0] ?? exercise.name,
    calories_per_hour: estimateCaloriesPerHour(exercise, weightKg),
    is_custom: true,
    shared_with_public: false,
  });
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

const OFF_FIELDS = [
  'product_name',
  'product_name_en',
  'brands',
  'code',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'product_quantity_unit',
  'nutriments',
  'allergens_tags',
  'traces_tags',
  // Product photos: front image preferred, plain image_url as fallback.
  'image_front_url',
  'image_url',
];

const OFF_CORE_NUTRIENT_100G_KEYS = [
  'energy-kcal_100g',
  'energy-kj_100g',
  'energy_100g',
  'proteins_100g',
  'carbohydrates_100g',
  'fat_100g',
];
const OFF_CORE_NUTRIENT_SERVING_KEYS = [
  'energy-kcal_serving',
  'energy-kj_serving',
  'energy_serving',
  'proteins_serving',
  'carbohydrates_serving',
  'fat_serving',
];

// Search-a-licious treats adjacent free-text and field clauses as required
// terms, so the nutrition filter is appended to the query rather than sent as
// a separate filter — it keeps out products with no usable nutrition at all.
const OFF_CORE_NUTRITION_CLAUSE = `((${OFF_CORE_NUTRIENT_100G_KEYS.map(
  (key) => `nutriments.${key}:*`
).join(
  ' OR '
)}) OR (serving_quantity:[0.000001 TO *] AND (${OFF_CORE_NUTRIENT_SERVING_KEYS.map(
  (key) => `nutriments.${key}:*`
).join(' OR ')})))`;

const SERVING_UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  grm: 'g',
  gm: 'g',
  gram: 'g',
  grams: 'g',
  ml: 'ml',
  milliliter: 'ml',
  millilitre: 'ml',
  milliliters: 'ml',
  millilitres: 'ml',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cup: 'cup',
  cups: 'cup',
  slice: 'slice',
  slices: 'slice',
  portion: 'serving',
  portions: 'serving',
  servings: 'serving',
  serving: 'serving',
  container: 'container',
  containers: 'container',
  package: 'packet',
  packages: 'packet',
  piece: 'piece',
  pieces: 'piece',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  lb: 'lb',
  pound: 'lb',
  pounds: 'lb',
  l: 'l',
  liter: 'l',
  litre: 'l',
  liters: 'l',
  litres: 'l',
  can: 'can',
  cans: 'can',
  bottle: 'bottle',
  bottles: 'bottle',
  packet: 'packet',
  packets: 'packet',
  bag: 'bag',
  bags: 'bag',
  bowl: 'bowl',
  bowls: 'bowl',
  plate: 'plate',
  plates: 'plate',
  handful: 'handful',
  handfuls: 'handful',
  scoop: 'scoop',
  scoops: 'scoop',
  bar: 'bar',
  bars: 'bar',
  stick: 'stick',
  sticks: 'stick',
  whole: 'whole',
};

function normalizeServingUnit(unit: unknown): string {
  if (!unit || typeof unit !== 'string') return 'g';
  // Strip anything in parentheses at the end: "serving (237g)" -> "serving"
  const clean = unit
    .replace(/\s*\([^)]*\)\s*$/i, '')
    .toLowerCase()
    .trim();
  if (SERVING_UNIT_ALIASES[clean]) return SERVING_UNIT_ALIASES[clean];
  // Try first word match (e.g. "cup pieces" -> "cup")
  const firstWord = clean.split(/\s+/)[0];
  if (SERVING_UNIT_ALIASES[firstWord]) return SERVING_UNIT_ALIASES[firstWord];
  return clean;
}

/** UPC-A codes are stored as their 13-digit EAN form. */
const normalizeBarcode = (barcode: string): string =>
  barcode.length === 12 ? `0${barcode}` : barcode;

/**
 * The alternate barcode for EAN/UPC interoperability:
 *   12-digit UPC-A -> 13-digit EAN-13 (prepend '0')
 *   13-digit EAN-13 starting with '0' -> 12-digit UPC-A (strip leading '0')
 */
function altBarcode(barcode: string): string | null {
  if (barcode.length === 12) return `0${barcode}`;
  if (barcode.length === 13 && barcode.startsWith('0')) return barcode.slice(1);
  return null;
}

// Metric units that must never become a household variant — they would just
// duplicate the metric default (e.g. "28 g (28 g)").
const METRIC_SERVING_UNITS = new Set(['g', 'ml', 'kg', 'l', 'oz']);

/**
 * Extracts a household serving (e.g. "2 cookies") from OFF's free-text
 * serving_size when it also states the equivalent metric weight in parentheses,
 * e.g. "2 cookies (28 g)". The parenthetical confirms the household count maps
 * to the same physical serving already computed from serving_quantity, so the
 * household variant can reuse the metric variant's values without rescaling.
 */
function parseOffHouseholdServing(
  servingSize: unknown
): { size: number; unit: string } | null {
  if (typeof servingSize !== 'string') return null;
  const match = servingSize.match(
    /^\s*([\d.,]+)\s+([^\d(][^(]*?)\s*\([^)]*\)\s*$/
  );
  if (!match) return null;
  const size = parseFloat(match[1].replace(',', '.'));
  const unit = normalizeServingUnit(match[2]);
  if (!Number.isFinite(size) || size <= 0 || !unit) return null;
  if (METRIC_SERVING_UNITS.has(unit)) return null;
  return { size, unit };
}

function deriveOffServingUnit(product: Json): string {
  if (product.serving_quantity_unit) {
    return normalizeServingUnit(product.serving_quantity_unit);
  }
  if (product.product_quantity_unit) {
    return normalizeServingUnit(product.product_quantity_unit);
  }
  // Last resort: pull a unit token out of the free-text serving_size string,
  // e.g. "1 portion (330 ml)" or "250 ml".
  if (typeof product.serving_size === 'string') {
    const match = product.serving_size.match(
      /([\d.,]+)\s*(ml|milliliters?|millilitres?|g|grams?|kg|l|liters?|litres?|oz|ounces?)\b/i
    );
    if (match) return normalizeServingUnit(match[2]);
  }
  return 'g';
}

// OpenFoodFacts stores every nutrient's `*_100g` value in grams but exposes the
// label's display unit on `*_unit`. Convert grams to that unit (e.g. magnesium
// 0.018 g -> 18 mg) so matched custom nutrients carry sensible values.
const GRAMS_TO_UNIT: Record<string, number> = {
  g: 1,
  mg: 1000,
  µg: 1000000,
  mcg: 1000000,
  ug: 1000000,
};

// OFF ships several `*_100g` fields that are scores/estimates, not nutrients.
const OFF_NON_NUTRIENT_KEYS = new Set([
  'nova-group',
  'nutrition-score-fr',
  'nutrition-score-uk',
  'fruits-vegetables-nuts',
  'fruits-vegetables-nuts-estimate',
  'fruits-vegetables-nuts-estimate-from-ingredients',
  'fruits-vegetables-legumes-estimate-from-ingredients',
  'carbon-footprint',
  'carbon-footprint-from-known-ingredients',
]);

function parseOffNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** True when OFF declares nutrition the mapper below can actually use. */
function hasUsableOffCoreNutrition(product: Json): boolean {
  const nutriments = product.nutriments;
  if (!isRecord(nutriments)) return false;

  if (
    OFF_CORE_NUTRIENT_100G_KEYS.some(
      (key) => parseOffNumber(nutriments[key]) !== null
    )
  ) {
    return true;
  }

  const servingQuantity = parseOffNumber(product.serving_quantity);
  return (
    servingQuantity !== null &&
    servingQuantity > 0 &&
    OFF_CORE_NUTRIENT_SERVING_KEYS.some(
      (key) => parseOffNumber(nutriments[key]) !== null
    )
  );
}

function getOffNutrient100g(
  nutriments: Json,
  baseKey: string,
  declaredServingQuantity: number | null
): number {
  const direct100g = parseOffNumber(nutriments[`${baseKey}_100g`]);
  if (direct100g !== null) return direct100g;

  if (declaredServingQuantity !== null && declaredServingQuantity > 0) {
    const servingValue = parseOffNumber(nutriments[`${baseKey}_serving`]);
    if (servingValue !== null) {
      return (servingValue / declaredServingQuantity) * 100;
    }
  }
  return 0;
}

function getOffEnergyKcal100g(
  nutriments: Json,
  declaredServingQuantity: number | null
): number {
  const kcal100g = getOffNutrient100g(
    nutriments,
    'energy-kcal',
    declaredServingQuantity
  );
  if (kcal100g > 0) return kcal100g;

  const kj100g = getOffNutrient100g(
    nutriments,
    'energy-kj',
    declaredServingQuantity
  );
  if (kj100g > 0) return kj100g / 4.184;

  // OFF's legacy `energy_100g` field stores kJ (not kcal), regardless of what
  // `energy_unit` says — that field records what the contributor typed in the
  // data-entry form, not the unit of the stored _100g value.
  const energy100g = parseOffNumber(nutriments.energy_100g);
  if (energy100g !== null && energy100g > 0) return energy100g / 4.184;

  if (declaredServingQuantity !== null && declaredServingQuantity > 0) {
    // Same rule applies to `energy_serving`: always kJ.
    const energyServing = parseOffNumber(nutriments.energy_serving);
    if (energyServing !== null && energyServing > 0) {
      return ((energyServing / declaredServingQuantity) * 100) / 4.184;
    }
  }
  return 0;
}

function extractOffProviderNutrients(
  nutriments: Json,
  scale: number,
  declaredServingQuantity: number | null
): { values: Record<string, number>; units: Record<string, string> } {
  const values: Record<string, number> = {};
  const units: Record<string, string> = {};
  const processedBases = new Set<string>();

  for (const key of Object.keys(nutriments)) {
    const is100g = key.endsWith('_100g');
    const isServing = key.endsWith('_serving');
    if (!is100g && !isServing) continue;

    const base = is100g
      ? key.slice(0, -'_100g'.length)
      : key.slice(0, -'_serving'.length);
    if (processedBases.has(base) || OFF_NON_NUTRIENT_KEYS.has(base)) continue;

    let value = parseOffNumber(nutriments[`${base}_100g`]);
    if (
      value === null &&
      isServing &&
      declaredServingQuantity !== null &&
      declaredServingQuantity > 0
    ) {
      const servingValue = parseOffNumber(nutriments[`${base}_serving`]);
      if (servingValue !== null) {
        value = (servingValue / declaredServingQuantity) * 100;
      }
    }
    if (value === null) continue;

    processedBases.add(base);

    const unit = String(nutriments[`${base}_unit`] || '').toLowerCase();
    const factor = GRAMS_TO_UNIT[unit] ?? 1;
    const name = base.replace(/-/g, ' ').trim();
    if (!name) continue;

    values[name] = Math.round(value * factor * scale * 1000) / 1000;
    if (unit) units[name] = normalizeNutrientUnit(unit);
  }
  return { values, units };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Strips OFF's language prefix (`en:milk`), matching the server verbatim. */
function normalizeAllergenTags(tags: unknown): string[] | null {
  const list = asStringArray(tags);
  if (list.length === 0) return null;
  return list.map((tag) => tag.replace(/^[a-z]{2}:/, ''));
}

/**
 * Maps one OFF product into the server's NormalizedFood shape, the contract
 * `_transformNormalizedFood` in `externalFoodSearchApi` already consumes.
 */
function mapOpenFoodFactsProduct(product: Json, autoScale = true): Json {
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {};
  const rawServingQuantity = parseOffNumber(product.serving_quantity);
  const declaredServingQuantity =
    rawServingQuantity !== null && rawServingQuantity > 0
      ? rawServingQuantity
      : null;
  const servingQuantity = declaredServingQuantity ?? 100;
  const servingSize = autoScale ? servingQuantity : 100;
  const scale = servingSize / 100;

  const nutrient = (key: string) =>
    getOffNutrient100g(nutriments, key, declaredServingQuantity);
  const extracted = extractOffProviderNutrients(
    nutriments,
    scale,
    declaredServingQuantity
  );

  const metricVariant: Json = {
    serving_size: servingSize,
    serving_unit: deriveOffServingUnit(product),
    calories: Math.round(
      getOffEnergyKcal100g(nutriments, declaredServingQuantity) * scale
    ),
    protein: round1(nutrient('proteins') * scale),
    carbs: round1(nutrient('carbohydrates') * scale),
    fat: round1(nutrient('fat') * scale),
    saturated_fat: round1(nutrient('saturated-fat') * scale),
    sodium: Math.round(nutrient('sodium') * 1000 * scale),
    dietary_fiber: round1(nutrient('fiber') * scale),
    sugars: round1(nutrient('sugars') * scale),
    polyunsaturated_fat: round1(nutrient('polyunsaturated-fat') * scale),
    monounsaturated_fat: round1(nutrient('monounsaturated-fat') * scale),
    trans_fat: round1(nutrient('trans-fat') * scale),
    cholesterol: Math.round(nutrient('cholesterol') * 1000 * scale),
    potassium: Math.round(nutrient('potassium') * 1000 * scale),
    vitamin_a: Math.round(nutrient('vitamin-a') * 1000000 * scale),
    vitamin_c: round1(nutrient('vitamin-c') * 1000 * scale),
    calcium: Math.round(nutrient('calcium') * 1000 * scale),
    iron: round1(nutrient('iron') * 1000 * scale),
    provider_nutrients: extracted.values,
    provider_nutrient_units: extracted.units,
    is_default: true,
    allergens: normalizeAllergenTags(product.allergens_tags),
    traces: normalizeAllergenTags(product.traces_tags),
  };

  // If OFF states an equivalent household serving (e.g. "2 cookies (28 g)"),
  // surface it as a second, non-default variant so users can log by piece. It
  // describes the SAME physical serving, so it reuses the same nutrients.
  const household = parseOffHouseholdServing(product.serving_size);
  const householdVariant =
    household &&
    !(
      household.size === metricVariant.serving_size &&
      household.unit === metricVariant.serving_unit
    )
      ? {
          ...metricVariant,
          serving_size: household.size,
          serving_unit: household.unit,
          is_default: false,
        }
      : null;

  const code = typeof product.code === 'string' ? product.code : '';
  const brands = typeof product.brands === 'string' ? product.brands : '';

  return {
    name:
      product.product_name_en ||
      product.product_name ||
      // A hit with no usable name is still better identified by its code than
      // by an empty row in the results list.
      code,
    brand: brands.split(',')[0]?.trim() || null,
    barcode: code ? normalizeBarcode(code) : undefined,
    provider_external_id: code,
    provider_type: 'openfoodfacts',
    is_custom: false,
    // Hotlinked: expo-image loads absolute URLs directly.
    image_url:
      (product.image_front_url as string | undefined) ||
      (product.image_url as string | undefined) ||
      null,
    default_variant: metricVariant,
    ...(householdVariant
      ? { variants: [metricVariant, householdVariant] }
      : {}),
  };
}

async function offJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    },
    OFF_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Open Food Facts request failed (HTTP ${response.status})`);
  }
  return response.json();
}

/** Search-a-licious hits already carry the requested fields; `brands` arrives as a list. */
function productFromSearchHit(hit: Json): Json {
  return {
    ...hit,
    brands: Array.isArray(hit.brands) ? hit.brands.join(', ') : hit.brands,
  };
}

async function searchOpenFoodFacts(
  query: string,
  page: number,
  pageSize: number,
  autoScale: boolean
): Promise<{ foods: Json[]; pagination: Json }> {
  if (page * pageSize > OFF_RESULT_WINDOW) {
    throw new Error(
      `Open Food Facts search supports at most ${OFF_RESULT_WINDOW} results`
    );
  }

  const data = await offJson(OFF_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: `${query} ${OFF_CORE_NUTRITION_CLAUSE}`,
      page,
      page_size: pageSize,
      boost_phrase: true,
      langs: ['en'],
      fields: OFF_FIELDS,
    }),
  });

  if (!isRecord(data) || !Array.isArray(data.hits)) {
    throw new Error('Open Food Facts returned an unexpected response.');
  }

  const products = data.hits
    .filter(isRecord)
    .map(productFromSearchHit)
    .filter(hasUsableOffCoreNutrition);

  const resolvedPage = Number(data.page) || page;
  const resolvedPageSize = Number(data.page_size) || pageSize;
  const loadedThrough =
    (resolvedPage - 1) * resolvedPageSize + data.hits.length;
  const nextPageFitsWindow =
    (resolvedPage + 1) * resolvedPageSize <= OFF_RESULT_WINDOW;

  // Search-a-licious reports an inexact count on deep or broad queries; in that
  // case a full page is the only evidence that more exist.
  const pagination =
    data.is_count_exact === false
      ? (() => {
          const hasMore =
            data.hits.length === resolvedPageSize && nextPageFitsWindow;
          return {
            page: resolvedPage,
            pageSize: resolvedPageSize,
            totalCount: loadedThrough + (hasMore ? 1 : 0),
            hasMore,
          };
        })()
      : (() => {
          const totalCount = Math.min(
            typeof data.count === 'number' ? data.count : loadedThrough,
            OFF_RESULT_WINDOW
          );
          return {
            page: resolvedPage,
            pageSize: resolvedPageSize,
            totalCount,
            hasMore:
              resolvedPage * resolvedPageSize < totalCount &&
              nextPageFitsWindow,
          };
        })();

  return {
    foods: products.map((product) =>
      mapOpenFoodFactsProduct(product, autoScale)
    ),
    pagination,
  };
}

/** Product Opener lookup by code, retrying the alternate EAN/UPC form. */
async function fetchOffProduct(code: string): Promise<Json | null> {
  const fields = OFF_FIELDS.join(',');
  const candidates = [code, altBarcode(code)].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  for (const candidate of candidates) {
    const data = await offJson(
      `${OFF_PRODUCT_BASE}/api/v2/product/${encodeURIComponent(
        candidate
      )}.json?fields=${fields}`
    );
    if (isRecord(data) && data.status === 1 && isRecord(data.product)) {
      return data.product;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * Handles the provider-backed endpoints before the request reaches the local
 * database router. These calls are network I/O and must stay outside
 * `localTransaction`, which is a synchronous pass over the whole database and
 * serializes every other read and write behind itself.
 *
 * Returns `undefined` for anything it does not own so the database router — and
 * its explicit "a backend is required" failure — still has the last word.
 */
/**
 * These routes are provider-shaped, so the catalog owns them for every provider
 * and answers an unimplemented one itself. Falling through instead would let
 * the database router reach them by shape — `/api/exercises/search-external`
 * parses as an exercise id — and report "record not found" for what is really
 * an unsupported provider.
 */
function unsupportedProvider(providerType: string): never {
  throw new Error(
    `Local data does not support the ${providerType || 'requested'} provider. A backend is required for this feature.`
  );
}

export async function catalogRoute(
  request: LocalRequest,
  localFetch: LocalFetch
): Promise<LocalResult | undefined> {
  const { path, query, method, body } = request;
  const parts = path.split('/');

  if (path === '/api/exercises/search-external' && method === 'GET') {
    const providerType = query.get('providerType') ?? '';
    if (providerType !== 'free-exercise-db') unsupportedProvider(providerType);
    const page = Math.max(1, Number(query.get('page')) || 1);
    const pageSize = Math.max(1, Number(query.get('pageSize')) || 20);
    const dataset = await getFreeExerciseDataset();
    const matches = filterAndSortByTerms(
      dataset,
      (exercise) => exercise.name,
      query.get('query') ?? ''
    );
    const offset = (page - 1) * pageSize;
    return {
      value: {
        items: matches
          .slice(offset, offset + pageSize)
          .map(mapFreeExerciseSearchItem),
        pagination: {
          page,
          pageSize,
          totalCount: matches.length,
          totalPages: Math.ceil(matches.length / pageSize),
          hasMore: page * pageSize < matches.length,
        },
      },
    };
  }

  if (path === '/api/freeexercisedb/add' && method === 'POST') {
    return {
      value: await importFreeExercise(String(body.exerciseId), localFetch),
    };
  }

  if (path.startsWith('/api/v2/foods/search/') && method === 'GET') {
    if (parts[5] !== 'openfoodfacts') unsupportedProvider(parts[5] ?? '');
    // The caller only sends autoScale when the preference is set; OFF's own
    // default is to scale to the declared serving.
    const autoScale = query.get('autoScale') !== 'false';
    return {
      value: await searchOpenFoodFacts(
        query.get('query') ?? '',
        Math.max(1, Number(query.get('page')) || 1),
        20,
        autoScale
      ),
    };
  }

  if (path.startsWith('/api/v2/foods/details/') && method === 'GET') {
    if (parts[5] !== 'openfoodfacts') unsupportedProvider(parts[5] ?? '');
    const product = await fetchOffProduct(decodeURIComponent(parts[6] ?? ''));
    if (!product) throw new Error('Food not found on Open Food Facts.');
    return { value: mapOpenFoodFactsProduct(product) };
  }

  if (path.startsWith('/api/v2/foods/barcode/') && method === 'GET') {
    const code = decodeURIComponent(parts[5] ?? '');
    // A saved food wins over the provider, mirroring the server: the user's own
    // corrections to a product must survive a rescan.
    const local = await localFetch<Json | null>(
      `/api/foods/by-barcode/${encodeURIComponent(code)}`
    );
    if (local) return { value: { source: 'local', food: local } };

    const product = await fetchOffProduct(code);
    return {
      value: product
        ? { source: 'openfoodfacts', food: mapOpenFoodFactsProduct(product) }
        : { source: 'not_found', food: null },
    };
  }

  return undefined;
}

/** Test seam: the dataset cache is module state that outlives a single test. */
export function resetProviderCatalogCache(): void {
  fedbDataset = null;
  fedbInFlight = null;
  fedbLastFailureAt = null;
}
