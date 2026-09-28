import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AppleConnectionRow from '../../src/components/AppleConnectionRow';
import { fireSuccessHaptic } from '../../src/services/haptics';

let mockSession: unknown = null;
const mockSignIn = jest.fn();
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: mockSession }),
}));
jest.mock('../../src/hooks/useAppleSignIn', () => ({
  useAppleSignIn: () => ({
    available: true,
    busy: false,
    error: null,
    signIn: mockSignIn,
  }),
}));
jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
  fireSuccessHaptic: jest.fn(),
}));

const signedIn = (email: string | null, privateEmail = false) => ({
  token: 't',
  user: {
    id: '1',
    name: 'Nedim',
    ai_coins: 68,
    sign_in: { provider: 'apple', email, private_email: privateEmail },
  },
});

beforeEach(() => {
  mockSession = null;
  jest.clearAllMocks();
});

it('shows the verified Apple email with a Connected badge', () => {
  mockSession = signedIn('nedim@example.com');
  const screen = render(<AppleConnectionRow />);
  expect(screen.getByText('Apple')).toBeTruthy();
  expect(screen.getByText('nedim@example.com')).toBeTruthy();
  expect(screen.getByText('Connected')).toBeTruthy();
  fireEvent.press(screen.getByText('Apple'));
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('marks a private relay address and offers to fetch a missing email', () => {
  mockSession = signedIn('x7@privaterelay.appleid.com', true);
  const relay = render(<AppleConnectionRow />);
  expect(
    relay.getByText('x7@privaterelay.appleid.com · Hidden by Apple')
  ).toBeTruthy();
  relay.unmount();

  mockSession = signedIn(null);
  const missing = render(<AppleConnectionRow />);
  fireEvent.press(
    missing.getByText('Tap to sign in again and show your email')
  );
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('connects from the row when signed out, with a success tick on landing', () => {
  const screen = render(<AppleConnectionRow />);
  expect(screen.getByText('Connect Apple')).toBeTruthy();
  fireEvent.press(screen.getByText('Connect'));
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(fireSuccessHaptic).not.toHaveBeenCalled();
  mockSession = signedIn('nedim@example.com');
  screen.rerender(<AppleConnectionRow />);
  expect(fireSuccessHaptic).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Connected')).toBeTruthy();
});
