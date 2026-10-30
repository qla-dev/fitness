import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignInMethodRow from '../../src/components/SignInMethodRow';
import { signOutOnline } from '../../src/services/online/account';
import { fireSuccessHaptic } from '../../src/services/haptics';

let mockSession: unknown = null;
const mockApple = jest.fn();
const mockGoogle = jest.fn();
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: mockSession }),
  signOutOnline: jest.fn(async () => undefined),
}));
jest.mock('../../src/hooks/useAppleSignIn', () => ({
  useAppleSignIn: () => ({
    available: true,
    busy: false,
    error: null,
    signIn: mockApple,
  }),
  useGoogleSignIn: () => ({
    available: true,
    busy: false,
    error: null,
    signIn: mockGoogle,
  }),
}));
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn(async () => undefined) },
}));
jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
  fireSuccessHaptic: jest.fn(),
}));

const signedIn = (
  provider: 'apple' | 'google',
  email: string | null,
  privateEmail = false
) => ({
  token: 't',
  user: {
    id: '1',
    name: 'Nedim',
    ai_coins: 68,
    sign_in: { provider, email, private_email: privateEmail },
  },
});

beforeEach(() => {
  mockSession = null;
  jest.clearAllMocks();
});

it('offers both methods when signed out, and each connects its own', () => {
  const apple = render(<SignInMethodRow provider="apple" />);
  fireEvent.press(apple.getByText('Connect Apple'));
  expect(mockApple).toHaveBeenCalledTimes(1);
  const google = render(<SignInMethodRow provider="google" />);
  fireEvent.press(google.getByText('Connect Google'));
  expect(mockGoogle).toHaveBeenCalledTimes(1);
});

it('lists only the method in use, with its email and a Connected badge', () => {
  mockSession = signedIn('google', 'nedim@gmail.com');
  const google = render(<SignInMethodRow provider="google" />);
  expect(google.getByText('Google')).toBeTruthy();
  expect(google.getByText('nedim@gmail.com')).toBeTruthy();
  expect(google.getByText('Connected')).toBeTruthy();
  expect(render(<SignInMethodRow provider="apple" />).toJSON()).toBeNull();
});

it('marks a private relay address', () => {
  mockSession = signedIn('apple', 'x7@privaterelay.appleid.com', true);
  const screen = render(<SignInMethodRow provider="apple" />);
  expect(
    screen.getByText('x7@privaterelay.appleid.com · Hidden by Apple')
  ).toBeTruthy();
});

it('signs out from the connected row after confirming', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockSession = signedIn('apple', 'nedim@example.com');
  const screen = render(<SignInMethodRow provider="apple" />);
  fireEvent.press(screen.getByText('Apple'));
  expect(mockApple).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'Sign out of Apple?',
    expect.any(String),
    expect.any(Array)
  );
  const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  buttons.find((button) => button.text === 'Sign out')?.onPress?.();
  await waitFor(() => expect(signOutOnline).toHaveBeenCalledTimes(1));
});

it('ticks when a sign-in lands', () => {
  const screen = render(<SignInMethodRow provider="google" />);
  expect(fireSuccessHaptic).not.toHaveBeenCalled();
  mockSession = signedIn('google', 'nedim@gmail.com');
  screen.rerender(<SignInMethodRow provider="google" />);
  expect(fireSuccessHaptic).toHaveBeenCalledTimes(1);
});
