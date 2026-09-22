import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { queryClient } from './queryClient';
import { serverConnectionQueryKey } from './queryKeys';
import { useSyncHealthData } from './useSyncHealthData';
import { prepareManualHealthSync } from './useManualHealthSync';
import { promptForActiveWorkoutConflict } from './useStartLiveWorkout';
import { isSyncClaimed } from '../services/autoSyncCoordinator';
import { loadActiveDraft, clearDraft } from '../services/workoutDraftService';
import { navigationRef as rootNavigationRef } from '../components/ActiveWorkoutBar';
import { NON_ADD_TABS, type NonAddTabName } from '../components/TabsLayout';
import type { RootStackParamList } from '../types/navigation';

function getServerConnectionMessage(
  t: (key: string, options: { defaultValue: string }) => string,
  key: string,
  fallback: string
): string {
  switch (key) {
    case 'addSheetActions.configureForExercise':
      return t('addSheetActions.configureForExercise', {
        defaultValue:
          'Configure your server connection in Settings to add an exercise.',
      });
    case 'addSheetActions.configureForWorkout':
      return t('addSheetActions.configureForWorkout', {
        defaultValue:
          'Configure your server connection in Settings to start a workout.',
      });
    default:
      return fallback;
  }
}

type TabStateSnapshot = {
  index?: number;
  routes: {
    name: string;
    params?: unknown;
    state?: TabStateSnapshot;
  }[];
};

function findRouteState(
  state: TabStateSnapshot | undefined,
  routeName: string
): TabStateSnapshot | undefined {
  if (!state) return undefined;

  const activeRoute = state.routes[state.index ?? 0];
  if (activeRoute?.name === routeName && activeRoute.state) {
    return activeRoute.state;
  }

  for (const route of state.routes) {
    if (route.name === routeName && route.state) {
      return route.state;
    }
    const nested = findRouteState(route.state, routeName);
    if (nested) return nested;
  }

  return undefined;
}

function findRouteParams<T extends object>(
  state: TabStateSnapshot | undefined,
  routeName: string
): T | undefined {
  if (!state) return undefined;

  const activeRoute = state.routes[state.index ?? 0];
  if (activeRoute?.name === routeName) {
    return activeRoute.params as T | undefined;
  }

  for (const route of state.routes) {
    if (route.name === routeName) {
      return route.params as T | undefined;
    }
    const nested = findRouteParams<T>(route.state, routeName);
    if (nested) return nested;
  }

  return undefined;
}

interface AddSheetActionsArgs {
  syncMutation: ReturnType<typeof useSyncHealthData>;
}

/**
 * Owns the AddSheet's actions and their navigation plumbing: resolving the
 * diary date the action is logged against, routing each one to its screen,
 * draft/active-workout conflict prompts, and manual health sync. They are
 * supplied to the Add tab through AddActionsContext: the screen is inside the
 * tab navigator and these need the navigator above it.
 */
export function useAddSheetActions({ syncMutation }: AddSheetActionsArgs) {
  const { t } = useTranslation();
  const lastActiveTabRef = useRef<NonAddTabName>('Dashboard');
  const rememberActiveTab = useCallback((routeName: string) => {
    if ((NON_ADD_TABS as readonly string[]).includes(routeName)) {
      lastActiveTabRef.current = routeName as NonAddTabName;
    }
  }, []);
  const getLastActiveTab = useCallback(() => lastActiveTabRef.current, []);

  const getActiveDiaryDate = useCallback(() => {
    const rootOrTabState = rootNavigationRef.isReady()
      ? (rootNavigationRef.getRootState() as TabStateSnapshot | undefined)
      : undefined;

    const tabState = rootOrTabState?.routes?.some(
      (route) => route.name === 'Tabs'
    )
      ? findRouteState(rootOrTabState, 'Tabs')
      : rootOrTabState;
    const diaryState = findRouteState(tabState, 'Diary');
    const diaryParams =
      findRouteParams<{ selectedDate?: string }>(diaryState, 'DiaryRoot') ??
      findRouteParams<{ selectedDate?: string }>(tabState, 'Diary');

    return diaryParams?.selectedDate;
  }, []);

  const navigateFromSheet = useCallback(
    <T extends keyof RootStackParamList>(
      screen: T,
      params?: RootStackParamList[T]
    ) => {
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.dispatch(
          CommonActions.navigate({ name: screen, params })
        );
      }
    },
    []
  );

  const handleAddFood = useCallback(() => {
    const date = getActiveDiaryDate();
    navigateFromSheet('FoodSearch', { date });
  }, [getActiveDiaryDate, navigateFromSheet]);

  const handleBarcodeScan = useCallback(() => {
    const date = getActiveDiaryDate();
    navigateFromSheet('FoodScan', { date });
  }, [getActiveDiaryDate, navigateFromSheet]);

  // The same scanner, opened on its photo segment: an AI estimate is a scan of
  // the plate rather than of a barcode, so it is one screen, not two.
  const handleAiMealScan = useCallback(() => {
    const date = getActiveDiaryDate();
    navigateFromSheet('FoodScan', { date, initialMode: 'photo' });
  }, [getActiveDiaryDate, navigateFromSheet]);

  const handleLogMeal = useCallback(() => {
    navigateFromSheet('MealsLibrary');
  }, [navigateFromSheet]);

  // A barcode typed by hand — a worn label, a box already in the bin. The
  // sheet that collects it belongs to the screen that offered it, so only the
  // lookup comes here.
  const handleTypeBarcode = useCallback(
    (barcode: string) => {
      const date = getActiveDiaryDate();
      navigateFromSheet('FoodScan', { date, lookupBarcode: barcode });
    },
    [getActiveDiaryDate, navigateFromSheet]
  );

  // Creating, as opposed to finding: a food the provider does not have, or a
  // meal built from foods you already keep.
  const handleNewFood = useCallback(() => {
    const date = getActiveDiaryDate();
    navigateFromSheet('FoodForm', { mode: 'create-food', date });
  }, [getActiveDiaryDate, navigateFromSheet]);

  const handleNewMeal = useCallback(() => {
    navigateFromSheet('MealAdd', {});
  }, [navigateFromSheet]);

  const handleOpenMealPlans = useCallback(() => {
    navigateFromSheet('MealPlans');
  }, [navigateFromSheet]);

  const handleNewGroceryList = useCallback(() => {
    navigateFromSheet('Cart', { newList: true });
  }, [navigateFromSheet]);

  const handleNewMealPlan = useCallback(() => {
    navigateFromSheet('MealPlanForm', undefined);
  }, [navigateFromSheet]);

  const handleOpenGroceryList = useCallback(() => {
    navigateFromSheet('Cart');
  }, [navigateFromSheet]);

  const checkServerConnected = useCallback(
    (message: string, defaultMessage: string): boolean => {
      const isConnected = queryClient.getQueryData(serverConnectionQueryKey);
      if (!isConnected) {
        Alert.alert(
          t('addSheetActions.noServerTitle', {
            defaultValue: 'No Server Connected',
          }),
          getServerConnectionMessage(t, message, defaultMessage),
          [
            {
              text: t('common.cancel', { defaultValue: 'Cancel' }),
              style: 'cancel',
            },
            {
              text: t('common.goToSettings', {
                defaultValue: 'Go to Settings',
              }),
              onPress: () => navigateFromSheet('Profile'),
            },
          ]
        );
        return false;
      }
      return true;
    },
    [navigateFromSheet, t]
  );

  const handleStartExerciseForm = useCallback(
    async (screen: 'WorkoutAdd' | 'ActivityAdd') => {
      if (
        !checkServerConnected(
          'addSheetActions.configureForExercise',
          'Configure your server connection in Settings to add an exercise.'
        )
      ) {
        return;
      }

      const date = getActiveDiaryDate();
      const draft = await loadActiveDraft();
      if (draft) {
        Alert.alert(
          t('addSheetActions.draft.title', {
            defaultValue: 'Draft in Progress',
          }),
          t('addSheetActions.draft.message', {
            defaultValue:
              'You have an unsaved {{type}} draft. What would you like to do?',
            type:
              draft.type === 'workout'
                ? t('addSheetActions.draft.workout', {
                    defaultValue: 'workout',
                  })
                : t('addSheetActions.draft.activity', {
                    defaultValue: 'activity',
                  }),
          }),
          [
            {
              text: t('common.cancel', { defaultValue: 'Cancel' }),
              style: 'cancel',
            },
            {
              text: t('addSheetActions.draft.resume', {
                defaultValue: 'Resume Draft',
              }),
              onPress: () => {
                if (draft.type === 'workout') {
                  navigateFromSheet('WorkoutAdd');
                } else {
                  navigateFromSheet('ActivityAdd');
                }
              },
            },
            {
              text: t('addSheetActions.draft.discard', {
                defaultValue: 'Discard & Continue',
              }),
              style: 'destructive',
              onPress: async () => {
                await clearDraft();
                navigateFromSheet(screen, { date, skipDraftLoad: true });
              },
            },
          ]
        );
        return;
      }

      navigateFromSheet(screen, { date, skipDraftLoad: true });
    },
    [checkServerConnected, navigateFromSheet, getActiveDiaryDate, t]
  );

  // Live start: no draft guard (form drafts belong to the Log Workout path) and
  // no diary date (a live workout is logged to today). Tapping while a workout
  // is already running prompts to go back to it or clear it and start over.
  const handleStartWorkout = useCallback(() => {
    if (
      !checkServerConnected(
        'addSheetActions.configureForWorkout',
        'Configure your server connection in Settings to start a workout.'
      )
    ) {
      return;
    }
    const prompted = promptForActiveWorkoutConflict(
      queryClient,
      {
        onGoToWorkout: () => navigateFromSheet('ActiveWorkout'),
        onClearAndStart: () => navigateFromSheet('PresetSearch'),
      },
      t
    );
    if (prompted) return;
    navigateFromSheet('PresetSearch');
  }, [checkServerConnected, navigateFromSheet, t]);

  const handleLogWorkout = useCallback(
    () => handleStartExerciseForm('WorkoutAdd'),
    [handleStartExerciseForm]
  );
  const handleAddActivity = useCallback(
    () => handleStartExerciseForm('ActivityAdd'),
    [handleStartExerciseForm]
  );

  const handleAddProgressPhotos = useCallback(() => {
    const date = getActiveDiaryDate();
    navigateFromSheet('ProgressPhotos', { date });
  }, [getActiveDiaryDate, navigateFromSheet]);

  const handleAskSparky = useCallback(() => {
    navigateFromSheet('Chat');
  }, [navigateFromSheet]);

  const handleOpenCycle = useCallback(() => {
    navigateFromSheet('CycleLogModal');
  }, [navigateFromSheet]);

  const handleSyncHealthData = useCallback(async () => {
    if (syncMutation.isPending || isSyncClaimed()) return;

    const params = await prepareManualHealthSync(t);
    if (!params) return;

    syncMutation.mutate(params);
  }, [syncMutation, t]);

  return {
    getActiveDiaryDate,
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
  };
}
