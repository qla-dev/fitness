import { useQuery } from '@tanstack/react-query';
import {
  fetchNutritionTrends,
  type NutritionTrendPoint,
} from '../services/api/reportsApi';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import { nutritionTrendsQueryKey } from './queryKeys';
import { getTodayDate, addDays } from '../utils/dateUtils';
import { RANGE_DAYS, type HealthTrendDateRange } from '../types/healthTrends';

/**
 * Nutrition plots the same windows as every other trend, so it uses the same
 * vocabulary rather than a parallel one that happened to hold the same values.
 * Kept as an alias because the name is used widely across the nutrient screens.
 */
export type TrendRange = HealthTrendDateRange;

const DEFAULT_NUTRIENT_VALUES = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  saturated_fat: 0,
  polyunsaturated_fat: 0,
  monounsaturated_fat: 0,
  trans_fat: 0,
  cholesterol: 0,
  sodium: 0,
  potassium: 0,
  dietary_fiber: 0,
  sugars: 0,
  vitamin_a: 0,
  vitamin_c: 0,
  calcium: 0,
  iron: 0,
};

interface UseNutritionTrendsOptions {
  range: TrendRange;
  enabled?: boolean;
}

export function useNutritionTrends({
  range,
  enabled = true,
}: UseNutritionTrendsOptions) {
  const today = getTodayDate();
  const days = RANGE_DAYS[range];
  const startDate = addDays(today, -(days - 1));

  const query = useQuery({
    queryKey: nutritionTrendsQueryKey(startDate, today),
    queryFn: () => fetchNutritionTrends(startDate, today),
    enabled,
    select: (data: NutritionTrendPoint[]) => {
      const dataByDate = new Map<string, NutritionTrendPoint>();
      const extraKeys = new Set<string>();

      for (const item of data) {
        if (item && item.date) {
          dataByDate.set(item.date, item);
          for (const key of Object.keys(item)) {
            if (key !== 'date') {
              extraKeys.add(key);
            }
          }
        }
      }

      const filledData: NutritionTrendPoint[] = [];
      for (let i = 0; i < days; i++) {
        const day = addDays(today, -(days - 1 - i));
        const existing = dataByDate.get(day);

        if (existing) {
          filledData.push(existing);
        } else {
          const defaultPoint: NutritionTrendPoint = {
            date: day,
            ...DEFAULT_NUTRIENT_VALUES,
          };
          for (const key of extraKeys) {
            if (!(key in defaultPoint)) {
              defaultPoint[key] = 0;
            }
          }
          filledData.push(defaultPoint);
        }
      }

      return filledData;
    },
  });

  useRefetchOnFocus(query.refetch, enabled);

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
