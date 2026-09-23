import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { SearchBarCommands } from 'react-native-screens';
import { useCSSVariable } from 'uniwind';

import Icon, { type IconName } from '../components/Icon';
import LibrarySearchBar from '../components/LibrarySearchBar';
import AddHubSearchState from '../components/AddHubSearchState';
import NativePromptSheet from '../components/ui/NativePromptSheet';
import PillInput from '../components/ui/PillInput';
import FoodResultRow from '../components/foodSearch/FoodResultRow';
import { useFoods } from '../hooks/useFoods';
import { useAddActions } from '../components/AddActionsContext';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useTabPress } from '../hooks/useTabPress';
import { useScrollTopOffset } from '../hooks/useScrollTopOffset';
import { isLocalDataMode } from '../services/dataMode';
import { useCycleMode } from '../hooks';
import { fireSelectionHaptic } from '../services/haptics';
import {
  clearRecentSearches,
  getRecentSearches,
  loadRecentSearches,
  recordRecentSearch,
  removeRecentSearch,
  subscribeRecentSearches,
} from '../services/recentSearches';
import { CARD_GAP } from '../constants/layout';
import { withAlpha } from '../utils/colors';
import type { FoodInfoItem } from '../types/foodInfo';
import type { RootStackParamList } from '../types/navigation';

/** The height every row on this screen shares, drawn or built. */
const ROW_HEIGHT = 56;

/** How many past foods the landing offers before you have to search. */
const LANDING_RECENT_LIMIT = 5;

/** One of the headline actions, drawn as a card. */
interface HeadlineAction {
  key: string;
  label: string;
  icon: IconName;
  tint: string;
  onPress: () => void;
}

/** One of the rows under them. */
interface SecondaryAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/**
 * The Add tab, as a screen.
 *
 * It used to be a bottom sheet. On iOS 26 this tab holds the bar's search slot
 * (`role: 'search'`), which the system turns into a search field when the tab
 * is opened — but only if the press is allowed through to a screen. The sheet
 * intercepted it, so the slot was wasted on a button.
 *
 * Typing logs food, which is what the tab is for and what the field is asked
 * for most; the rest of what the sheet offered is here as cards and rows, in
 * the same order.
 */
export default function AddHubScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  // What the keyboard covers, so the centred search states are centred in the
  // part of the screen you can actually see rather than behind it.
  const keyboardHeight = useKeyboardState((state) => state.height);
  const usesNativeTabs = useNativeIOSTabsActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('tabs');
  const actions = useAddActions();
  const [query, setQuery] = useState('');
  // The field's focus, which is what swaps the actions for the search. Typing
  // counts as searching too, so a restored query does not show the actions.
  const [searchOpen, setSearchOpen] = useState(false);
  // Typing a barcode is a sheet on this screen, not a screen of its own: a
  // route would still be standing there after you cancelled it.
  const [typeCodeOpen, setTypeCodeOpen] = useState(false);
  const [typedCode, setTypedCode] = useState('');
  // The native field, so the cards that mean "find something" can put the
  // cursor in it rather than opening another screen with another field.
  const searchBar = useRef<SearchBarCommands>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { scrollToTop, onScroll, onScrollBeginDrag } =
    useScrollTopOffset();
  // Re-tapping the active tab returns to the top, like every other tab.
  useTabPress(navigation, () =>
    scrollToTop(scrollRef.current)
  );
  // Flipped by state rather than by calling focus() from the card's handler:
  // that handler lives in an array the render maps over, and a closure reading
  // a ref from there is what the refs rule is there to catch.
  const focusSearch = useCallback(() => setSearchOpen(true), []);
  const searching = searchOpen || query.trim().length > 0;

  const openFood = useCallback(
    (item: FoodInfoItem) => {
      // Picking a result is what makes a query worth keeping — more so than
      // pressing the keyboard's search key, which most people never do because
      // the results are already there by the time they have finished typing.
      void recordRecentSearch(query);
      navigation.navigate('FoodEntryAdd', { item });
    },
    [navigation, query]
  );
  const {
    enabled: cycleEnabled,
    mode: cycleMode,
    discreetMode: cycleDiscreet,
  } = useCycleMode();
  const cycleLabel = cycleDiscreet
    ? t('addSheet.wellness', { defaultValue: 'Wellness' })
    : cycleMode === 'pregnant' || cycleMode === 'postpartum'
      ? t('addSheet.logPregnancyEntry', { defaultValue: 'Log Pregnancy Entry' })
      : t('addSheet.logCycle', { defaultValue: 'Log Cycle' });

  // The landing's own shortcut: what you logged last, without searching for
  // it again. The same list the focused state shows, capped shorter because
  // here it sits under six cards rather than filling the screen.
  const { recentFoods } = useFoods();
  const [green, blue, orange, pink, textSecondary, accent, favoriteGold] =
    useCSSVariable([
    '--color-cat-green',
    '--color-cat-blue',
    '--color-cat-orange',
    '--color-cat-pink',
    '--color-text-secondary',
    '--color-accent-primary',
    '--color-favorite-gold',
  ]) as string[];

  const recents = useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearches
  );
  useEffect(() => {
    void loadRecentSearches();
  }, []);
  useEffect(() => {
    if (searchOpen) searchBar.current?.focus();
  }, [searchOpen]);

  // Recording happens on submit rather than on every keystroke: a recents list
  // full of the prefixes of one word is not a list of what you searched for.
  // It does not navigate — the results are already on this screen.
  const submit = useCallback((text: string) => {
    void recordRecentSearch(text);
  }, []);

  // The search field is the navigation bar's own, not a box in the content.
  // A search-role tab is turned into the field by UIKit, and it can only do
  // that for a bar that actually declares one — which is what this is. The
  // in-content field below is the Android / pre-26 stand-in.
  // One header for both states — the app's transparent variant, with the title
  // in the bar. Mixing in large titles or a kept navigation bar each fixed one
  // thing and broke the layout somewhere else.
  const header = useScreenHeader({
    variant: 'transparent',
    title: searching
      ? t('addHub.searchTitle', { defaultValue: 'Log food for today' })
      : t('addHub.title', { defaultValue: 'Food dashboard' }),
    // Sparky on the left, still a placeholder; the profile on the right, where
    // every other tab header keeps it.
    left: {
      kind: 'icon',
      sfSymbol: 'sparkles',
      ionicon: 'sparkles',
      accessibilityLabel: t('addSheet.askSparky', {
        defaultValue: 'Ask Sparky',
      }),
      onPress: () => {},
    },
    right: {
      kind: 'icon',
      sfSymbol: 'person.crop.circle',
      ionicon: 'person-circle-outline',
      accessibilityLabel: t('profile.title', { defaultValue: 'Profile' }),
      onPress: () => navigation.navigate('Profile'),
    },
    nativeOptions: {
      // Set here rather than through `nativeTitle`: on the transparent variant
      // that prop makes the hook render the title itself, as a React element,
      // and a JS title view takes the place of the native one — which is what
      // took the scroll edge effect with it. A plain string leaves the bar
      // native, and the edge effect is the bar's to draw.
      title: searching
        ? t('addHub.searchTitle', { defaultValue: 'Log food for today' })
        : t('addHub.title', { defaultValue: 'Food dashboard' }),
      // The screen-level option, which the library keeps for compatibility.
      // The supported path is `ScrollViewMarker`, but its native component is
      // not in the current binary — it needs a prebuild and a rebuild, not a
      // new dependency. See the note above the render.
      scrollEdgeEffects: {
        top: 'soft',
        bottom: 'automatic',
        left: 'automatic',
        right: 'automatic',
      },
      headerSearchBarOptions: {
        ref: searchBar,
        placeholder: t('addHub.searchPlaceholder', {
          defaultValue: 'Search food or meals',
        }),
        // Kept on screen while the list scrolls: it is the reason the tab
        // exists, not a control you go looking for.
        hideWhenScrolling: false,
        autoCapitalize: 'none',
        onFocus: () => setSearchOpen(true),
        onClose: () => {
          setSearchOpen(false);
          setQuery('');
        },
        onCancelButtonPress: () => {
          setSearchOpen(false);
          setQuery('');
        },
        onChangeText: (event: { nativeEvent: { text: string } }) =>
          setQuery(event.nativeEvent.text),
        onSearchButtonPress: (event: { nativeEvent: { text: string } }) =>
          submit(event.nativeEvent.text),
      },
    },
  });

  // Six ways in, each its own card: logging a food and logging a saved meal
  // are different lists, and a barcode you cannot scan is a different action
  // from pointing a camera at one. Workouts are not here — this screen is the
  // food dashboard, and exercise has the Activities tab.
  const headline: HeadlineAction[] = [
    {
      key: 'food',
      label: t('addHub.logFoodOrMeal', { defaultValue: 'Log food' }),
      icon: 'food',
      tint: green,
      onPress: focusSearch,
    },
    {
      key: 'ai',
      label: t('addHub.aiHelp', { defaultValue: 'AI help' }),
      icon: 'sparkles',
      tint: pink,
      onPress: actions.aiMealScan,
    },
    {
      key: 'scan',
      label: t('addHub.scanCode', { defaultValue: 'Scan code' }),
      icon: 'scan',
      tint: blue,
      onPress: actions.barcodeScan,
    },
    {
      key: 'type',
      label: t('addHub.typeCode', { defaultValue: 'Type code' }),
      icon: 'pencil',
      tint: blue,
      onPress: () => setTypeCodeOpen(true),
    },
    {
      key: 'grocery',
      label: t('addHub.groceryLists', { defaultValue: 'My lists' }),
      icon: 'cart',
      tint: green,
      onPress: actions.groceryList,
    },
    {
      key: 'plans',
      label: t('addHub.mealPlans', { defaultValue: 'My plans' }),
      icon: 'calendar',
      tint: orange,
      onPress: actions.mealPlans,
    },
  ];

  const secondary: SecondaryAction[] = [
    {
      key: 'new-food',
      label: t('addHub.newFood', { defaultValue: 'Create food' }),
      icon: 'add-circle',
      onPress: actions.newFood,
    },
    {
      key: 'new-meal',
      label: t('addHub.newMeal', { defaultValue: 'Create meal' }),
      icon: 'add-circle',
      onPress: actions.newMeal,
    },
    {
      key: 'new-grocery',
      label: t('addHub.newGroceryList', {
        defaultValue: 'Create grocery list',
      }),
      icon: 'add-circle',
      onPress: actions.newGroceryList,
    },
    {
      key: 'new-plan',
      label: t('addHub.newMealPlan', { defaultValue: 'Create meal plan' }),
      icon: 'add-circle',
      onPress: actions.newMealPlan,
    },
    // Server-dependent rows stay behind the same check the sheet used, so a
    // local build does not offer a row that cannot do anything.
    ...(isLocalDataMode() || !cycleEnabled
      ? []
      : [
          {
            key: 'cycle',
            label: cycleLabel,
            icon: 'wellness-filled' as IconName,
            onPress: actions.openCycle,
          },
        ]),
    ...(isLocalDataMode()
      ? []
      : [
          {
            key: 'sparky',
            label: t('addSheet.askSparky', { defaultValue: 'Ask Sparky' }),
            icon: 'sparkles' as IconName,
            onPress: actions.askSparky,
          },
          {
            key: 'sync',
            label: t('addSheet.syncHealth', {
              defaultValue: 'Sync Health Data',
            }),
            icon: 'sync' as IconName,
            onPress: actions.syncHealthData,
          },
        ]),
  ];

  const renderCard = (action: HeadlineAction) => (
    <Pressable
      key={action.key}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => {
        fireSelectionHaptic();
        action.onPress();
      }}
      className="flex-1 bg-surface rounded-2xl items-start p-3.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        className="rounded-xl items-center justify-center mb-2.5"
        style={{
          width: 40,
          height: 40,
          backgroundColor: withAlpha(action.tint, 0.14),
        }}
      >
        <Icon name={action.icon} size={20} color={action.tint} />
      </View>
      <Text
        // The same size and weight the rows below use: a card and a row are
        // both one action with a name, and two type styles made them read as
        // two kinds of thing.
        className="text-text-primary text-base font-semibold"
        numberOfLines={2}
        style={{ lineHeight: 20 }}
      >
        {action.label}
      </Text>
    </Pressable>
  );

  const renderRow = (action: SecondaryAction) => (
    <Pressable
      key={action.key}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => {
        fireSelectionHaptic();
        action.onPress();
      }}
      className="flex-row items-center bg-surface rounded-2xl px-4 gap-3"
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={action.icon} size={20} color={accent} />
      <Text className="flex-1 text-text-primary text-base font-semibold">
        {action.label}
      </Text>
      <Icon name="chevron-forward" size={12} color={textSecondary} />
    </Pressable>
  );

  // Three states, one screen. Idle it is the list of things you can add;
  // focused it is what you searched for before; typing it is the results.
  // Searching used to push FoodSearch, which meant the field you had just
  // focused was replaced by another one on another screen.
  const content = (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      // Without this, scrollTo cannot reach the top of a scroll view whose
      // inset is the automatic one: RN clamps a programmatic offset against
      // the EXPLICIT contentInset, which is zero here, so every negative y —
      // and the real top is negative — was silently pinned to 0.
      scrollToOverflowEnabled
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior={usesNativeTabs ? "automatic" : "never"}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom:
          Math.max(insets.bottom, keyboardHeight) + 32 + activeWorkoutBarPadding,
        gap: CARD_GAP,
        // Content shorter than the screen still fills it, which is what lets
        // the search's loader and its empty state centre themselves in the
        // room between the heading and the field at the bottom.
        flexGrow: 1,
      }}
    >
      {usesNativeTabs ? null : (
        <LibrarySearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('addHub.searchPlaceholder', {
            defaultValue: 'Search food or meals',
          })}
          onFocus={() => setSearchOpen(true)}
          onSubmitEditing={() => void recordRecentSearch(query)}
        />
      )}

      {searching ? (
        <AddHubSearchState
          query={query}
          recents={recents}
          onPickRecent={(item) => setQuery(item)}
          onClearRecents={() => void clearRecentSearches()}
          onRemoveRecent={(item) => void removeRecentSearch(item)}
          onSelectFood={openFood}
        />
      ) : (
        <>
          {/* Two rows of three rather than one long list: six equal ways in,
              and a grid reads as a set of choices where rows read as a
              ranking. */}
          <View className="flex-row" style={{ gap: CARD_GAP }}>
            {headline.slice(0, 3).map(renderCard)}
          </View>
          <View className="flex-row" style={{ gap: CARD_GAP }}>
            {headline.slice(3).map(renderCard)}
          </View>
          <View style={{ gap: CARD_GAP }}>{secondary.map(renderRow)}</View>

          {recentFoods.length > 0 ? (
            <View>
              <Text className="text-text-secondary text-xs font-semibold uppercase mb-2 px-1">
                {t('addHub.recentFoods', { defaultValue: 'Recently logged' })}
              </Text>
              <View className="bg-surface rounded-2xl overflow-hidden">
                {recentFoods.slice(0, LANDING_RECENT_LIMIT).map((item) => (
                  <FoodResultRow
                    key={item.id}
                    item={item}
                    isFavorite={false}
                    favoriteGold={favoriteGold}
                    onSelect={openFood}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  // No wrapper on the native path: the screen-level scroll edge effect is
  // resolved by a finder that only walks subviews[0] down from the screen,
  // so anything between it and the list makes the effect vanish without a word
  // (software-mansion/react-native-screens#4369). The background moved to the
  // stack's contentStyle so nothing has to sit in between.
  const typeCodeSheet = typeCodeOpen ? (
    <NativePromptSheet
      open
      onClose={() => {
        setTypeCodeOpen(false);
        setTypedCode('');
      }}
      hasTextInput
      dismissOnBackdropPress={false}
      title={t('addHub.typeCodeTitle', { defaultValue: 'Type barcode' })}
      description={t('addHub.typeCodeHint', {
        defaultValue:
          'Enter the barcode digits and the food is looked up the same way a scan would be.',
      })}
      footerLabel={t('foodScan.manual.lookup', { defaultValue: 'Look Up' })}
      footerDisabled={typedCode.trim().length === 0}
      onFooterPress={() => {
        const code = typedCode.trim();
        setTypeCodeOpen(false);
        setTypedCode('');
        if (code) actions.typeBarcode(code);
      }}
    >
      <PillInput
        InputComponent={BottomSheetTextInput}
        autoFocus
        accessibilityLabel={t('foodScan.manual.placeholder', {
          defaultValue: 'Barcode number',
        })}
        value={typedCode}
        onChangeText={setTypedCode}
        keyboardType="number-pad"
        maxLength={14}
      />
    </NativePromptSheet>
  ) : null;

  if (usesNativeTabs) {
    return (
      <>
        {content}
        {typeCodeSheet}
      </>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}
      {content}
      {typeCodeSheet}
    </View>
  );
}
