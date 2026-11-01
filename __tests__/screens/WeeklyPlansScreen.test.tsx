import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WeeklyPlansScreen from '../../src/screens/WeeklyPlansScreen';
import { listWeeklyPlans } from '../../src/services/weeklyPlans';
import {
  clearSetupWizardSession,
  getSetupWizardSession,
} from '../../src/services/setupWizardSession';

let mockSession: unknown = null;
const mockSave = jest.fn(async () => undefined);
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: mockSession }),
  OnlineError: class OnlineError extends Error {},
}));
jest.mock('../../src/hooks/usePersonalSetup', () => ({
  usePersonalSetup: () => ({
    state: { grocery: { region: 'HR' }, groceryDone: true },
    save: mockSave,
  }),
}));
const mockHeader = jest.fn();
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: (options: unknown) => {
    mockHeader(options);
    return null;
  },
}));
let mockManualPlans: unknown[] = [];
jest.mock('../../src/hooks/useMealPlans', () => ({
  useMealPlans: () => ({ mealPlans: mockManualPlans }),
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useLiquidGlassActive: () => false,
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/services/weeklyPlans', () => ({
  ...jest.requireActual('../../src/services/weeklyPlans'),
  listWeeklyPlans: jest.fn(),
}));

const plan = {
  id: 'p1',
  title: 'Budget week',
  summary: 'Cheap and simple.',
  region: 'HR',
  currency: 'EUR',
  prices: 'cijene',
  price_date: '2026-09-28',
  weekly_cost: 42.5,
  days: [],
  servings: 2,
  is_active: true,
};
const navigation = { navigate: jest.fn() };
const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WeeklyPlansScreen
        navigation={navigation as any}
        route={{ key: 'WeeklyPlans', name: 'WeeklyPlans' } as any}
      />
    </QueryClientProvider>
  );

beforeEach(() => {
  clearSetupWizardSession(getSetupWizardSession());
  mockSession = null;
  mockManualPlans = [];
  jest.clearAllMocks();
  jest.mocked(listWeeklyPlans).mockResolvedValue([plan as any]);
});

it('shows each plan as a card with the active one marked', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('Budget week')).toBeTruthy());
  expect(screen.getByText('Active')).toBeTruthy();
  expect(screen.getByText('Store prices')).toBeTruthy();
  expect(screen.getByText(/42[.,]50/)).toBeTruthy();
  fireEvent.press(screen.getByText('Budget week'));
  expect(navigation.navigate).toHaveBeenCalledWith('WeeklyPlan', {
    planId: 'p1',
  });
});

it('asks to sign in before planning', async () => {
  const screen = renderScreen();
  fireEvent.press(await screen.findByText('Sign in to plan with MarkAI'));
  expect(navigation.navigate).toHaveBeenCalledWith('OnlineAccount');
});

it("ends a new plan's questionnaire on Plan my week, which plans it in a new chat", async () => {
  mockSession = { token: 't', user: { id: '1', name: 'N', ai_coins: 10 } };
  const screen = renderScreen();
  fireEvent.press(await screen.findByText('Create meal plan · 10 coins'));
  expect(navigation.navigate).toHaveBeenCalledWith('SetupWizard');

  const session = getSetupWizardSession()!;
  expect(session.steps.at(-1)!.id).toBe('planWeek');
  await act(async () => {
    await session.onSave(
      { region: 'BA', servings: '2', diet: 'vegan', planWeek: 'yes' },
      true,
      true
    );
    session.onClose();
  });
  // The plan question is not saved as a food preference.
  const saved = (mockSave.mock.calls[0] as any)[0]({}) as {
    grocery: Record<string, unknown>;
  };
  expect(saved.grocery).toEqual({ region: 'BA', servings: '2', diet: 'vegan' });
  expect(navigation.navigate).toHaveBeenCalledWith('MarkAI', {
    preset: expect.objectContaining({
      task: 'meal_plan',
      label: 'Plan my week',
      mode: 'macros',
      mealPlan: expect.objectContaining({
        preferences: { region: 'BA', servings: '2', diet: 'vegan' },
        region: 'BA',
        currency: 'BAM',
        servings: 2,
      }),
    }),
  });
});

it('plans nothing when the last question is answered Not now', async () => {
  mockSession = { token: 't', user: { id: '1', name: 'N', ai_coins: 10 } };
  const screen = renderScreen();
  fireEvent.press(await screen.findByText('Create meal plan · 10 coins'));
  const session = getSetupWizardSession()!;
  await act(async () => {
    await session.onSave({ region: 'HR', planWeek: 'no' }, true, true);
    session.onClose();
  });
  expect(navigation.navigate).not.toHaveBeenCalledWith(
    'MarkAI',
    expect.anything()
  );
});

it('edits preferences without the plan question', async () => {
  const screen = renderScreen();
  fireEvent.press(await screen.findByText('My food & kitchen preferences'));
  expect(
    getSetupWizardSession()!.steps.some((step) => step.id === 'planWeek')
  ).toBe(false);
});

it('builds a plan by hand from the header +, and lists hand-built plans', async () => {
  const template = {
    id: 't1',
    plan_name: 'My usual week',
    is_active: false,
    assignments: [{}, {}, {}],
  };
  mockManualPlans = [template];
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('My usual week')).toBeTruthy());
  expect(screen.getByText('Built by you · 3 items')).toBeTruthy();

  const header = mockHeader.mock.lastCall![0];
  header.right.onPress();
  expect(navigation.navigate).toHaveBeenCalledWith('MealPlanForm');
  fireEvent.press(screen.getByText('My usual week'));
  expect(navigation.navigate).toHaveBeenCalledWith('MealPlanForm', {
    template,
  });
});
