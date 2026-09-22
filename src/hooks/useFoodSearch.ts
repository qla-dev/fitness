import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchFoods } from '../services/api/foodsApi';
import { foodSearchQueryKey } from './queryKeys';
import { useDebounce } from './useDebounce';

export function useFoodSearch(
  searchText: string,
  options?: { enabled?: boolean; minLength?: number }
) {
  const { enabled = true, minLength = 2 } = options ?? {};
  const debouncedSearch = useDebounce(searchText.trim(), 300);
  const isSearchActive = debouncedSearch.length >= minLength;

  const query = useQuery({
    queryKey: foodSearchQueryKey(debouncedSearch),
    queryFn: () => searchFoods(debouncedSearch),
    enabled: isSearchActive && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: keepPreviousData,
  });

  return {
    searchResults: query.data?.foods ?? [],
    isSearching: query.isFetching,
    isSearchActive,
    isSearchError: query.isError,
  };
}
