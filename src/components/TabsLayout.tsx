import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCSSVariable } from 'uniwind';
import {
  createIOSNativeHeaderOptions,
  createIOSSmallNativeHeaderOptions,
} from '../utils/nativeHeaderItems';
import DashboardScreen from '../screens/DashboardScreen';
import DiaryScreen from '../screens/DiaryScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ExercisesLibraryScreen from '../screens/ExercisesLibraryScreen';
import type { TabParamList } from '../types/navigation';
import {
  useBottomTabBarHeight,
  type AppleIcon,
} from 'react-native-bottom-tabs';
import { withErrorBoundary } from './ScreenErrorBoundary';
import ActiveWorkoutBar, {
  setActiveWorkoutBarTabBarHeight,
} from './ActiveWorkoutBar';
import CustomTabBar from './CustomTabBar';
import WhatsNewBanner, {
  WhatsNewBannerContent,
  useWhatsNewBannerState,
} from './WhatsNewBanner';
import { AnnouncementModal } from './AnnouncementModal';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useTranslation } from 'react-i18next';
import { fireSelectionHaptic } from '../services/haptics';
import { fireBackNavigationHaptic } from '../utils/backNavigationHaptic';

export const NON_ADD_TABS = [
  'Dashboard',
  'Diary',
  'Library',
  'Exercises',
] as const;
export type NonAddTabName = (typeof NON_ADD_TABS)[number];
const ADD_TAB_ICON: AppleIcon = { sfSymbol: 'plus' };

type TabTrackingProps = {
  rememberActiveTab: (routeName: string) => void;
  getLastActiveTab: () => NonAddTabName;
};

function resolveColor(value: string, fallback: string) {
  return value && value !== 'unset' ? value : fallback;
}

const AddRedirectScreen = ({
  getLastActiveTab,
}: {
  getLastActiveTab: () => NonAddTabName;
}) => {
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      const frame = requestAnimationFrame(() => {
        navigation.navigate(getLastActiveTab() as never);
      });

      return () => cancelAnimationFrame(frame);
    }, [getLastActiveTab, navigation])
  );

  return null;
};

// Tab screens — no Go Back (tab bar provides navigation)
const SafeDashboard = withErrorBoundary(DashboardScreen, 'Dashboard');
const SafeDiary = withErrorBoundary(DiaryScreen, 'Diary');
const SafeLibrary = withErrorBoundary(LibraryScreen, 'Library');
const SafeExercises = withErrorBoundary(ExercisesLibraryScreen, 'Exercises');

// Popping a tab-local screen gives the same selection haptic the root stack
// gives, fired at the start of the pop animation. The iOS native header back
// button is drawn by the OS and has no JS press handler, so the transition is
// the earliest press-time signal available.
const popScreenListeners = ({
  navigation,
}: {
  navigation: { getState: () => { routes: readonly { key: string }[] } };
}) => ({
  transitionStart: (event: { data?: { closing?: boolean }; target?: string }) => {
    if (event.data?.closing)
      fireBackNavigationHaptic(navigation.getState(), event.target);
  },
});

// Native iOS Tab Navigator (iOS 26+ Liquid Glass)
const NativeTab = createNativeBottomTabNavigator<TabParamList>();

// Fallback Tab Navigator (Android / iOS < 26)
const FallbackTab = createBottomTabNavigator<TabParamList>();

type DashboardStackParamList = {
  DashboardRoot: undefined;
};
type DiaryStackParamList = {
  DiaryRoot: { selectedDate?: string } | undefined;
};
type LibraryStackParamList = { LibraryRoot: undefined };
type ExercisesStackParamList = { ExercisesRoot: undefined };

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const DiaryStack = createNativeStackNavigator<DiaryStackParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();
const ExercisesStack = createNativeStackNavigator<ExercisesStackParamList>();

const NativeTabsOverlayContext = React.createContext<ReturnType<
  typeof useWhatsNewBannerState
> | null>(null);

/**
 * iOS native tabs don't expose a `tabBar` render prop, so banners are
 * rendered inside each native tab scene. The library's measured tab-bar
 * height keeps the overlay directly above the native bar on every device.
 */
function NativeTabsBannerOverlay() {
  const whatsNewState = React.useContext(NativeTabsOverlayContext);
  const tabBarHeight = useBottomTabBarHeight();
  React.useEffect(() => {
    setActiveWorkoutBarTabBarHeight(tabBarHeight);
  }, [tabBarHeight]);

  if (!whatsNewState) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: tabBarHeight,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      <WhatsNewBannerContent presentation="glass" state={whatsNewState} />
    </View>
  );
}

function DashboardStackScreen() {
  const { t } = useTranslation();
  const { defaultColor } = useHeaderActionColors();
  const textPrimary = useCSSVariable('--color-text-primary') as string;
  const screenOptions = React.useMemo(
    () => createIOSNativeHeaderOptions(defaultColor, textPrimary),
    [defaultColor, textPrimary]
  );

  return (
    <View className="flex-1">
      <DashboardStack.Navigator screenOptions={screenOptions} screenListeners={popScreenListeners}>
        <DashboardStack.Screen
          name="DashboardRoot"
          component={SafeDashboard as React.ComponentType}
          options={{
            title: t('navigation.dashboard', { defaultValue: 'Dashboard' }),
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </DashboardStack.Navigator>
      <NativeTabsBannerOverlay />
    </View>
  );
}

function DiaryStackScreen() {
  const { t } = useTranslation();
  const { defaultColor } = useHeaderActionColors();
  const textPrimary = useCSSVariable('--color-text-primary') as string;
  const screenOptions = React.useMemo(
    () => createIOSNativeHeaderOptions(defaultColor, textPrimary),
    [defaultColor, textPrimary]
  );

  return (
    <View className="flex-1">
      <DiaryStack.Navigator screenOptions={screenOptions} screenListeners={popScreenListeners}>
        <DiaryStack.Screen
          name="DiaryRoot"
          component={SafeDiary as React.ComponentType}
          options={{
            title: t('navigation.diary', { defaultValue: 'Diary' }),
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </DiaryStack.Navigator>
      <NativeTabsBannerOverlay />
    </View>
  );
}

function LibraryStackScreen() {
  const { t } = useTranslation();
  const { defaultColor } = useHeaderActionColors();
  const textPrimary = useCSSVariable('--color-text-primary') as string;
  const screenOptions = React.useMemo(
    () => createIOSNativeHeaderOptions(defaultColor, textPrimary),
    [defaultColor, textPrimary]
  );

  return (
    <View className="flex-1">
      <LibraryStack.Navigator screenOptions={screenOptions} screenListeners={popScreenListeners}>
        <LibraryStack.Screen
          name="LibraryRoot"
          component={SafeLibrary as React.ComponentType}
          options={{
            title: t('navigation.library', { defaultValue: 'Library' }),
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </LibraryStack.Navigator>
      <NativeTabsBannerOverlay />
    </View>
  );
}

function ExercisesStackScreen() {
  const { t } = useTranslation();
  const { defaultColor } = useHeaderActionColors();
  const textPrimary = useCSSVariable('--color-text-primary') as string;
  // A small (non-large) title, unlike the other tabs. A large title needs the
  // scrolling content to opt into iOS inset adjustment, and this screen pins a
  // search bar above its list, outside the scroll view — under a large title
  // that bar renders at the very top of the screen, above the header. The
  // small header pushes content down instead, so the tab lays out exactly like
  // the same screen pushed from the Library.
  const screenOptions = React.useMemo(
    () => createIOSSmallNativeHeaderOptions(defaultColor, textPrimary),
    [defaultColor, textPrimary]
  );

  return (
    <View className="flex-1">
      <ExercisesStack.Navigator screenOptions={screenOptions} screenListeners={popScreenListeners}>
        <ExercisesStack.Screen
          name="ExercisesRoot"
          component={SafeExercises as React.ComponentType}
          options={{
            title: t('programs.storeTab', { defaultValue: 'Store' }),
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </ExercisesStack.Navigator>
      <NativeTabsBannerOverlay />
    </View>
  );
}

export function NativeTabsLayout({
  onAddPress,
  rememberActiveTab,
  getLastActiveTab,
}: { onAddPress?: () => void } & TabTrackingProps) {
  const { t } = useTranslation();
  const [primary, tabActive, tabInactive] = useCSSVariable([
    '--color-accent-primary',
    '--color-tab-active',
    '--color-tab-inactive',
  ]) as [string, string, string];
  const activeTintColor = resolveColor(
    tabActive,
    resolveColor(primary, '#0A84FF')
  );
  const inactiveTintColor = resolveColor(tabInactive, '#8E8E93');
  const whatsNewState = useWhatsNewBannerState();

  return (
    <NativeTabsOverlayContext.Provider value={whatsNewState}>
      <NativeTab.Navigator
        // Start on the last active tab so toggling the Liquid Glass tab bar —
        // which swaps and remounts this navigator — keeps the user on the tab
        // they came from. Defaults to Dashboard on a cold start.
        initialRouteName={getLastActiveTab()}
        tabBarActiveTintColor={activeTintColor}
        tabBarInactiveTintColor={inactiveTintColor}
        screenListeners={{
          tabPress: () => fireSelectionHaptic(),
          state: (event) => {
            const state = event.data?.state;
            if (!state?.routes) return;
            const route = state.routes[state.index ?? 0];
            if (route) rememberActiveTab(route.name);
          },
        }}
      >
        <NativeTab.Screen
          name="Dashboard"
          component={DashboardStackScreen}
          options={{
            tabBarLabel: t('navigation.dashboard', {
              defaultValue: 'Dashboard',
            }),
            tabBarIcon: () =>
              ({ sfSymbol: 'square.grid.2x2.fill' }) as unknown as AppleIcon,
          }}
        />
        <NativeTab.Screen
          name="Diary"
          component={DiaryStackScreen}
          options={{
            tabBarLabel: t('navigation.diary', { defaultValue: 'Diary' }),
            tabBarIcon: () =>
              ({ sfSymbol: 'book.fill' }) as unknown as AppleIcon,
          }}
        />
        <NativeTab.Screen
          name="Add"
          options={{
            tabBarLabel: t('navigation.add', { defaultValue: 'Add' }),
            tabBarIcon: () => ADD_TAB_ICON,
            role: 'search',
            preventsDefault: true,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              onAddPress?.();
            },
          }}
        >
          {() => <AddRedirectScreen getLastActiveTab={getLastActiveTab} />}
        </NativeTab.Screen>
        <NativeTab.Screen
          name="Library"
          component={LibraryStackScreen}
          options={{
            tabBarLabel: t('navigation.library', { defaultValue: 'Library' }),
            tabBarIcon: () =>
              ({ sfSymbol: 'books.vertical.fill' }) as unknown as AppleIcon,
          }}
        />
        <NativeTab.Screen
          name="Exercises"
          component={ExercisesStackScreen}
          options={{
            tabBarLabel: t('programs.storeTab', { defaultValue: 'Store' }),
            tabBarIcon: () =>
              ({
                sfSymbol: 'figure.strengthtraining.traditional',
              }) as unknown as AppleIcon,
          }}
        />
      </NativeTab.Navigator>
    </NativeTabsOverlayContext.Provider>
  );
}

export function FallbackTabsLayout({
  onAddPress,
  rememberActiveTab,
  getLastActiveTab,
}: { onAddPress?: () => void } & TabTrackingProps) {
  const { t } = useTranslation();
  // The AddSheet is rendered in App.tsx with proper props
  return (
    <FallbackTab.Navigator
      // Start on the last active tab so toggling the Liquid Glass tab bar —
      // which swaps and remounts this navigator — keeps the user on the tab
      // they came from. Defaults to Dashboard on a cold start.
      initialRouteName={getLastActiveTab()}
      screenListeners={{
        state: (event) => {
          const state = event.data?.state;
          if (!state?.routes) return;
          const route = state.routes[state.index ?? 0];
          if (route) rememberActiveTab(route.name);
        },
      }}
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        <View collapsable={false}>
          <WhatsNewBanner reserveAddButtonClearance />
          <ActiveWorkoutBar variant="embedded" />
          <CustomTabBar {...props} />
        </View>
      )}
    >
      <FallbackTab.Screen
        name="Dashboard"
        component={SafeDashboard}
        options={{
          tabBarLabel: t('navigation.dashboard', { defaultValue: 'Dashboard' }),
          tabBarAccessibilityLabel: t('navigation.dashboard', {
            defaultValue: 'Dashboard',
          }),
        }}
      />
      <FallbackTab.Screen
        name="Diary"
        component={SafeDiary}
        options={{
          tabBarLabel: t('navigation.diary', { defaultValue: 'Diary' }),
          tabBarAccessibilityLabel: t('navigation.diary', {
            defaultValue: 'Diary',
          }),
        }}
      />
      <FallbackTab.Screen
        name="Add"
        options={{
          tabBarLabel: t('navigation.add', { defaultValue: 'Add' }),
          tabBarAccessibilityLabel: t('navigation.add', {
            defaultValue: 'Add',
          }),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            onAddPress?.();
          },
        }}
      >
        {() => <AddRedirectScreen getLastActiveTab={getLastActiveTab} />}
      </FallbackTab.Screen>
      <FallbackTab.Screen
        name="Library"
        component={SafeLibrary}
        options={{
          tabBarLabel: t('navigation.library', { defaultValue: 'Library' }),
          tabBarAccessibilityLabel: t('navigation.library', {
            defaultValue: 'Library',
          }),
        }}
      />
      <FallbackTab.Screen
        name="Exercises"
        component={SafeExercises as React.ComponentType}
        options={{
          tabBarLabel: t('programs.storeTab', { defaultValue: 'Store' }),
          tabBarAccessibilityLabel: t('programs.storeTab', {
            defaultValue: 'Store',
          }),
        }}
      />
    </FallbackTab.Navigator>
  );
}

// Native Liquid Glass tabs are only used on iOS 26+. Older iOS releases
// intentionally use the same custom tab bar as Android.
export function TabsLayout({
  onAddPress,
  rememberActiveTab,
  getLastActiveTab,
}: { onAddPress?: () => void } & TabTrackingProps) {
  const tabs = useNativeIOSTabsActive() ? (
    <NativeTabsLayout
      onAddPress={onAddPress}
      rememberActiveTab={rememberActiveTab}
      getLastActiveTab={getLastActiveTab}
    />
  ) : (
    <FallbackTabsLayout
      onAddPress={onAddPress}
      rememberActiveTab={rememberActiveTab}
      getLastActiveTab={getLastActiveTab}
    />
  );

  return (
    <>
      {tabs}
      <AnnouncementModal />
    </>
  );
}
