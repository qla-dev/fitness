import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignInMethodRow from '../../src/components/SignInMethodRow';
import {
  linkSignInMethod,
  signOutOnline,
  unlinkSignInMethod,
} from '../../src/services/online/account';
import { fireSuccessHaptic } from '../../src/services/haptics';

let mockSession: unknown = null;
const mockApple = jest.fn();
const mockGoogle = jest.fn();
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: mockSession }),
  signOutOnline: jest.fn(async () => undefined),
  linkSignInMethod: jest.fn(async () => undefined),
  unlinkSignInMethod: jest.fn(async () => undefined),
  signInMethods: (user: { sign_in_methods?: unknown[] }) =>
    user.sign_in_methods ?? [],
}));
jest.mock('../../src/hooks/useAppleSignIn', () => ({
  signInCancelled: () => false,
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

type Method = {
  provider: 'apple' | 'google';
  email: string | null;
  private_email: boolean;
};
const method = (
  provider: Method['provider'],
  email: string | null,
  privateEmail = false
): Method => ({ provider, email, private_email: privateEmail });
const signedIn = (...methods: Method[]) => ({
  token: 't',
  user: {
    id: '1',
    name: 'Nedim',
    ai_coins: 68,
    sign_in: methods[0],
    sign_in_methods: methods,
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

it('shows a linked method with its email, and links another to the account', async () => {
  mockSession = signedIn(method('google', 'nedim@gmail.com'));
  const google = render(<SignInMethodRow provider="google" />);
  expect(google.getByText('Google')).toBeTruthy();
  expect(google.getByText('nedim@gmail.com')).toBeTruthy();
  expect(google.getByText('Connected')).toBeTruthy();
  const apple = render(<SignInMethodRow provider="apple" />);
  fireEvent.press(apple.getByText('Connect Apple'));
  await waitFor(() => expect(linkSignInMethod).toHaveBeenCalledWith('apple'));
  // Linking, not signing in: that would open another account.
  expect(mockApple).not.toHaveBeenCalled();
});

it('shows why a link was refused', async () => {
  jest
    .mocked(linkSignInMethod)
    .mockRejectedValueOnce(
      new Error('This Google account already has its own qla.fit account.')
    );
  mockSession = signedIn(method('apple', null));
  const screen = render(<SignInMethodRow provider="google" />);
  fireEvent.press(screen.getByText('Connect Google'));
  await waitFor(() =>
    expect(
      screen.getByText(
        'This Google account already has its own qla.fit account.'
      )
    ).toBeTruthy()
  );
});

it('disconnects one of two linked methods', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockSession = signedIn(
    method('apple', null),
    method('google', 'nedim@gmail.com')
  );
  const screen = render(<SignInMethodRow provider="google" />);
  fireEvent.press(screen.getByText('Google'));
  const buttons = alert.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  expect(buttons.map((button) => button.text)).toEqual([
    'Disconnect Google',
    'Sign out',
    'Cancel',
  ]);
  buttons[0].onPress?.();
  await waitFor(() =>
    expect(unlinkSignInMethod).toHaveBeenCalledWith('google')
  );
  expect(signOutOnline).not.toHaveBeenCalled();
});

it('marks a private relay address', () => {
  mockSession = signedIn(method('apple', 'x7@privaterelay.appleid.com', true));
  const screen = render(<SignInMethodRow provider="apple" />);
  expect(
    screen.getByText('x7@privaterelay.appleid.com · Hidden by Apple')
  ).toBeTruthy();
});

it('signs out from the only method after confirming', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockSession = signedIn(method('apple', 'nedim@example.com'));
  const screen = render(<SignInMethodRow provider="apple" />);
  fireEvent.press(screen.getByText('Apple'));
  expect(mockApple).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'Sign out of Apple?',
    expect.any(String),
    expect.any(Array)
  );
  const buttons = alert.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  buttons.find((button) => button.text === 'Sign out')?.onPress?.();
  await waitFor(() => expect(signOutOnline).toHaveBeenCalledTimes(1));
});

it('ticks when a sign-in lands', () => {
  const screen = render(<SignInMethodRow provider="google" />);
  expect(fireSuccessHaptic).not.toHaveBeenCalled();
  mockSession = signedIn(method('google', 'nedim@gmail.com'));
  screen.rerender(<SignInMethodRow provider="google" />);
  expect(fireSuccessHaptic).toHaveBeenCalledTimes(1);
});
