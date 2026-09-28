import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WeeklyPlansScreen from '../../src/screens/WeeklyPlansScreen';
import {
  createWeeklyPlan,
  listWeeklyPlans,
} from '../../src/services/weeklyPlans';
import { getSetupWizardSession } from '../../src/services/setupWizardSession';

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
  createWeeklyPlan: jest.fn(),
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

it('opens the questionnaire, then plans only after confirming the coins', async () => {
  mockSession = { token: 't', user: { id: '1', name: 'N', ai_coins: 10 } };
  jest.mocked(createWeeklyPlan).mockResolvedValue({ ...plan, id: 'p2' } as any);
  const alert = jest.spyOn(Alert, 'alert');
  const screen = renderScreen();
  fireEvent.press(await screen.findByText('Create meal plan · 3 coins'));
  expect(navigation.navigate).toHaveBeenCalledWith('SetupWizard');

  const session = getSetupWizardSession()!;
  await act(async () => {
    await session.onSave({ region: 'HR', diet: 'vegan' }, true);
    session.onClose();
  });
  expect(createWeeklyPlan).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Plan my week')!.onPress!();
  });
  expect(createWeeklyPlan).toHaveBeenCalledWith(
    { region: 'HR', diet: 'vegan' },
    expect.any(String)
  );
  await waitFor(() =>
    expect(navigation.navigate).toHaveBeenCalledWith('WeeklyPlan', {
      planId: 'p2',
    })
  );
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
