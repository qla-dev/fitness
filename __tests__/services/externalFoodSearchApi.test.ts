import { apiFetch } from '../../src/services/api/apiClient';
import {
  _transformOpenFoodFactsProduct as transformOpenFoodFactsProduct,
  _searchOpenFoodFacts as searchOpenFoodFacts,
  _transformUsdaFoodItem as transformUsdaFoodItem,
  _searchUsda as searchUsda,
  _parseFatSecretDescription as parseFatSecretDescription,
  _transformFatSecretSearchItem as transformFatSecretSearchItem,
  _selectFatSecretServing as selectFatSecretServing,
  _searchFatSecret as searchFatSecret,
  _fetchFatSecretNutrients as fetchFatSecretNutrients,
  _lookupBarcode as lookupBarcode,
  _hasMetricServing as hasMetricServing,
  _transformFatSecretServing as transformFatSecretServing,
  _transformMealieItem as transformMealieItem,
  _searchMealie as searchMealie,
  scanNutritionLabel,
  _transformNormalizedFood as transformNormalizedFood,
  searchExternalFoods,
  fetchExternalFoodDetails,
  lookupBarcodeV2,
  estimateFoodPhoto,
  FoodPhotoEstimateError,
} from '../../src/services/api/externalFoodSearchApi';
import {
  getActiveServerConfig,
  ServerConfig,
} from '../../src/services/storage';

jest.mock('../../src/services/api/apiClient', () => ({
  ...jest.requireActual('../../src/services/api/apiClient'),
  apiFetch: jest.fn(),
}));

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage')
    .proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<
  typeof getActiveServerConfig
>;

describe('externalFoodSearchApi', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('transformOpenFoodFactsProduct', () => {
    test('transforms a complete product', () => {
      const product = {
        product_name: 'Peanut Butter',
        brands: 'Jif',
        code: '12345',
        nutriments: {
          'energy-kcal_100g': 588.5,
          proteins_100g: 25.1,
          carbohydrates_100g: 19.8,
          fat_100g: 50.3,
          'saturated-fat_100g': 10.2,
          sodium_100g: 0.43,
          fiber_100g: 6.1,
          sugars_100g: 9.7,
        },
      };

      const result = transformOpenFoodFactsProduct(product);

      expect(result).toEqual({
        id: '12345',
        name: 'Peanut Butter',
        brand: 'Jif',
        calories: 589,
        protein: 25,
        carbs: 20,
        fat: 50,
        saturated_fat: 10,
        sodium: 430,
        fiber: 6,
        sugars: 10,
        serving_size: 100,
        serving_unit: 'g',
        source: 'openfoodfacts',
      });
    });

    test('handles missing optional fields', () => {
      const product = {
        product_name: 'Mystery Food',
        code: '99999',
        nutriments: {},
      };

      const result = transformOpenFoodFactsProduct(product);

      expect(result).toEqual({
        id: '99999',
        name: 'Mystery Food',
        brand: null,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        saturated_fat: 0,
        sodium: 0,
        fiber: 0,
        sugars: 0,
        serving_size: 100,
        serving_unit: 'g',
        source: 'openfoodfacts',
      });
    });

    test('rounds nutriment values', () => {
      const product = {
        product_name: 'Test',
        code: '1',
        nutriments: {
          'energy-kcal_100g': 123.456,
          proteins_100g: 7.89,
          carbohydrates_100g: 45.123,
          fat_100g: 2.999,
        },
      };

      const result = transformOpenFoodFactsProduct(product);

      expect(result.calories).toBe(123);
      expect(result.protein).toBe(8);
      expect(result.carbs).toBe(45);
      expect(result.fat).toBe(3);
    });
  });

  describe('searchOpenFoodFacts', () => {
    test('returns items and pagination from response', async () => {
      jest.mocked(apiFetch).mockResolvedValue({
        products: [
          {
            product_name: 'Banana',
            brands: 'Chiquita',
            code: 'abc',
            nutriments: { 'energy-kcal_100g': 89 },
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalCount: 1,
          hasMore: false,
        },
      });

      const result = await searchOpenFoodFacts('banana');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Banana');
      expect(result.items[0].brand).toBe('Chiquita');
      expect(result.items[0].calories).toBe(89);
      expect(result.items[0].source).toBe('openfoodfacts');
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalCount: 1,
        hasMore: false,
      });
    });

    test('filters out products with falsy product_name', async () => {
      jest.mocked(apiFetch).mockResolvedValue({
        products: [
          { product_name: 'Good Food', code: '1', nutriments: {} },
          { product_name: '', code: '2', nutriments: {} },
          { product_name: 'Also Good', code: '3', nutriments: {} },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalCount: 3,
          hasMore: false,
        },
      });

      const result = await searchOpenFoodFacts('food');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Good Food');
      expect(result.items[1].name).toBe('Also Good');
    });
  });

  describe('USDA', () => {
    describe('transformUsdaFoodItem', () => {
      test('transforms a complete item', () => {
        const item = {
          fdcId: 12345,
          description: 'Blueberries, raw',
          brandOwner: 'Nature Brand',
          foodNutrients: [
            {
              nutrientId: 1008,
              nutrientName: 'Energy',
              unitName: 'KCAL',
              value: 57.2,
            },
            {
              nutrientId: 1003,
              nutrientName: 'Protein',
              unitName: 'G',
              value: 0.74,
            },
            {
              nutrientId: 1004,
              nutrientName: 'Total lipid (fat)',
              unitName: 'G',
              value: 0.33,
            },
            {
              nutrientId: 1005,
              nutrientName: 'Carbohydrate',
              unitName: 'G',
              value: 14.49,
            },
            {
              nutrientId: 2000,
              nutrientName: 'Sugars',
              unitName: 'G',
              value: 9.96,
            },
            {
              nutrientId: 1093,
              nutrientName: 'Sodium',
              unitName: 'MG',
              value: 1.0,
            },
            {
              nutrientId: 1079,
              nutrientName: 'Fiber',
              unitName: 'G',
              value: 2.4,
            },
            {
              nutrientId: 1258,
              nutrientName: 'Saturated fatty acids',
              unitName: 'G',
              value: 0.028,
            },
          ],
        };

        const result = transformUsdaFoodItem(item);

        expect(result).toEqual({
          id: '12345',
          name: 'Blueberries, raw',
          brand: 'Nature Brand',
          calories: 57,
          protein: 1,
          carbs: 14,
          fat: 0,
          saturated_fat: 0,
          sodium: 1,
          fiber: 2,
          sugars: 10,
          serving_size: 100,
          serving_unit: 'g',
          source: 'usda',
        });
      });

      test('defaults missing nutrients to 0', () => {
        const item = {
          fdcId: 99999,
          description: 'Mystery Food',
          foodNutrients: [],
        };

        const result = transformUsdaFoodItem(item);

        expect(result.calories).toBe(0);
        expect(result.protein).toBe(0);
        expect(result.carbs).toBe(0);
        expect(result.fat).toBe(0);
        expect(result.brand).toBeNull();
      });

      test('rounds nutrient values', () => {
        const item = {
          fdcId: 1,
          description: 'Test',
          foodNutrients: [
            {
              nutrientId: 1008,
              nutrientName: 'Energy',
              unitName: 'KCAL',
              value: 123.456,
            },
            {
              nutrientId: 1003,
              nutrientName: 'Protein',
              unitName: 'G',
              value: 7.89,
            },
          ],
        };

        const result = transformUsdaFoodItem(item);

        expect(result.calories).toBe(123);
        expect(result.protein).toBe(8);
      });

      test('converts fdcId to string', () => {
        const item = {
          fdcId: 42,
          description: 'Test',
          foodNutrients: [],
        };

        expect(transformUsdaFoodItem(item).id).toBe('42');
      });

      test('title-cases ALL CAPS name and brand', () => {
        const item = {
          fdcId: 1,
          description: 'CHICKEN BREAST, GRILLED',
          brandOwner: 'TYSON FOODS INC.',
          foodNutrients: [],
        };

        const result = transformUsdaFoodItem(item);

        expect(result.name).toBe('Chicken Breast, Grilled');
        expect(result.brand).toBe('Tyson Foods Inc.');
      });

      test('preserves mixed-case name and brand', () => {
        const item = {
          fdcId: 1,
          description: 'Blueberries, raw',
          brandOwner: 'Nature Brand',
          foodNutrients: [],
        };

        const result = transformUsdaFoodItem(item);

        expect(result.name).toBe('Blueberries, raw');
        expect(result.brand).toBe('Nature Brand');
      });
    });

    describe('searchUsda', () => {
      test('returns items and pagination from response', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: [
            {
              fdcId: 100,
              description: 'Banana, raw',
              brandOwner: 'Fresh Farms',
              foodNutrients: [
                {
                  nutrientId: 1008,
                  nutrientName: 'Energy',
                  unitName: 'KCAL',
                  value: 89,
                },
              ],
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 1,
            hasMore: false,
          },
        });

        const result = await searchUsda('banana', 'provider-1');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Banana, raw');
        expect(result.items[0].brand).toBe('Fresh Farms');
        expect(result.items[0].calories).toBe(89);
        expect(result.items[0].source).toBe('usda');
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 20,
          totalCount: 1,
          hasMore: false,
        });
      });

      test('filters out items with empty description', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: [
            { fdcId: 1, description: 'Good Food', foodNutrients: [] },
            { fdcId: 2, description: '', foodNutrients: [] },
            { fdcId: 3, description: 'Also Good', foodNutrients: [] },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 3,
            hasMore: false,
          },
        });

        const result = await searchUsda('food', 'provider-1');

        expect(result.items).toHaveLength(2);
        expect(result.items[0].name).toBe('Good Food');
        expect(result.items[1].name).toBe('Also Good');
      });
    });
  });

  describe('FatSecret', () => {
    describe('parseFatSecretDescription', () => {
      test('parses a standard description string', () => {
        const result = parseFatSecretDescription(
          'Per 246g - Calories: 627kcal | Fat: 24.67g | Carbs: 101.62g | Protein: 4.53g'
        );

        expect(result).toEqual({
          calories: 627,
          fat: 25,
          carbs: 102,
          protein: 5,
          servingSize: 246,
          servingUnit: 'g',
        });
      });

      test('parses small values', () => {
        const result = parseFatSecretDescription(
          'Per 10g - Calories: 5kcal | Fat: 0.1g | Carbs: 0.9g | Protein: 0.2g'
        );

        expect(result.calories).toBe(5);
        expect(result.fat).toBe(0);
        expect(result.carbs).toBe(1);
        expect(result.protein).toBe(0);
        expect(result.servingSize).toBe(10);
      });

      test('returns defaults for unparseable input', () => {
        const result = parseFatSecretDescription('No useful info here');

        expect(result).toEqual({
          calories: 0,
          fat: 0,
          carbs: 0,
          protein: 0,
          servingSize: 100,
          servingUnit: 'g',
        });
      });

      test('handles missing fields with partial match', () => {
        const result = parseFatSecretDescription(
          'Per 50g - Calories: 100kcal | Fat: 5g'
        );

        expect(result.calories).toBe(100);
        expect(result.fat).toBe(5);
        expect(result.carbs).toBe(0);
        expect(result.protein).toBe(0);
        expect(result.servingSize).toBe(50);
      });

      test('handles non-gram units', () => {
        const result = parseFatSecretDescription(
          'Per 250ml - Calories: 120kcal | Fat: 3g | Carbs: 20g | Protein: 5g'
        );

        expect(result.servingSize).toBe(250);
        expect(result.servingUnit).toBe('ml');
      });
    });

    describe('transformFatSecretSearchItem', () => {
      test('maps search item correctly', () => {
        const item = {
          food_id: '12345',
          food_name: 'Fried Rice',
          food_description:
            'Per 246g - Calories: 627kcal | Fat: 24.67g | Carbs: 101.62g | Protein: 4.53g',
        };

        const result = transformFatSecretSearchItem(item);

        expect(result.id).toBe('12345');
        expect(result.name).toBe('Fried Rice');
        expect(result.brand).toBeNull();
        expect(result.source).toBe('fatsecret');
        expect(result.calories).toBe(627);
        expect(result.serving_size).toBe(246);
        expect(result.serving_unit).toBe('g');
      });
    });

    describe('selectFatSecretServing', () => {
      test('prefers serving with "serving" in measurement_description', () => {
        const servings = [
          {
            serving_id: '1',
            serving_description: '100g',
            measurement_description: '100 g',
            calories: '100',
            protein: '5',
            carbohydrate: '10',
            fat: '3',
          },
          {
            serving_id: '2',
            serving_description: '1 serving (200g)',
            measurement_description: '1 serving',
            calories: '200',
            protein: '10',
            carbohydrate: '20',
            fat: '6',
          },
        ];

        const result = selectFatSecretServing(servings as any);
        expect(result.serving_id).toBe('2');
      });

      test('falls back to first serving when no "serving" match', () => {
        const servings = [
          {
            serving_id: '1',
            serving_description: '100g',
            measurement_description: '100 g',
            calories: '100',
            protein: '5',
            carbohydrate: '10',
            fat: '3',
          },
          {
            serving_id: '2',
            serving_description: '1 cup',
            measurement_description: 'cup',
            calories: '250',
            protein: '12',
            carbohydrate: '25',
            fat: '8',
          },
        ];

        const result = selectFatSecretServing(servings as any);
        expect(result.serving_id).toBe('1');
      });
    });

    describe('searchFatSecret', () => {
      test('returns items and pagination from response', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: {
            food: [
              {
                food_id: '1',
                food_name: 'Fried Rice',
                food_description:
                  'Per 246g - Calories: 627kcal | Fat: 24.67g | Carbs: 101.62g | Protein: 4.53g',
              },
              {
                food_id: '2',
                food_name: '',
                food_description: 'Per 100g - Calories: 100kcal',
              },
            ],
          },
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 2,
            hasMore: false,
          },
        });

        const result = await searchFatSecret('rice', 'provider-fs');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Fried Rice');
        expect(result.items[0].source).toBe('fatsecret');
        expect(result.items[0].calories).toBe(627);
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 20,
          totalCount: 2,
          hasMore: false,
        });
      });

      test('handles single food object (not array)', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: {
            food: {
              food_id: '1',
              food_name: 'Solo Result',
              food_description:
                'Per 100g - Calories: 200kcal | Fat: 10g | Carbs: 20g | Protein: 15g',
            },
          },
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 1,
            hasMore: false,
          },
        });

        const result = await searchFatSecret('solo', 'provider-fs');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Solo Result');
      });

      test('returns empty items when foods.food is missing (no matches)', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: {},
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            hasMore: false,
          },
        });

        const result = await searchFatSecret('nonexistent', 'provider-fs');

        expect(result.items).toEqual([]);
      });

      test('returns empty items when foods is missing', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            hasMore: false,
          },
        });

        const result = await searchFatSecret('nonexistent', 'provider-fs');

        expect(result.items).toEqual([]);
      });
    });

    describe('fetchFatSecretNutrients', () => {
      test('selects preferred serving and rounds string values', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          food: {
            food_id: '42',
            food_name: 'Pasta',
            servings: {
              serving: [
                {
                  serving_id: '1',
                  serving_description: '100g',
                  measurement_description: '100 g',
                  metric_serving_amount: '100.00',
                  metric_serving_unit: 'g',
                  calories: '157.50',
                  protein: '5.76',
                  carbohydrate: '30.86',
                  fat: '0.93',
                  saturated_fat: '0.18',
                  sodium: '1.00',
                  fiber: '1.80',
                  sugar: '0.56',
                },
                {
                  serving_id: '2',
                  serving_description: '1 serving (140g)',
                  measurement_description: '1 serving',
                  metric_serving_amount: '140.00',
                  metric_serving_unit: 'g',
                  calories: '220.50',
                  protein: '8.06',
                  carbohydrate: '43.20',
                  fat: '1.30',
                  saturated_fat: '0.25',
                  sodium: '1.40',
                  fiber: '2.52',
                  sugar: '0.78',
                },
              ],
            },
          },
        });

        const result = await fetchFatSecretNutrients('42', 'provider-fs');

        expect(result.id).toBe('42');
        expect(result.name).toBe('Pasta');
        expect(result.calories).toBe(221);
        expect(result.protein).toBe(8);
        expect(result.carbs).toBe(43);
        expect(result.fat).toBe(1);
        expect(result.saturated_fat).toBe(0);
        expect(result.sodium).toBe(1);
        expect(result.fiber).toBe(3);
        expect(result.sugars).toBe(1);
        expect(result.serving_size).toBe(140);
        expect(result.serving_unit).toBe('g');
        expect(result.source).toBe('fatsecret');
        expect(result.brand).toBeNull();
      });

      test('handles single serving (not array)', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          food: {
            food_id: '99',
            food_name: 'Simple Food',
            servings: {
              serving: {
                serving_id: '1',
                serving_description: '1 serving',
                measurement_description: 'serving',
                metric_serving_amount: '200.00',
                metric_serving_unit: 'g',
                calories: '300',
                protein: '10',
                carbohydrate: '40',
                fat: '12',
              },
            },
          },
        });

        const result = await fetchFatSecretNutrients('99', 'provider-fs');

        expect(result.id).toBe('99');
        expect(result.calories).toBe(300);
        expect(result.serving_size).toBe(200);
        expect(result.saturated_fat).toBe(0);
        expect(result.sodium).toBe(0);
      });

      test('sodium is not multiplied (already in mg)', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          food: {
            food_id: '55',
            food_name: 'Salty Snack',
            servings: {
              serving: {
                serving_id: '1',
                serving_description: '1 serving',
                measurement_description: 'serving',
                metric_serving_amount: '30.00',
                metric_serving_unit: 'g',
                calories: '150',
                protein: '2',
                carbohydrate: '18',
                fat: '8',
                sodium: '480',
              },
            },
          },
        });

        const result = await fetchFatSecretNutrients('55', 'provider-fs');

        expect(result.sodium).toBe(480);
      });
    });

    test('fetchFatSecretNutrients falls back to raw values when no metric servings exist', async () => {
      jest.mocked(apiFetch).mockResolvedValue({
        food: {
          food_id: '77',
          food_name: 'Non-metric Food',
          servings: {
            serving: {
              serving_id: '1',
              serving_description: '1 cup',
              measurement_description: 'cup',
              // No metric_serving_amount or metric_serving_unit
              calories: '250.5',
              protein: '12.3',
              carbohydrate: '30.7',
              fat: '8.9',
              saturated_fat: '2.1',
              sodium: '350',
              fiber: '4.6',
              sugar: '5.8',
            },
          },
        },
      });

      const result = await fetchFatSecretNutrients('77', 'provider-fs');

      expect(result.id).toBe('77');
      expect(result.name).toBe('Non-metric Food');
      // Fallback: serving_size=1, serving_unit='serving'
      expect(result.serving_size).toBe(1);
      expect(result.serving_unit).toBe('serving');
      expect(result.calories).toBe(251);
      expect(result.protein).toBe(12);
      expect(result.carbs).toBe(31);
      expect(result.fat).toBe(9);
      expect(result.saturated_fat).toBe(2);
      expect(result.sodium).toBe(350);
      expect(result.fiber).toBe(5);
      expect(result.sugars).toBe(6);
      expect(result.variants).toBeUndefined();
    });

    describe('hasMetricServing', () => {
      test('returns true when both metric_serving_amount and metric_serving_unit present', () => {
        const serving = {
          serving_id: '1',
          serving_description: '100g',
          measurement_description: '100 g',
          metric_serving_amount: '100.00',
          metric_serving_unit: 'g',
          calories: '100',
          protein: '5',
          carbohydrate: '10',
          fat: '3',
        };

        expect(hasMetricServing(serving as any)).toBe(true);
      });

      test('returns false when metric_serving_amount missing', () => {
        const serving = {
          serving_id: '1',
          serving_description: '100g',
          measurement_description: '100 g',
          metric_serving_unit: 'g',
          calories: '100',
          protein: '5',
          carbohydrate: '10',
          fat: '3',
        };

        expect(hasMetricServing(serving as any)).toBe(false);
      });

      test('returns false when metric_serving_unit missing', () => {
        const serving = {
          serving_id: '1',
          serving_description: '100g',
          measurement_description: '100 g',
          metric_serving_amount: '100.00',
          calories: '100',
          protein: '5',
          carbohydrate: '10',
          fat: '3',
        };

        expect(hasMetricServing(serving as any)).toBe(false);
      });

      test('returns false when both missing', () => {
        const serving = {
          serving_id: '1',
          serving_description: '100g',
          measurement_description: '100 g',
          calories: '100',
          protein: '5',
          carbohydrate: '10',
          fat: '3',
        };

        expect(hasMetricServing(serving as any)).toBe(false);
      });
    });

    describe('transformFatSecretServing', () => {
      test('transforms a complete serving with all fields', () => {
        const serving = {
          serving_id: '1',
          serving_description: '1 serving (140g)',
          measurement_description: '1 serving',
          metric_serving_amount: '140.00',
          metric_serving_unit: 'g',
          calories: '220.50',
          protein: '8.06',
          carbohydrate: '43.20',
          fat: '1.30',
          saturated_fat: '0.25',
          sodium: '320.00',
          fiber: '2.52',
          sugar: '0.78',
        };

        const result = transformFatSecretServing(serving as any);

        expect(result).toEqual({
          serving_size: 140,
          serving_unit: 'g',
          serving_description: '1 serving (140g)',
          calories: 221,
          protein: 8,
          carbs: 43,
          fat: 1,
          saturated_fat: 0,
          sodium: 320,
          fiber: 3,
          sugars: 1,
        });
      });

      test('rounds all numeric values', () => {
        const serving = {
          serving_id: '1',
          serving_description: 'serving',
          measurement_description: 'serving',
          metric_serving_amount: '99.9',
          metric_serving_unit: 'g',
          calories: '123.456',
          protein: '7.89',
          carbohydrate: '45.123',
          fat: '2.999',
          saturated_fat: '1.1',
          sodium: '50.6',
          fiber: '0.4',
          sugar: '9.5',
        };

        const result = transformFatSecretServing(serving as any);

        expect(result.serving_size).toBe(100);
        expect(result.calories).toBe(123);
        expect(result.protein).toBe(8);
        expect(result.carbs).toBe(45);
        expect(result.fat).toBe(3);
      });

      test('defaults optional fields (saturated_fat, sodium, fiber, sugar) to 0 when missing', () => {
        const serving = {
          serving_id: '1',
          serving_description: '100g',
          measurement_description: '100 g',
          metric_serving_amount: '100.00',
          metric_serving_unit: 'g',
          calories: '200',
          protein: '10',
          carbohydrate: '20',
          fat: '8',
        };

        const result = transformFatSecretServing(serving as any);

        expect(result.saturated_fat).toBe(0);
        expect(result.sodium).toBe(0);
        expect(result.fiber).toBe(0);
        expect(result.sugars).toBe(0);
      });
    });
  });

  describe('lookupBarcode', () => {
    test('returns local source result', async () => {
      const localFood = {
        id: 'food-42',
        name: 'Scanned Food',
        brand: 'Brand X',
        is_custom: false,
        default_variant: {
          serving_size: 100,
          serving_unit: 'g',
          calories: 250,
          protein: 12,
          carbs: 30,
          fat: 8,
        },
      };
      jest
        .mocked(apiFetch)
        .mockResolvedValue({ source: 'local', food: localFood });

      const result = await lookupBarcode('0987654321');

      expect(result.source).toBe('local');
      expect(result.food).toEqual(localFood);
    });

    test('returns not_found result', async () => {
      jest
        .mocked(apiFetch)
        .mockResolvedValue({ source: 'not_found', food: null });

      const result = await lookupBarcode('0000000000');

      expect(result.source).toBe('not_found');
      expect(result.food).toBeNull();
    });
  });

  describe('Mealie', () => {
    describe('transformMealieItem', () => {
      test('transforms a complete item with all optional fields', () => {
        const item = {
          provider_external_id: 'mealie-123',
          name: 'Chicken Soup',
          brand: 'Home Kitchen',
          default_variant: {
            serving_size: 250,
            serving_unit: 'ml',
            calories: 180.6,
            protein: 15.4,
            carbs: 12.3,
            fat: 7.8,
            saturated_fat: 2.1,
            sodium: 450.9,
            dietary_fiber: 1.5,
            sugars: 3.2,
          },
        };

        const result = transformMealieItem(item as any);

        expect(result).toEqual({
          id: 'mealie-123',
          name: 'Chicken Soup',
          brand: 'Home Kitchen',
          calories: 181,
          protein: 15,
          carbs: 12,
          fat: 8,
          saturated_fat: 2,
          sodium: 451,
          fiber: 2,
          sugars: 3,
          serving_size: 250,
          serving_unit: 'ml',
          source: 'mealie',
        });
      });

      test('handles null optional fields (saturated_fat, sodium, dietary_fiber, sugars become undefined in output)', () => {
        const item = {
          provider_external_id: 'mealie-456',
          name: 'Simple Dish',
          brand: null,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 200,
            protein: 10,
            carbs: 25,
            fat: 5,
            saturated_fat: null,
            sodium: null,
            dietary_fiber: null,
            sugars: null,
          },
        };

        const result = transformMealieItem(item as any);

        expect(result.saturated_fat).toBeUndefined();
        expect(result.sodium).toBeUndefined();
        expect(result.fiber).toBeUndefined();
        expect(result.sugars).toBeUndefined();
      });

      test('rounds numeric values', () => {
        const item = {
          provider_external_id: 'mealie-789',
          name: 'Rounded Food',
          brand: null,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 123.456,
            protein: 7.89,
            carbs: 45.123,
            fat: 2.999,
          },
        };

        const result = transformMealieItem(item as any);

        expect(result.calories).toBe(123);
        expect(result.protein).toBe(8);
        expect(result.carbs).toBe(45);
        expect(result.fat).toBe(3);
      });

      test('passes brand through (can be null)', () => {
        const item = {
          provider_external_id: 'mealie-999',
          name: 'Unbranded',
          brand: null,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
          },
        };

        const result = transformMealieItem(item as any);

        expect(result.brand).toBeNull();
      });
    });

    describe('searchMealie', () => {
      test('returns items and pagination', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          items: [
            {
              provider_external_id: 'mealie-1',
              name: 'Tomato Soup',
              brand: null,
              default_variant: {
                serving_size: 250,
                serving_unit: 'ml',
                calories: 90,
                protein: 3,
                carbs: 15,
                fat: 2,
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 1,
            hasMore: false,
          },
        });

        const result = await searchMealie('soup', 'provider-mealie');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Tomato Soup');
        expect(result.items[0].source).toBe('mealie');
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 20,
          totalCount: 1,
          hasMore: false,
        });
      });

      test('filters out items with empty name', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          items: [
            {
              provider_external_id: 'mealie-1',
              name: 'Good Item',
              brand: null,
              default_variant: {
                serving_size: 100,
                serving_unit: 'g',
                calories: 100,
                protein: 5,
                carbs: 10,
                fat: 3,
              },
            },
            {
              provider_external_id: 'mealie-2',
              name: '',
              brand: null,
              default_variant: {
                serving_size: 100,
                serving_unit: 'g',
                calories: 50,
                protein: 2,
                carbs: 5,
                fat: 1,
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 2,
            hasMore: false,
          },
        });

        const result = await searchMealie('food', 'provider-mealie');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Good Item');
      });
    });
  });

  describe('V2 API', () => {
    describe('transformNormalizedFood', () => {
      test('carries the provider photo through to the search row', () => {
        // Regression: provider results rendered a placeholder icon on mobile
        // while web showed the photo. The server sends image_url, but this
        // mapper dropped it — a field this function omits is invisible to the
        // UI no matter what arrived on the wire.
        const food = {
          name: 'Sambar Powder',
          brand: 'MTR',
          is_custom: false,
          image_url: 'https://images.openfoodfacts.org/thumb.jpg',
          image_source_url: 'https://images.openfoodfacts.org/full.jpg',
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
        };

        const result = transformNormalizedFood(food, 'openfoodfacts');

        expect(result.image_url).toBe(
          'https://images.openfoodfacts.org/thumb.jpg'
        );
        expect(result.image_source_url).toBe(
          'https://images.openfoodfacts.org/full.jpg'
        );
      });

      test('flattens default_variant to top-level fields', () => {
        const food = {
          id: 'internal-1',
          name: 'Chicken Breast',
          brand: 'Farm Fresh',
          provider_external_id: 'ext-123',
          provider_type: 'openfoodfacts',
          is_custom: false,
          default_variant: {
            serving_size: 30,
            serving_unit: 'g',
            calories: 50,
            protein: 9,
            carbs: 0,
            fat: 1,
            saturated_fat: 0.3,
            sodium: 25,
            dietary_fiber: 0,
            sugars: 0,
            trans_fat: 0.1,
            cholesterol: 30,
            potassium: 150,
            calcium: 5,
            iron: 0.4,
            vitamin_a: 2,
            vitamin_c: 0,
            is_default: true,
          },
        };

        const result = transformNormalizedFood(food, 'openfoodfacts');

        expect(result).toEqual({
          id: 'ext-123',
          name: 'Chicken Breast',
          brand: 'Farm Fresh',
          image_url: null,
          image_source_url: null,
          images: undefined,
          barcode: undefined,
          provider_type: 'openfoodfacts',
          provider_external_id: 'ext-123',
          is_custom: false,
          calories: 50,
          protein: 9,
          carbs: 0,
          fat: 1,
          saturated_fat: 0.3,
          sodium: 25,
          fiber: 0,
          sugars: 0,
          trans_fat: 0.1,
          cholesterol: 30,
          potassium: 150,
          calcium: 5,
          iron: 0.4,
          vitamin_a: 2,
          vitamin_c: 0,
          serving_size: 30,
          serving_unit: 'g',
          serving_description: '30 g',
          source: 'openfoodfacts',
          provider_verified: false,
          variants: undefined,
        });
      });

      test('maps dietary_fiber to fiber', () => {
        const food = {
          name: 'Oats',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 40,
            serving_unit: 'g',
            calories: 150,
            protein: 5,
            carbs: 27,
            fat: 3,
            dietary_fiber: 4,
            is_default: true,
          },
        };

        const result = transformNormalizedFood(food, 'usda');

        expect(result.fiber).toBe(4);
      });

      test('prefers provider_external_id over id for ExternalFoodItem.id', () => {
        const food = {
          id: 'internal-id',
          name: 'Test',
          brand: null,
          provider_external_id: 'ext-id',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'usda').id).toBe('ext-id');
      });

      test('falls back to food.id when provider_external_id is absent', () => {
        const food = {
          id: 'internal-id',
          name: 'Test',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'usda').id).toBe('internal-id');
      });

      test('falls back to empty string when both id and provider_external_id are absent', () => {
        const food = {
          name: 'Test',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'usda').id).toBe('');
      });

      test('prefers provider_type over providerType argument for source', () => {
        const food = {
          name: 'Test',
          brand: null,
          provider_type: 'openfoodfacts',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'fallback').source).toBe(
          'openfoodfacts'
        );
      });

      test('falls back to providerType argument when provider_type is absent', () => {
        const food = {
          name: 'Test',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'mealie').source).toBe('mealie');
      });

      test('maps variants with serving_description', () => {
        const food = {
          name: 'Pasta',
          brand: null,
          provider_external_id: 'ext-1',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 150,
            protein: 5,
            carbs: 30,
            fat: 1,
            is_default: true,
          },
          variants: [
            {
              serving_size: 200,
              serving_unit: 'g',
              calories: 300,
              protein: 10,
              carbs: 60,
              fat: 2,
              dietary_fiber: 3,
              trans_fat: 0,
              is_default: false,
            },
          ],
        };

        const result = transformNormalizedFood(food, 'fatsecret');

        // default_variant comes first, then the extra variant
        expect(result.variants).toHaveLength(2);
        expect(result.variants![0].serving_description).toBe('100 g');
        expect(result.variants![0].calories).toBe(150);
        expect(result.variants![1].serving_description).toBe('200 g');
        expect(result.variants![1].fiber).toBe(3);
        expect(result.variants![1].trans_fat).toBe(0);
      });

      test('preserves every Yazio serving description with its gram weight', () => {
        const food = {
          name: 'Protein Pudding',
          brand: 'Yazio Brand',
          provider_external_id: 'yazio-pudding',
          provider_type: 'yazio',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            serving_description: '100 g',
            calories: 81,
            protein: 5,
            carbs: 10,
            fat: 2,
            is_default: true,
          },
          variants: [
            {
              serving_size: 100,
              serving_unit: 'g',
              serving_description: '100 g',
              calories: 81,
              protein: 5,
              carbs: 10,
              fat: 2,
              is_default: true,
            },
            {
              serving_size: 1,
              serving_unit: 'serving',
              serving_description: '1 serving (200 g)',
              calories: 162,
              protein: 10,
              carbs: 20,
              fat: 4,
              is_default: false,
            },
            {
              serving_size: 200,
              serving_unit: 'g',
              serving_description: '200 g',
              calories: 162,
              protein: 10,
              carbs: 20,
              fat: 4,
              is_default: false,
            },
            {
              serving_size: 1,
              serving_unit: 'serving',
              serving_description: '1 serving (400 g)',
              calories: 324,
              protein: 20,
              carbs: 40,
              fat: 8,
              is_default: false,
            },
            {
              serving_size: 400,
              serving_unit: 'g',
              serving_description: '400 g',
              calories: 324,
              protein: 20,
              carbs: 40,
              fat: 8,
              is_default: false,
            },
          ],
        };

        const result = transformNormalizedFood(food, 'yazio');

        expect(
          result.variants?.map((variant) => variant.serving_description)
        ).toEqual([
          '1 serving (200 g)',
          '100 g',
          '200 g',
          '1 serving (400 g)',
          '400 g',
        ]);
      });

      test('keeps the search-row serving when a matching variant exists', () => {
        // Regression: a FatSecret row promising "100 g" opened a preview
        // showing "1 small" because the details' default serving won.
        const food = {
          name: 'Pork Chop',
          brand: null,
          provider_external_id: 'fs-1',
          is_custom: false,
          default_variant: {
            serving_size: 1,
            serving_unit: 'small',
            calories: 118,
            protein: 13,
            carbs: 0,
            fat: 7,
            is_default: true,
          },
          variants: [
            {
              serving_size: 1,
              serving_unit: 'small',
              calories: 118,
              protein: 13,
              carbs: 0,
              fat: 7,
              is_default: true,
            },
            {
              serving_size: 1,
              serving_unit: 'medium',
              calories: 197,
              protein: 22,
              carbs: 0,
              fat: 11,
              is_default: false,
            },
            {
              serving_size: 100,
              serving_unit: 'g',
              calories: 231,
              protein: 26,
              carbs: 0,
              fat: 13,
              is_default: false,
            },
          ],
        };

        const result = transformNormalizedFood(food, 'fatsecret', {
          serving_size: 100,
          serving_unit: 'g',
        });

        expect(result.serving_size).toBe(100);
        expect(result.serving_unit).toBe('g');
        expect(result.calories).toBe(231);
        // The provider default stays next in line, still selectable.
        expect(result.variants![0].serving_size).toBe(100);
        expect(result.variants![1].serving_unit).toBe('small');
      });

      test('preferred serving overrides the named-serving swap on a 100g default', () => {
        const food = {
          name: 'Pork Chop',
          brand: null,
          provider_external_id: 'fs-1',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 231,
            protein: 26,
            carbs: 0,
            fat: 13,
            is_default: true,
          },
          variants: [
            {
              serving_size: 1,
              serving_unit: 'small',
              calories: 118,
              protein: 13,
              carbs: 0,
              fat: 7,
              is_default: false,
            },
          ],
        };

        // Without a preferred serving the named-serving heuristic swaps
        // display to the household size; the caller's serving pins it back.
        expect(transformNormalizedFood(food, 'fatsecret').serving_unit).toBe(
          'small'
        );

        const pinned = transformNormalizedFood(food, 'fatsecret', {
          serving_size: 100,
          serving_unit: 'g',
        });
        expect(pinned.serving_size).toBe(100);
        expect(pinned.serving_unit).toBe('g');
        expect(pinned.calories).toBe(231);
      });

      test('puts default_variant first in variants array', () => {
        const defaultVariant = {
          serving_size: 140,
          serving_unit: 'g',
          calories: 220,
          protein: 8,
          carbs: 43,
          fat: 1,
          is_default: true,
        };
        const otherVariant = {
          serving_size: 56,
          serving_unit: 'g',
          calories: 200,
          protein: 7,
          carbs: 42,
          fat: 1,
          is_default: false,
        };
        const food = {
          name: 'Pasta',
          brand: null,
          provider_external_id: 'ext-1',
          is_custom: false,
          default_variant: defaultVariant,
          // Server sends default later in the array
          variants: [otherVariant, defaultVariant],
        };

        const result = transformNormalizedFood(food, 'fatsecret');

        // default_variant must be ext-0 for FoodEntryAddScreen
        expect(result.variants![0].serving_size).toBe(140);
        expect(result.variants![0].calories).toBe(220);
        expect(result.variants![1].serving_size).toBe(56);
      });

      test('includes only default_variant when variants array is empty', () => {
        const food = {
          name: 'Test',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
          variants: [],
        };

        const result = transformNormalizedFood(food, 'usda');
        expect(result.variants).toHaveLength(1);
        expect(result.variants![0].serving_size).toBe(100);
      });

      test('omits variants when variants is undefined', () => {
        const food = {
          name: 'Test',
          brand: null,
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 3,
            is_default: true,
          },
        };

        expect(transformNormalizedFood(food, 'usda').variants).toBeUndefined();
      });

      test('handles optional nutrient fields being undefined', () => {
        const food = {
          name: 'Basic Food',
          brand: null,
          provider_external_id: 'basic-1',
          is_custom: false,
          default_variant: {
            serving_size: 100,
            serving_unit: 'g',
            calories: 200,
            protein: 10,
            carbs: 25,
            fat: 8,
            is_default: true,
          },
        };

        const result = transformNormalizedFood(food, 'usda');

        expect(result.saturated_fat).toBeUndefined();
        expect(result.sodium).toBeUndefined();
        expect(result.fiber).toBeUndefined();
        expect(result.sugars).toBeUndefined();
        expect(result.trans_fat).toBeUndefined();
        expect(result.cholesterol).toBeUndefined();
        expect(result.potassium).toBeUndefined();
        expect(result.calcium).toBeUndefined();
        expect(result.iron).toBeUndefined();
        expect(result.vitamin_a).toBeUndefined();
        expect(result.vitamin_c).toBeUndefined();
      });
    });

    describe('searchExternalFoods', () => {
      test('transforms response foods through transformNormalizedFood', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          foods: [
            {
              name: 'Rice',
              brand: null,
              provider_external_id: 'rice-1',
              provider_type: 'usda',
              is_custom: false,
              default_variant: {
                serving_size: 45,
                serving_unit: 'g',
                calories: 160,
                protein: 3,
                carbs: 36,
                fat: 0,
                dietary_fiber: 1,
                is_default: true,
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 1,
            hasMore: false,
          },
        });

        const result = await searchExternalFoods('usda', 'rice', 1, 'prov-1');

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe('rice-1');
        expect(result.items[0].source).toBe('usda');
        expect(result.items[0].fiber).toBe(1);
        expect(result.items[0].serving_size).toBe(45);
      });
    });

    describe('fetchExternalFoodDetails', () => {
      test('returns transformed ExternalFoodItem', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          name: 'Pasta',
          brand: 'Barilla',
          provider_external_id: '42',
          provider_type: 'fatsecret',
          is_custom: false,
          default_variant: {
            serving_size: 140,
            serving_unit: 'g',
            calories: 220,
            protein: 8,
            carbs: 43,
            fat: 1,
            trans_fat: 0,
            cholesterol: 0,
            is_default: true,
          },
          variants: [
            {
              serving_size: 56,
              serving_unit: 'g',
              calories: 200,
              protein: 7,
              carbs: 42,
              fat: 1,
              is_default: false,
            },
          ],
        });

        const result = await fetchExternalFoodDetails(
          'fatsecret',
          '42',
          'prov-fs'
        );

        expect(result.id).toBe('42');
        expect(result.name).toBe('Pasta');
        expect(result.brand).toBe('Barilla');
        expect(result.source).toBe('fatsecret');
        expect(result.trans_fat).toBe(0);
        // default_variant (140g) first, then the 56g variant
        expect(result.variants).toHaveLength(2);
        expect(result.variants![0].serving_description).toBe('140 g');
        expect(result.variants![1].serving_description).toBe('56 g');
      });
    });

    describe('lookupBarcodeV2', () => {
      test('returns not_found when food is null', async () => {
        jest
          .mocked(apiFetch)
          .mockResolvedValue({ source: 'not_found', food: null });

        const result = await lookupBarcodeV2('0000000000');

        expect(result.source).toBe('not_found');
        expect(result.food).toBeNull();
      });

      test('returns local source with id', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          source: 'local',
          food: {
            id: 'food-42',
            name: 'Local Food',
            brand: 'Brand X',
            barcode: '1234567890',
            is_custom: false,
            default_variant: {
              serving_size: 100,
              serving_unit: 'g',
              calories: 250,
              protein: 12,
              carbs: 30,
              fat: 8,
              trans_fat: 0.5,
              cholesterol: 20,
              is_default: true,
            },
          },
        });

        const result = await lookupBarcodeV2('1234567890');

        expect(result.source).toBe('local');
        expect(result.food!.id).toBe('food-42');
        expect(result.food!.name).toBe('Local Food');
        expect(result.food!.default_variant.trans_fat).toBe(0.5);
      });

      test('returns external source for non-local match', async () => {
        jest.mocked(apiFetch).mockResolvedValue({
          source: 'openfoodfacts',
          food: {
            name: 'External Food',
            brand: null,
            barcode: '9999999999',
            provider_external_id: 'off-abc',
            provider_type: 'openfoodfacts',
            is_custom: false,
            default_variant: {
              serving_size: 30,
              serving_unit: 'g',
              calories: 120,
              protein: 3,
              carbs: 20,
              fat: 4,
              potassium: 80,
              calcium: 15,
              is_default: true,
            },
          },
        });

        const result = await lookupBarcodeV2('9999999999');

        expect(result.source).toBe('openfoodfacts');
        expect(result.food!.name).toBe('External Food');
        expect(result.food!.provider_external_id).toBe('off-abc');
        expect(result.food!.default_variant.potassium).toBe(80);
        expect(result.food!.default_variant.calcium).toBe(15);
      });
    });
  });

  describe('scanNutritionLabel', () => {
    test('returns parsed scan result', async () => {
      const scanResult = {
        name: 'Granola Bar',
        brand: 'Nature Valley',
        serving_size: 42,
        serving_unit: 'g',
        calories: 190,
        protein: 4,
        carbs: 29,
        fat: 7,
        fiber: 2,
        saturated_fat: 1,
        trans_fat: 0,
        sodium: 150,
        sugars: 12,
        cholesterol: 0,
        potassium: 95,
        calcium: 20,
        iron: 1.8,
        vitamin_a: null,
        vitamin_c: null,
      };
      jest.mocked(apiFetch).mockResolvedValue(scanResult);

      const result = await scanNutritionLabel(
        'base64encodedimage==',
        'image/png'
      );

      expect(result).toEqual(scanResult);
    });
  });

  describe('estimateFoodPhoto', () => {
    const testConfig: ServerConfig = {
      id: 'test-id',
      url: 'https://example.com',
      apiKey: 'test-api-key',
    };

    const happyResponse = {
      meal_summary: 'Bowl of yogurt and berries',
      overall_confidence: 'high',
      confidence_reason: 'Clear angle and good lighting.',
      items: [],
      totals: {
        calories_kcal: 320,
        protein_g: 12,
        carbs_g: 40,
        fat_g: 8,
        fiber_g: 5,
        sugar_g: 14,
        total_grams: 250,
      },
      user_weight_reconciliation: '',
      clarifying_questions: [],
    };

    test('POSTs snake_case body to /api/foods/estimate-food-photo and returns parsed estimate', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(happyResponse),
      });

      const result = await estimateFoodPhoto({
        base64Image: 'AAAA',
        mimeType: 'image/jpeg',
        description: 'yogurt and berries',
        totalWeight: 250,
        weightUnit: 'g',
      });

      expect(result).toEqual(happyResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/foods/estimate-food-photo'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            images: [{ image: 'AAAA', mime_type: 'image/jpeg' }],
            description: 'yogurt and berries',
            total_weight: 250,
            weight_unit: 'g',
          }),
        })
      );
    });

    test('omits optional snake_case fields when absent', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(happyResponse),
      });

      await estimateFoodPhoto({ base64Image: 'AAAA', mimeType: 'image/jpeg' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            images: [{ image: 'AAAA', mime_type: 'image/jpeg' }],
          }),
        })
      );
    });

    test('serializes a multi-image images[] payload in request order', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(happyResponse),
      });

      await estimateFoodPhoto({
        images: [
          { base64Image: 'AAAA', mimeType: 'image/jpeg' },
          { base64Image: 'BBBB', mimeType: 'image/png' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            images: [
              { image: 'AAAA', mime_type: 'image/jpeg' },
              { image: 'BBBB', mime_type: 'image/png' },
            ],
          }),
        })
      );
    });

    test.each([
      ['NO_AI_CONFIGURED', 422],
      ['UNSUPPORTED_PROVIDER', 422],
      ['API_KEY_MISSING', 422],
      ['IMAGE_TOO_LARGE', 400],
      ['UNSUPPORTED_MIME_TYPE', 400],
      ['CONTENT_BLOCKED', 422],
      ['PARSE_ERROR', 422],
      ['UPSTREAM_ERROR', 502],
      ['PRIVATE_NETWORK_FORBIDDEN', 403],
      ['TIMEOUT', 504],
      ['INVALID_REQUEST', 400],
    ] as const)(
      'maps server %s to FoodPhotoEstimateError',
      async (code, status) => {
        mockGetActiveServerConfig.mockResolvedValue(testConfig);
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          text: () => Promise.resolve(JSON.stringify({ error: 'msg', code })),
        });

        let caught: unknown;
        try {
          await estimateFoodPhoto({
            base64Image: 'AAAA',
            mimeType: 'image/jpeg',
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).toBeInstanceOf(FoodPhotoEstimateError);
        expect((caught as FoodPhotoEstimateError).code).toBe(code);
        expect((caught as FoodPhotoEstimateError).message).toBe('msg');
      }
    );

    test('non-JSON 500 body falls back to UPSTREAM_ERROR with raw text', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('<!doctype html>upstream barf'),
      });

      let caught: unknown;
      try {
        await estimateFoodPhoto({
          base64Image: 'AAAA',
          mimeType: 'image/jpeg',
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(FoodPhotoEstimateError);
      expect((caught as FoodPhotoEstimateError).code).toBe('UPSTREAM_ERROR');
      expect((caught as FoodPhotoEstimateError).message).toContain(
        'upstream barf'
      );
    });

    test('network error throws FoodPhotoEstimateError UPSTREAM_ERROR', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockRejectedValue(new Error('boom'));

      let caught: unknown;
      try {
        await estimateFoodPhoto({
          base64Image: 'AAAA',
          mimeType: 'image/jpeg',
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(FoodPhotoEstimateError);
      expect((caught as FoodPhotoEstimateError).code).toBe('UPSTREAM_ERROR');
    });
  });
});
