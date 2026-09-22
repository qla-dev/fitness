import './global.css'
import { useCallback, useEffect, useMemo } from 'react';
import { StatusBar, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { FoodImageSourceProvider } from './src/components/FoodImageSourceProvider';
import { LightboxProvider } from './src/components/LightboxProvider';
import { Uniwind, useUniwind, useCSSVariable } from 'uniwind';

import { queryClient, serverConnectionQueryKey, serverConfigsQueryKey, useSyncHealthData } from './src/hooks';
import { useAppStartup } from './src/hooks/useAppStartup';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useAppLanguageForegroundSync } from './src/hooks/useAppLanguageForegroundSync';
import { useAutoSyncOnOpen } from './src/hooks/useAutoSyncOnOpen';
import { useAddSheetActions } from './src/hooks/useAddSheetActions';

import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import FoodPhotoFlow from './src/components/FoodPhotoFlow';
import {
  SafeOnboarding,
  SafeFoodsLibrary,
  SafeMealsLibrary,
  SafeMealPlans,
  SafeMealPlanForm,
  SafeExercisesLibrary,
  SafeWorkoutPresetsLibrary,
  SafeFoodDetail,
  SafeMealDetail,
  SafeExerciseDetail,
  SafeWorkoutPresetDetail,
  SafeFoodSearch,
  SafeFoodEntryAdd,
  SafeFoodForm,
  SafeEditBarcode,
  SafeExerciseForm,
  SafeWorkoutPresetForm,
  SafeFoodScan,
  SafeFoodPhotoIntro,
  SafeMealAdd,
  SafeFoodEntryView,
  SafeEditLoggedMeal,
  SafeMealTypeDetail,
  SafeExerciseSearch,
  SafePresetSearch,
  SafeWorkoutAdd,
  SafeActivityAdd,
  SafeWorkoutDetail,
  SafeActiveWorkout,
  SafeWorkoutComplete,
  SafeActivityDetail,
  SafeFastingDetail,
  SafeGoalDetail,
  SafeSleepDetail,
  SafeLogs,
  SafeImportHistory,
  SafeMeasurementsAdd,
  SafeProgressPhotos,
  SafeProgressPhotoCompare,
  SafeProgressPhotoTimelapse,
  SafeChat,
  SafeExerciseProgram,
  SafeCart,
  SafeRunOrRide,
  SafeWorkoutSetup,
  SafeProfile,
  SafeProfileEdit,
  SafeProfileGoals,
  SafeMyLogs,
  SafeProfileTheme,
  SafeProfilePremium,
  SafeCalorieSettings,
  SafeMealTypeSettings,
  SafeFoodSettings,
  SafeDashboardSettings,
  SafeHealthTrendsSettings,
  SafeDiarySettings,
  SafeWorkoutSettings,
  SafeServerSettings,
  SafePasskeySettings,
  SafeAppSettings,
  SafeNotificationSettings,
  SafeAbout,
  SafeWhatsNew,
  SafeDailyNutritionDetails,
  SafeDayMeals,
  SafeMacros,
  SafeNutrientTrends,
  SafeFamilyMembers,
  SafeFamilyDiary,
  SafeFamilyMealDetail,
  SafeFamilyCopyReview,
  SafeCycleSettings,
  SafeCycleOnboarding,
  SafeGoalEdit,
  SafeWaterEdit,
  SafeMeasurementEdit,
  SafeSetupWizard,
  SafeActivityHistory,
  SafeAppleHealthCheck,
  SafeCycleHub,
  SafeCycleLogModal,
  SafePregnancySetup,
  SafeMedicationsList,
  SafeMedicationDetail,
  SafeMedicationForm,
  SafeMedicationScheduleForm,
} from './src/navigation/safeScreens';
import ReauthModal from './src/components/ReauthModal';
import ServerConfigModal from './src/components/ServerConfigModal';
import { useAuth } from './src/hooks/useAuth';
import { addLog } from './src/services/LogService';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { FullWindowOverlay } from 'react-native-screens';
import type { RootStackParamList } from './src/types/navigation';
import { AddActionsProvider } from './src/components/AddActionsContext';
import { toastConfig } from './src/components/ui/toastConfig';
import { TabsLayout } from './src/components/TabsLayout';
import { createIOSSmallNativeHeaderOptions } from './src/utils/nativeHeaderItems';
import { useHeaderActionColors } from './src/hooks/useHeaderActionColors';
import { fireBackNavigationHaptic } from './src/utils/backNavigationHaptic';
import ActiveWorkoutBar, {
  navigationRef as rootNavigationRef,
  notifyActiveWorkoutBarStackTransition,
  notifyActiveWorkoutBarSwipeProgress,
} from './src/components/ActiveWorkoutBar';
import { ActiveWorkoutTransitionScreenLayout } from './src/components/ActiveWorkoutTransitionProbe';
import ActiveWorkoutKeepAwake from './src/components/ActiveWorkoutKeepAwake';
import MedicationReminderReconciler from './src/components/MedicationReminderReconciler';
import StartUpProtocol from './src/components/StartUpProtocol';
import { useNativeIOSTabsActive, useNativeIOSHeadersActive } from './src/services/nativeTabBarPreference';
import { useWidgetLanguageRefresh } from './src/hooks/useWidgetLanguageRefresh';
import { useIOSWidgetLanguageRefresh } from './src/hooks/useIOSWidgetLanguageRefresh';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();

const androidModalAnimation =
  Platform.OS === 'android' ? ({ animation: 'slide_from_bottom' } as const) : {};

function AppContent() {
  const { t } = useTranslation();
  const { theme } = useUniwind();
  const {
    showReauthModal, showSetupModal, showApiKeySwitchModal,
    expiredConfigId, switchToApiKeyConfig,
    dismissModal, handleLoginSuccess, handleSwitchToApiKey, handleSwitchToApiKeyDone,
  } = useAuth();

  // Language bootstrap + initial route. `useAppBootstrap` initializes the
  // effective locale (Android 13+ native LocaleManager, Android <=12 local
  // i18next preference) before the app renders, then resolves the first route
  // from the active server config.
  const { initialRoute, linkingEnabled, setLinkingEnabled } = useAppBootstrap();

  // Adopt language changes made outside the app (Android App Languages) when
  // the app returns to the foreground.
  useAppLanguageForegroundSync();

  // Keep the native surfaces (Android Glance widgets, iOS WidgetKit, Workout
  // Live Activity) in sync with the effective app locale. These hooks listen
  // to i18n 'languageChanged' and reload/update the native surfaces without
  // touching any React Native screen strings.
  useWidgetLanguageRefresh();
  useIOSWidgetLanguageRefresh();

  const usesLiquidGlassNavigation = useNativeIOSTabsActive();
  const usesNativeIOSHeaders = useNativeIOSHeadersActive();

  const syncMutation = useSyncHealthData();
  const { shouldYieldObserverSync } = useAutoSyncOnOpen({ initialRoute, syncMutation });
  useAppStartup({ shouldYieldObserverSync });
  const {
    rememberActiveTab,
    getLastActiveTab,
    handleAddFood,
    handleBarcodeScan,
    handleTypeBarcode,
    handleAiMealScan,
    handleLogMeal,
    handleNewFood,
    handleNewMeal,
    handleOpenMealPlans,
    handleNewGroceryList,
    handleNewMealPlan,
    handleOpenGroceryList,
    handleStartWorkout,
    handleLogWorkout,
    handleAddActivity,
    handleAddProgressPhotos,
    handleAskSparky,
    handleOpenCycle,
    handleSyncHealthData,
  } = useAddSheetActions({ syncMutation });

  // The Add tab is a screen inside the tab navigator; these actions are owned
  // up here, because they need the diary date, the draft prompt and the sync
  // mutation. Memoised so the screen does not re-render on every shell render.
  const addActions = useMemo(
    () => ({
      addFood: handleAddFood,
      logMeal: handleLogMeal,
      newFood: handleNewFood,
      newMeal: handleNewMeal,
      mealPlans: handleOpenMealPlans,
      newGroceryList: handleNewGroceryList,
      newMealPlan: handleNewMealPlan,
      barcodeScan: handleBarcodeScan,
      typeBarcode: handleTypeBarcode,
      aiMealScan: handleAiMealScan,
      startWorkout: handleStartWorkout,
      logWorkout: handleLogWorkout,
      addActivity: handleAddActivity,
      groceryList: handleOpenGroceryList,
      progressPhotos: handleAddProgressPhotos,
      askSparky: handleAskSparky,
      openCycle: handleOpenCycle,
      syncHealthData: () => void handleSyncHealthData(),
    }),
    [
      handleAddFood,
      handleBarcodeScan,
      handleTypeBarcode,
      handleAiMealScan,
      handleLogMeal,
      handleNewFood,
      handleNewMeal,
      handleOpenMealPlans,
      handleNewGroceryList,
      handleNewMealPlan,
      handleStartWorkout,
      handleLogWorkout,
      handleAddActivity,
      handleOpenGroceryList,
      handleAddProgressPhotos,
      handleAskSparky,
      handleOpenCycle,
      handleSyncHealthData,
    ]
  );

  const [primary, chromeBorder, bgPrimary, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-chrome-border',
    '--color-background',
    '--color-text-primary',
  ]) as [string, string, string, string];
  const { defaultColor: headerActionColor } = useHeaderActionColors();
  const iosSmallHeaderOptions = useMemo(
    () => createIOSSmallNativeHeaderOptions(headerActionColor, textPrimary),
    [headerActionColor, textPrimary],
  );
  const createStackScreenOptions = useCallback(
    (
      title: string,
      options: NativeStackNavigationOptions = {},
    ): NativeStackNavigationOptions => (
      usesNativeIOSHeaders
        ? {
            ...iosSmallHeaderOptions,
            title,
            gestureEnabled: true,
            ...options,
          }
        : {
            headerShown: false,
            gestureEnabled: true,
            ...options,
          }
    ),
    [iosSmallHeaderOptions, usesNativeIOSHeaders],
  );

  // Determine if we're in dark mode based on current theme
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    try {
      NavigationBar.setStyle(isDarkMode ? 'dark' : 'light');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`[App] Failed to update Android navigation bar style: ${message}`, 'WARNING');
    }
  }, [isDarkMode]);

  const navigationTheme = useMemo<Theme>(() => {
    const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      dark: isDarkMode,
      colors: {
        ...baseTheme.colors,
        primary,
        background: bgPrimary,
        // Native iOS 26 Liquid Glass reads the navigation card color during
        // tab/header transitions. Keep it solid and in-sync with the app
        // background to avoid light-mode flashes/flicker in dark themes.
        card: bgPrimary,
        text: textPrimary,
        border: chromeBorder,
        notification: primary,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' },
        medium: { fontFamily: 'System', fontWeight: '500' },
        bold: { fontFamily: 'System', fontWeight: '600' },
        heavy: { fontFamily: 'System', fontWeight: '700' },
      },
    };
  }, [isDarkMode, primary, bgPrimary, textPrimary, chromeBorder]);

  const linking = useMemo<LinkingOptions<RootStackParamList>>(() => ({
    prefixes: ['sparkyfitnessmobile://'],
    config: {
      initialRouteName: 'Tabs',
      screens: {
        Tabs: {
          screens: {
            Dashboard: '',
            Trends: 'trends',
          },
        },
        FoodScan: 'scan',
        FoodSearch: 'search',
        MyLogs: 'my-logs',
        // Tapping the workout Live Activity opens its associated URL.
        ActiveWorkout: 'active-workout',
      },
    },
  }), []);

  if (!initialRoute) return null;

  return (
    <AddActionsProvider value={addActions}>
    <NavigationContainer
      ref={rootNavigationRef}
      theme={navigationTheme}
      linking={linkingEnabled ? linking : undefined}
      onStateChange={(state) => {
        // Enable deep-link handling once the user has left Onboarding.
        // Without this, widget URLs are ignored for the rest of the session
        // after first-run setup completes.
        if (linkingEnabled) return;
        const topRoute = state?.routes[state.index ?? 0]?.name;
        if (topRoute === 'Tabs') {
          setLinkingEnabled(true);
        }
      }}
    >
      <SafeAreaProvider>
        {/* Inside SafeAreaProvider on purpose: the viewer positions its close
            button against the insets, so mounting it at the app root crashes
            with "No safe area value available". */}
        <LightboxProvider>
        <UniwindInsetsBridge />
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Stack.Navigator
          screenLayout={usesLiquidGlassNavigation
            ? ({ children, route }) => (
              <ActiveWorkoutTransitionScreenLayout routeName={route.name} routeKey={route.key}>
                {children}
              </ActiveWorkoutTransitionScreenLayout>
            )
            : undefined}
          screenListeners={({ navigation: screenNavigation }) => ({
            transitionStart: (event) => {
              const closing = Boolean(event.data?.closing);
              // A push marks its outgoing screen closing too, so the helper
              // reads the navigator state to tell a pop from a push.
              if (closing)
                fireBackNavigationHaptic(screenNavigation.getState(), event.target);
              if (!usesLiquidGlassNavigation) return;
              notifyActiveWorkoutBarStackTransition('start', closing, event.target);
            },
            transitionEnd: (event) => {
              if (!usesLiquidGlassNavigation) return;
              const closing = Boolean(event.data?.closing);
              if (!closing) notifyActiveWorkoutBarSwipeProgress(0);
              notifyActiveWorkoutBarStackTransition('end', closing, event.target);
            },
            gestureCancel: (event) => {
              if (!usesLiquidGlassNavigation) return;
              notifyActiveWorkoutBarSwipeProgress(0);
              notifyActiveWorkoutBarStackTransition('end', false, event.target);
            },
          })}
          screenOptions={{
            headerShown: false,
            animation: 'default',
            contentStyle: { backgroundColor: bgPrimary },
            headerTintColor: Platform.OS === 'android' ? textPrimary : undefined,
          }}
          initialRouteName={initialRoute}
        >
          <Stack.Screen
            name="Onboarding"
            component={SafeOnboarding}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="Tabs" options={{ gestureEnabled: false }}>
            {() => (
              <TabsLayout
                rememberActiveTab={rememberActiveTab}
                getLastActiveTab={getLastActiveTab}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="FamilyMembers"
            component={SafeFamilyMembers}
            options={createStackScreenOptions(t('familyDiary.title', { defaultValue: 'Family Diaries' }), {
              headerBackButtonDisplayMode: 'minimal',
            })}
          />
          <Stack.Screen
            name="FamilyDiary"
            component={SafeFamilyDiary}
            options={({ route }) => createStackScreenOptions(
              route.params.familyUser.displayName.trim() || t('familyDiary.unnamedMember', { defaultValue: 'Family member' }),
              { headerBackButtonDisplayMode: 'minimal' },
            )}
          />
          <Stack.Screen
            name="FamilyMealDetail"
            component={SafeFamilyMealDetail}
            options={({ route }) => createStackScreenOptions(route.params.mealTypeName, {
              headerBackButtonDisplayMode: 'minimal',
            })}
          />
          <Stack.Screen
            name="FamilyCopyReview"
            component={SafeFamilyCopyReview}
            options={createStackScreenOptions(t('familyDiary.copyReview', { defaultValue: 'Review copy' }), {
              headerBackButtonDisplayMode: 'minimal',
            })}
          />
          <Stack.Screen
            name="FoodsLibrary"
            component={SafeFoodsLibrary}
            options={createStackScreenOptions(t('screens.foods', { defaultValue: 'Foods' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MyLogs"
            component={SafeMyLogs}
            options={createStackScreenOptions(t('profile.library.myLogs', { defaultValue: 'My Logs' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealsLibrary"
            component={SafeMealsLibrary}
            options={createStackScreenOptions(t('screens.meals', { defaultValue: 'Meals' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealPlans"
            component={SafeMealPlans}
            options={createStackScreenOptions(t('mealPlans.title', { defaultValue: 'Meal plans' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealPlanForm"
            component={SafeMealPlanForm}
            options={createStackScreenOptions(t('mealPlans.title', { defaultValue: 'Meal plans' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ExercisesLibrary"
            component={SafeExercisesLibrary}
            options={createStackScreenOptions(t('screens.exercises', { defaultValue: 'Exercises' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="WorkoutPresetsLibrary"
            component={SafeWorkoutPresetsLibrary}
            options={createStackScreenOptions(t('screens.workoutPresets', { defaultValue: 'Workout Programs' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="WorkoutPresetDetail"
            component={SafeWorkoutPresetDetail}
            options={({ route }) => createStackScreenOptions(route.params.updatedPreset?.name ?? route.params.preset.name, { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="FoodDetail"
            component={SafeFoodDetail}
            options={({ route }) => createStackScreenOptions(route.params.updatedItem?.name ?? route.params.item.name, { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealDetail"
            component={SafeMealDetail}
            options={createStackScreenOptions(t('screens.meal', { defaultValue: 'Meal' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ExerciseDetail"
            component={SafeExerciseDetail}
            options={({ route }) => createStackScreenOptions(route.params.updatedItem?.name ?? route.params.item.name, {
              headerBackButtonDisplayMode: 'minimal',
              // iOS 26 defaults the pop gesture to full-screen swipes; keep it
              // edge-only here so interior right-swipes switch tabs instead of
              // navigating back.
              fullScreenGestureEnabled: false,
            })}
          />
          <Stack.Screen
            name="FoodSearch"
            component={SafeFoodSearch}
            options={createStackScreenOptions(t('screens.addFood', { defaultValue: 'Add Food' }), {
              headerBackVisible: false,
              // 'modal' (not 'fullScreenModal') so iOS keeps the swipe-down
              // dismiss gesture — UIModalPresentationFullScreen has no
              // interactive dismissal.
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="FoodEntryAdd"
            component={SafeFoodEntryAdd}
            options={({ route }) => createStackScreenOptions(route.params.item.name, {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="FoodForm"
            component={SafeFoodForm}
            options={({ route }) => createStackScreenOptions(
              route.params.mode === 'create-food'
                ? t('screens.newFood', { defaultValue: 'New Food' })
                : route.params.mode === 'edit-food'
                  ? t('screens.editFood', { defaultValue: 'Edit Food' })
                  : t('screens.adjustNutrition', { defaultValue: 'Adjust Nutrition' }),
              {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
              },
            )}
          />
          <Stack.Screen
            name="EditBarcode"
            component={SafeEditBarcode}
            options={createStackScreenOptions(t('screens.barcodes', { defaultValue: 'Barcodes' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ExerciseForm"
            component={SafeExerciseForm}
            options={({ route }) => createStackScreenOptions(
              route.params.mode === 'edit-exercise' ? t('screens.editExercise', { defaultValue: 'Edit Exercise' }) : t('screens.newExercise', { defaultValue: 'New Exercise' }),
              {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
              },
            )}
          />
          <Stack.Screen
            name="WorkoutPresetForm"
            component={SafeWorkoutPresetForm}
            options={({ route }) => createStackScreenOptions(
              route.params.mode === 'edit-preset' ? t('screens.editPreset', { defaultValue: 'Edit Program' }) : t('screens.newPreset', { defaultValue: 'New Program' }),
              {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
              },
            )}
          />
          <Stack.Screen
            name="FoodScan"
            component={SafeFoodScan}
            options={createStackScreenOptions(t('screens.scanFood', { defaultValue: 'Scan Food' }), {
              presentation: 'modal',
              // No native bar at all: the screen draws its own back and
              // flashlight buttons over the preview, and a transparent header
              // on top of them swallowed the taps as well as repeating the
              // title over the camera.
              headerShown: false,
            })}
          />
          <Stack.Screen
            name="FoodPhotoIntro"
            component={SafeFoodPhotoIntro}
            options={createStackScreenOptions(t('screens.photoFood', { defaultValue: 'Photo Food' }), {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="FoodPhotoFlow"
            component={FoodPhotoFlow}
            options={{
              presentation: 'modal',
              headerShown: false,
              gestureEnabled: true,
              ...androidModalAnimation,
            }}
          />
          <Stack.Screen
            name="Chat"
            component={SafeChat}
            options={createStackScreenOptions(t('screens.sparky', { defaultValue: 'Sparky' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealAdd"
            component={SafeMealAdd}
            options={({ route }) => createStackScreenOptions(
              route.params?.mode === 'edit' ? t('screens.editMeal', { defaultValue: 'Edit Meal' }) : t('screens.createMeal', { defaultValue: 'Create Meal' }),
              {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
              },
            )}
          />
          <Stack.Screen
            name="FoodEntryView"
            component={SafeFoodEntryView}
            options={({ route }) => createStackScreenOptions(route.params.entry.food_name ?? t('screens.foodEntry', { defaultValue: 'Food Entry' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="EditLoggedMeal"
            component={SafeEditLoggedMeal}
            options={createStackScreenOptions(t('screens.editMeal', { defaultValue: 'Edit Meal' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealTypeDetail"
            component={SafeMealTypeDetail}
            options={({ route }) => createStackScreenOptions(route.params.mealLabel ?? t('screens.meal', { defaultValue: 'Meal' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="DailyNutritionDetails"
            component={SafeDailyNutritionDetails}
            options={createStackScreenOptions(t('screens.nutritionDetails', { defaultValue: 'Nutrition Details' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="DayMeals"
            component={SafeDayMeals}
            options={createStackScreenOptions(t('screens.dayMeals', { defaultValue: 'Meals' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="Macros"
            component={SafeMacros}
            options={createStackScreenOptions(t('screens.macros', { defaultValue: 'AI' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="NutrientTrends"
            component={SafeNutrientTrends}
            options={createStackScreenOptions(t('screens.trends', { defaultValue: 'Trends' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ExerciseSearch"
            component={SafeExerciseSearch}
            options={createStackScreenOptions(t('screens.selectExercise', { defaultValue: 'Select Exercise' }), {
              presentation: 'modal',
            })}
          />
          <Stack.Screen
            name="PresetSearch"
            component={SafePresetSearch}
            options={createStackScreenOptions(t('screens.startWorkout', { defaultValue: 'Start Workout' }))}
          />
          <Stack.Screen
            name="WorkoutAdd"
            component={SafeWorkoutAdd}
            options={({ route }) => createStackScreenOptions(route.params?.session ? t('screens.editWorkout', { defaultValue: 'Edit Workout' }) : t('screens.newWorkout', { defaultValue: 'New Workout' }))}
          />
          <Stack.Screen
            name="ActivityAdd"
            component={SafeActivityAdd}
            options={({ route }) => createStackScreenOptions(route.params?.entry ? t('screens.editActivity', { defaultValue: 'Edit Activity' }) : t('screens.newActivity', { defaultValue: 'New Activity' }))}
          />
          <Stack.Screen
            name="WorkoutDetail"
            component={SafeWorkoutDetail}
            options={({ route }) =>
              createStackScreenOptions(route.params?.session?.name ?? t('screens.workout', { defaultValue: 'Workout' }), {
                headerBackButtonDisplayMode: 'minimal',
              })
            }
          />
          <Stack.Screen
            name="ActiveWorkout"
            component={SafeActiveWorkout}
            options={{
              headerShown: false,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="WorkoutComplete"
            component={SafeWorkoutComplete}
            options={{
              headerShown: false,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="ActivityDetail"
            component={SafeActivityDetail}
            options={({ route }) => createStackScreenOptions(route.params.session.name ?? t('screens.activity', { defaultValue: 'Activity' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="FastingDetail"
            component={SafeFastingDetail}
            options={{
              headerShown: false,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="SleepDetail"
            component={SafeSleepDetail}
            options={createStackScreenOptions(t('screens.sleep', { defaultValue: 'Sleep' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="GoalDetail"
            component={SafeGoalDetail}
            options={createStackScreenOptions(t('screens.goalDetail', { defaultValue: 'Goal' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="Logs"
            component={SafeLogs}
            options={createStackScreenOptions(t('screens.logs', { defaultValue: 'Logs' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ActivityHistory"
            component={SafeActivityHistory}
            options={createStackScreenOptions(t('screens.activityHistory', { defaultValue: 'Activities' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ImportHistory"
            component={SafeImportHistory}
            options={createStackScreenOptions(t('screens.importHistory', { defaultValue: 'Import History' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MeasurementsAdd"
            component={SafeMeasurementsAdd}
            options={createStackScreenOptions(t('screens.measurements', { defaultValue: 'Measurements' }), {
              presentation: 'modal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="ProgressPhotos"
            component={SafeProgressPhotos}
            options={createStackScreenOptions(t('screens.progressPhotos', { defaultValue: 'Progress Photos' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProgressPhotoCompare"
            component={SafeProgressPhotoCompare}
            options={createStackScreenOptions(t('screens.progressPhotoCompare', { defaultValue: 'Compare' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProgressPhotoTimelapse"
            component={SafeProgressPhotoTimelapse}
            options={createStackScreenOptions(t('screens.progressPhotoTimelapse', { defaultValue: 'Time-lapse' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ExerciseProgram"
            component={SafeExerciseProgram}
            options={createStackScreenOptions('', { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="WorkoutSetup"
            component={SafeWorkoutSetup}
            options={createStackScreenOptions(t('workoutSetup.title', { defaultValue: 'Start Workout' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="RunOrRide"
            component={SafeRunOrRide}
            options={createStackScreenOptions(t('addSheet.runOrRide', { defaultValue: 'Run or Ride' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="Cart"
            component={SafeCart}
            options={createStackScreenOptions(t('screens.cart', { defaultValue: 'Grocery List' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="Profile"
            component={SafeProfile}
            options={createStackScreenOptions(t('profile.title', { defaultValue: 'Profile' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProfileGoals"
            component={SafeProfileGoals}
            options={createStackScreenOptions(t('profile.goals', { defaultValue: 'Goals' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProfileEdit"
            component={SafeProfileEdit}
            options={createStackScreenOptions('', { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProfileTheme"
            component={SafeProfileTheme}
            options={createStackScreenOptions(t('settings.theme.title', { defaultValue: 'Theme' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ProfilePremium"
            component={SafeProfilePremium}
            options={createStackScreenOptions(t('profile.paywallTitle', { defaultValue: 'More with Premium' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="CalorieSettings"
            component={SafeCalorieSettings}
            options={createStackScreenOptions(t('screens.calorieSettings', { defaultValue: 'Calorie Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="FoodSettings"
            component={SafeFoodSettings}
            options={createStackScreenOptions(t('screens.foodSettings', { defaultValue: 'Food Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MealTypeSettings"
            component={SafeMealTypeSettings}
            options={createStackScreenOptions(t('screens.mealTypes', { defaultValue: 'Meal Types' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="DashboardSettings"
            component={SafeDashboardSettings}
            options={createStackScreenOptions(t('screens.dashboardSettings', { defaultValue: 'Activities Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="HealthTrendsSettings"
            component={SafeHealthTrendsSettings}
            options={createStackScreenOptions(t('screens.healthTrendsSettings', { defaultValue: 'Health Trends' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="DiarySettings"
            component={SafeDiarySettings}
            options={createStackScreenOptions(t('screens.diarySettings', { defaultValue: 'Nutrition Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="WorkoutSettings"
            component={SafeWorkoutSettings}
            options={createStackScreenOptions(t('screens.workoutSettings', { defaultValue: 'Workout Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="ServerSettings"
            component={SafeServerSettings}
            options={createStackScreenOptions(t('screens.serverSettings', { defaultValue: 'Server Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="PasskeySettings"
            component={SafePasskeySettings}
            options={createStackScreenOptions(t('screens.passkeys', { defaultValue: 'Passkeys' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="AppSettings"
            component={SafeAppSettings}
            options={createStackScreenOptions(t('settings.app', { defaultValue: 'App Settings' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={SafeNotificationSettings}
            options={createStackScreenOptions(t('notifications.title', { defaultValue: 'Notifications' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="About"
            component={SafeAbout}
            options={createStackScreenOptions(t('screens.about', { defaultValue: 'About' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="WhatsNew"
            component={SafeWhatsNew}
            options={createStackScreenOptions(t('screens.whatsNew', { defaultValue: "What's New" }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="CycleSettings"
            component={SafeCycleSettings}
            options={createStackScreenOptions(t('screens.cyclePregnancy', { defaultValue: 'Cycle & Pregnancy' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="CycleOnboarding"
            component={SafeCycleOnboarding}
            options={createStackScreenOptions(t('screens.cycleSetup', { defaultValue: 'Cycle Setup' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          {/* Modal, like the wizard: that presentation is what gives the
              screen the system's own sheet chrome and native header items. */}
          <Stack.Screen
            name="GoalEdit"
            component={SafeGoalEdit}
            options={createStackScreenOptions('', {
              presentation: 'modal',
              headerBackVisible: false,
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="WaterEdit"
            component={SafeWaterEdit}
            options={createStackScreenOptions('', {
              presentation: 'modal',
              headerBackVisible: false,
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="MeasurementEdit"
            component={SafeMeasurementEdit}
            options={createStackScreenOptions('', {
              presentation: 'modal',
              headerBackVisible: false,
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="SetupWizard"
            component={SafeSetupWizard}
            options={createStackScreenOptions('', {
              presentation: 'modal',
              gestureEnabled: false,
              headerBackVisible: false,
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="AppleHealthCheck"
            component={SafeAppleHealthCheck}
            options={createStackScreenOptions('', {
              presentation: 'modal',
              headerBackVisible: false,
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="CycleHub"
            component={SafeCycleHub}
            options={createStackScreenOptions(t('screens.wellnessHub', { defaultValue: 'Wellness Hub' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="CycleLogModal"
            component={SafeCycleLogModal}
            options={createStackScreenOptions(t('screens.logDailyEntry', { defaultValue: 'Log Daily Entry' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="PregnancySetup"
            component={SafePregnancySetup}
            options={createStackScreenOptions(t('screens.pregnancySetup', { defaultValue: 'Pregnancy Setup' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="MedicationsList"
            component={SafeMedicationsList}
            options={createStackScreenOptions(t('screens.medications', { defaultValue: 'Medications' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MedicationDetail"
            component={SafeMedicationDetail}
            options={createStackScreenOptions(t('screens.medication', { defaultValue: 'Medication' }), { headerBackButtonDisplayMode: 'minimal' })}
          />
          <Stack.Screen
            name="MedicationForm"
            component={SafeMedicationForm}
            options={createStackScreenOptions(t('screens.medication', { defaultValue: 'Medication' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
          <Stack.Screen
            name="MedicationScheduleForm"
            component={SafeMedicationScheduleForm}
            options={createStackScreenOptions(t('screens.medication', { defaultValue: 'Medication' }), {
              presentation: 'modal',
              headerBackButtonDisplayMode: 'minimal',
              ...(Platform.OS === 'android' ? androidModalAnimation : {}),
            })}
          />
        </Stack.Navigator>
        <ReauthModal
          visible={showReauthModal}
          expiredConfigId={expiredConfigId}
          onLoginSuccess={() => {
            handleLoginSuccess();
            queryClient.invalidateQueries({ queryKey: serverConnectionQueryKey });
          }}
          onSwitchToApiKey={handleSwitchToApiKey}
          onDismiss={dismissModal}
        />
        <ServerConfigModal
          visible={showSetupModal || showApiKeySwitchModal}
          editingConfig={switchToApiKeyConfig}
          defaultAuthTab={showApiKeySwitchModal ? 'apiKey' : undefined}
          onSuccess={() => {
            if (showApiKeySwitchModal) {
              handleSwitchToApiKeyDone();
            } else {
              handleLoginSuccess();
            }
            queryClient.invalidateQueries({ queryKey: serverConnectionQueryKey });
            queryClient.invalidateQueries({ queryKey: serverConfigsQueryKey });
          }}
          onDismiss={() => {
            if (showApiKeySwitchModal) {
              handleSwitchToApiKeyDone();
            } else {
              dismissModal();
            }
          }}
        />
        <ActiveWorkoutBar />
        <ActiveWorkoutKeepAwake />
        <MedicationReminderReconciler />
        <StartUpProtocol />
        <SafeAreaToast />
        </LightboxProvider>
      </SafeAreaProvider>
    </NavigationContainer>
    </AddActionsProvider>
  );
}

function SafeAreaToast() {
  const insets = useSafeAreaInsets();
  // Flush with the safe area rather than 5 below it: the toast sits closest
  // to the status bar of anything on screen, and the gap read as a misalignment
  // against the header beside it.
  const toast = <Toast config={toastConfig} topOffset={insets.top} />;
  // On iOS a plain Toast renders in the normal view tree, so it appears *under*
  // native modals (rename dialogs, form sheets, anchored menus). A
  // FullWindowOverlay hoists it above every window — matching how the app's
  // bottom sheets escape modal contexts. Android modal layering doesn't have
  // this problem, and FullWindowOverlay is a no-op there.
  return Platform.OS === 'ios' ? <FullWindowOverlay>{toast}</FullWindowOverlay> : toast;
}

function UniwindInsetsBridge() {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    Uniwind.updateInsets(insets);
  }, [insets]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <GestureHandlerRootView className="flex-1">
          <BottomSheetModalProvider>
            {/* One resolver for the whole app: food/meal image paths only need
                the active server's origin and proxy headers, so there is no
                reason for each screen to own a copy (or its own cache). */}
            <FoodImageSourceProvider>
              <AppContent />
            </FoodImageSourceProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}

export default App;
