import { createContext, useContext } from 'react';

/**
 * The actions the Add tab offers, supplied by the app shell.
 *
 * They live in `useAppBootstrap`'s sibling `useAddSheetActions`, which owns the
 * parts a screen cannot reasonably own: the diary date the action is logged
 * against, the unsaved-draft prompt, the active-workout conflict, and the
 * health sync mutation. The Add screen is inside the tab navigator and the hook
 * is above it, so they meet here rather than the screen keeping a second copy
 * of any of that.
 */
export interface AddActions {
  addFood: () => void;
  logMeal: () => void;
  newFood: () => void;
  newMeal: () => void;
  mealPlans: () => void;
  newGroceryList: () => void;
  newMealPlan: () => void;
  barcodeScan: () => void;
  typeBarcode: (barcode: string) => void;
  aiMealScan: () => void;
  startWorkout: () => void;
  logWorkout: () => void;
  addActivity: () => void;
  groceryList: () => void;
  progressPhotos: () => void;
  askSparky: () => void;
  openCycle: () => void;
  syncHealthData: () => void;
}

const AddActionsContext = createContext<AddActions | null>(null);

export const AddActionsProvider = AddActionsContext.Provider;

/**
 * Throws when the Add screen is rendered outside the shell that supplies the
 * actions. Every row on it is an action, so a screen without them is a screen
 * of dead buttons — better to fail where it is mounted than to look fine.
 */
export function useAddActions(): AddActions {
  const actions = useContext(AddActionsContext);
  if (!actions) {
    throw new Error('useAddActions must be used within an AddActionsProvider');
  }
  return actions;
}
