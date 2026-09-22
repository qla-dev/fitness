import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import FoodResultRow from './foodSearch/FoodResultRow';
import { OnlineResultRow } from './foodSearch/FoodSearchResultRow';
import { useExternalProviders } from '../hooks/useExternalProviders';
import { useFoods } from '../hooks/useFoods';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { useExternalFoodSearch } from '../hooks/useExternalFoodSearch';
import { usePreferences } from '../hooks/usePreferences';
import { useProviderColor } from '../utils/providerColor';
import { fireSelectionHaptic } from '../services/haptics';
import { fetchExternalFoodDetails } from '../services/api/externalFoodSearchApi';
import { getApiErrorMessage } from '../services/api/errors';
import { externalFoodItemToFoodInfo } from '../types/foodInfo';
import type { FoodInfoItem } from '../types/foodInfo';
import type { ExternalFoodItem } from '../types/externalFoods';

/** How many past foods are offered before a query narrows them. */
const RECENT_FOOD_LIMIT = 12;

/**
 * What the Add tab shows while its search field has focus.
 *
 * Empty, it is what you logged last and what you searched for last — the two
 * shortcuts that make a second visit quicker than the first. With a query it
 * is the results themselves, on this screen: pushing a search screen from a
 * search field replaces the field you just focused with another one.
 *
 * Saved foods first, then the user's default provider underneath — the same
 * two halves the food search has. There is no provider picker here: this is
 * the quick path, and choosing between providers is what the full search
 * screen is for.
 */
export default function AddHubSearchState({
  query,
  recents,
  onPickRecent,
  onClearRecents,
  onRemoveRecent,
  onSelectFood,
}: {
  query: string;
  recents: readonly string[];
  onPickRecent: (query: string) => void;
  onClearRecents: () => void;
  onRemoveRecent: (query: string) => void;
  onSelectFood: (item: FoodInfoItem) => void;
}) {
  const { t } = useTranslation();
  const [textSecondary, accent, favoriteGold] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
    '--color-favorite-gold',
  ]) as string[];

  // One letter is enough here: the field is the screen, so there is nothing
  // else to look at while a threshold waits for a second or third character.
  const { searchResults, isSearching } = useFoodSearch(query, {
    minLength: 1,
  });
  const isSearchActive = query.trim().length > 0;
  const { recentFoods, isLoading: isLoadingRecent } = useFoods();

  // The user's default provider, or their first — the Exercises search resolves
  // its provider the same way, and for the same reason: a picker on a quick
  // path is a decision asked before the results are even in.
  const { providers } = useExternalProviders();
  const { preferences } = usePreferences();
  const provider =
    providers.find((p) => p.id === preferences?.default_food_data_provider_id) ??
    providers[0];
  const getProviderColor = useProviderColor(providers);
  const {
    searchResults: onlineResults,
    isSearching: isOnlineSearching,
    isSearchActive: isOnlineActive,
  } = useExternalFoodSearch(query, provider?.provider_type ?? '', {
    enabled: !!provider,
    providerId: provider?.id,
    autoScale: preferences?.auto_scale_open_food_facts_imports,
    minLength: 1,
  });

  const select = (item: FoodInfoItem) => {
    fireSelectionHaptic();
    onSelectFood(item);
  };

  // Which online row is fetching its full nutrition, so it can show a spinner
  // in place rather than the screen going quiet after a tap.
  const [loadingId, setLoadingId] = useState<string | null>(null);

  /**
   * A provider result carries only what the search returned, so the full
   * nutrition is fetched before the entry screen opens. The serving the row
   * displayed is passed back in, or the detail view silently switches to the
   * provider's default one; the image is re-attached because the details
   * endpoint does not always echo it.
   */
  const selectOnline = async (item: ExternalFoodItem, providerId?: string) => {
    fireSelectionHaptic();
    setLoadingId(item.id);
    try {
      const detailed = await fetchExternalFoodDetails(
        item.source,
        item.id,
        providerId,
        {
          serving_size: item.serving_size,
          serving_unit: item.serving_unit,
          serving_description: item.serving_description,
        }
      );
      onSelectFood(
        externalFoodItemToFoodInfo({
          ...detailed,
          images: detailed.images?.length ? detailed.images : item.images,
          image_url: detailed.image_url ?? item.image_url,
          image_source_url: detailed.image_source_url ?? item.image_source_url,
        })
      );
    } catch (error) {
      const message =
        getApiErrorMessage(error) ??
        t('foodSearch.errors.loadNutritionDetails', {
          defaultValue: "Couldn't load full nutrition details.",
        });
      Toast.show({
        type: 'error',
        text1: t('foodSearch.errors.detailsUnavailable', {
          defaultValue: 'Details unavailable',
        }),
        text2: message,
      });
      // Opened anyway, on what the search row already knew: a missing detail
      // fetch is not a reason to refuse to log the food.
      onSelectFood(externalFoodItemToFoodInfo(item));
    } finally {
      setLoadingId(null);
    }
  };

  if (isSearchActive) {
    const nothingYet =
      searchResults.length === 0 && onlineResults.length === 0;
    // Both halves debounce, and neither reports pending during the gap between
    // the keystroke and its fetch. "No results" is only true once the online
    // half has actually run and both have gone quiet — until then it is a
    // loader, not an answer.
    const settled = isOnlineActive && !isSearching && !isOnlineSearching;

    if (nothingYet && !settled) {
      return (
        // The heading stays put while the rows are on their way, so the list
        // fills in under a section that was already there rather than the
        // whole block appearing at once.
        <View className="flex-1">
          <Text className="text-text-secondary text-xs font-semibold uppercase mb-2 px-1">
            {t('addHub.onlineDatabase', { defaultValue: 'Online database' })}
          </Text>
          {/* Centred in what is left between the heading and the field at the
              bottom, rather than tucked under the heading with the rest of the
              screen empty below it. */}
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="small" color={accent} />
            <Text className="text-text-secondary text-base text-center">
              {t('addHub.searching', {
                defaultValue: 'Searching for food and meals',
              })}
            </Text>
          </View>
        </View>
      );
    }

    if (nothingYet && settled) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-secondary text-base text-center">
            {t('addHub.noResults', {
              defaultValue: 'Nothing matches “{{query}}”.',
              query: query.trim(),
            })}
          </Text>
        </View>
      );
    }

    return (
      <>
        {searchResults.length > 0 ? (
          <View>
            <Text className="text-text-secondary text-xs font-semibold uppercase mb-2 px-1">
              {t('addHub.savedFoods', { defaultValue: 'My food' })}
            </Text>
            <View className="bg-surface rounded-2xl overflow-hidden">
              {searchResults.map((item) => (
                <FoodResultRow
                  key={item.id}
                  item={item}
                  isFavorite={false}
                  favoriteGold={favoriteGold}
                  onSelect={select}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* The provider's own results, under the user's saved ones: what you
            already have is what you most likely meant. */}
        {isOnlineActive && provider ? (
          <View className={searchResults.length > 0 ? 'mt-3' : undefined}>
            <Text className="text-text-secondary text-xs font-semibold uppercase mb-2 px-1">
              {/* Not the provider's brand: what the heading has to say is
                  that these rows are not the user's own saved foods. */}
              {t('addHub.onlineDatabase', { defaultValue: 'Online database' })}
            </Text>
            {onlineResults.length === 0 && isOnlineSearching ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={accent} />
              </View>
            ) : (
              <View className="bg-surface rounded-2xl overflow-hidden">
                {onlineResults.map((item) => (
                  <OnlineResultRow
                    key={`${item.source}-${item.id}`}
                    item={item}
                    providerId={provider.id}
                    accentColor={accent}
                    loadingFoodId={loadingId}
                    getProviderColor={getProviderColor}
                    onSelect={selectOnline}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      {recents.length > 0 ? (
        <View>
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-text-secondary text-xs font-semibold uppercase">
              {t('addHub.recent', { defaultValue: 'Recent searches' })}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                fireSelectionHaptic();
                onClearRecents();
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: accent }}>
                {t('addHub.clearRecent', { defaultValue: 'Clear' })}
              </Text>
            </Pressable>
          </View>
          <View className="bg-surface rounded-2xl overflow-hidden">
            {recents.map((item, index) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={item}
                onPress={() => {
                  fireSelectionHaptic();
                  onPickRecent(item);
                }}
                className={`flex-row items-center px-4 py-3 gap-3 ${
                  index > 0 ? 'border-t border-border-subtle' : ''
                }`}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="history" size={17} color={textSecondary} />
                <Text
                  className="flex-1 text-text-primary text-base"
                  numberOfLines={1}
                >
                  {item}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('addHub.removeRecent', {
                    defaultValue: 'Remove {{query}} from recent searches',
                    query: item,
                  })}
                  hitSlop={10}
                  onPress={() => onRemoveRecent(item)}
                >
                  <Icon name="close" size={15} color={textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className={recents.length > 0 ? 'mt-3' : undefined}>
        <Text className="text-text-secondary text-xs font-semibold uppercase mb-2 px-1">
          {t('addHub.recentFoods', { defaultValue: 'Recently logged' })}
        </Text>
        {isLoadingRecent ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" color={accent} />
          </View>
        ) : recentFoods.length === 0 ? (
          <Text className="text-text-secondary text-sm px-1">
            {t('addHub.noRecentFoods', {
              defaultValue: 'Foods you log will show up here.',
            })}
          </Text>
        ) : (
          <View className="bg-surface rounded-2xl overflow-hidden">
            {recentFoods.slice(0, RECENT_FOOD_LIMIT).map((item) => (
              <FoodResultRow
                key={item.id}
                item={item}
                isFavorite={false}
                favoriteGold={favoriteGold}
                onSelect={select}
              />
            ))}
          </View>
        )}
      </View>
    </>
  );
}
