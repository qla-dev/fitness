import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OnlineAccountScreen from '../../src/screens/OnlineAccountScreen';
import { signInWithApple } from '../../src/services/online/account';
import { syncOnline } from '../../src/services/online/sync';
import type { RootStackScreenProps } from '../../src/types/navigation';

jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (s: { session: null }) => unknown) =>
    selector({ session: null }),
  signInWithApple: jest.fn(),
}));
jest.mock('../../src/services/online/sync', () => ({
  syncOnline: jest.fn(),
  useOnlineSync: { getState: () => ({ enabled: true }) },
}));
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn(async () => undefined) },
}));
jest.mock('expo-apple-authentication', () => {
  const { Button } = require('react-native');
  return {
    isAvailableAsync: jest.fn(async () => true),
    AppleAuthenticationButtonType: { CONTINUE: 0 },
    AppleAuthenticationButtonStyle: { BLACK: 0 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <Button title="Apple sign-in" onPress={onPress} />
    ),
  };
});
jest.mock('../../src/components/ui/PromptScreen', () => {
  const { View, Button } = require('react-native');
  return ({
    children,
    onFooterPress,
  }: {
    children: React.ReactNode;
    onFooterPress: () => void;
  }) => (
    <View>
      {children}
      <Button title="Continue offline" onPress={onFooterPress} />
    </View>
  );
});

const goBack = jest.fn();
const props = {
  navigation: { canGoBack: () => true, goBack },
  route: {},
} as unknown as RootStackScreenProps<'OnlineAccount'>;

it('closes after authentication without waiting for sync or showing a credit screen', async () => {
  jest.mocked(signInWithApple).mockResolvedValue(true);
  jest.mocked(syncOnline).mockReturnValue(new Promise(() => {}));
  const screen = render(<OnlineAccountScreen {...props} />);
  await waitFor(() => expect(screen.getByText('Continue with Apple')).toBeTruthy());
  fireEvent.press(screen.getByText('Continue with Apple'));
  await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  expect(syncOnline).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('100 AI coins')).toBeNull();
});

it('keeps the sign-in sheet open when authentication fails', async () => {
  goBack.mockClear();
  jest.mocked(signInWithApple).mockRejectedValue(new Error('Sign-in failed'));
  const screen = render(<OnlineAccountScreen {...props} />);
  await waitFor(() => expect(screen.getByText('Continue with Apple')).toBeTruthy());
  fireEvent.press(screen.getByText('Continue with Apple'));
  await waitFor(() => expect(screen.getByText('Sign-in failed')).toBeTruthy());
  expect(goBack).not.toHaveBeenCalled();
});
