import React from 'react';
import * as Reanimated from 'react-native-reanimated';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MarkaiScreen from '../../src/screens/MarkaiScreen';
import MacrosScreen from '../../src/screens/MacrosScreen';
import { onlineRequest } from '../../src/services/online/account';

// The shared animation mock omits color interpolation; keep this renderer stub
// local to the screen tests rather than changing animation mocks app-wide.
Object.assign(Reanimated, {
  interpolateColor: (_value: number, _range: number[], colors: string[]) =>
    colors[0],
});
Object.assign(Reanimated.default, { Text });

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('../../src/components/CustomModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({ session: { user: { id: 'account', ai_coins: 100 } } }),
  onlineRequest: jest.fn(),
  updateOnlineAccount: jest.fn().mockResolvedValue(undefined),
  OnlineError: class OnlineError extends Error {},
}));
jest.mock('../../src/components/markai/MarkaiComposer', () => ({
  __esModule: true,
  useChatKeyboardHeight: () => ({ value: 0 }),
  default: ({
    value,
    onChangeText,
    onSend,
    disabled,
    busy,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
    busy: boolean;
  }) => {
    const { TextInput, Button, View } = require('react-native');
    return (
      <View>
        <TextInput
          accessibilityLabel="Message MarkAI"
          value={value}
          onChangeText={onChangeText}
        />
        <Button title="Send" onPress={onSend} disabled={disabled || busy} />
      </View>
    );
  },
}));

const reply = {
  id: 'reply',
  reply: {
    text: 'Here is your answer.',
    food: null,
    food_id: 'food',
    log_requested: false,
  },
  ai_coins: 99,
};

it('uses the same chat for the legacy Tracker route and expands prompt choices without a greeting', async () => {
  expect(MacrosScreen).toBe(MarkaiScreen);
  const screen = render(<MarkaiScreen />);
  await waitFor(() => expect(screen.getByText('Log food')).toBeTruthy());
  expect(screen.queryByText("Hi, I'm MarkAI.")).toBeNull();
  fireEvent.press(screen.getByText('Log food'));
  expect(screen.getByLabelText('Message MarkAI').props.value).toBe(
    'Help me log my meal: '
  );
  fireEvent.press(screen.getByText('More ideas'));
  fireEvent.press(screen.getByText('Explain my daily metrics'));
  expect(screen.getByLabelText('Message MarkAI').props.value).toBe(
    'Explain my daily metrics'
  );
  expect(onlineRequest).not.toHaveBeenCalled();
});

it('shows an optimistic message and thinking, retains failures, and retries the same request once', async () => {
  let rejectRequest!: (error: Error) => void;
  jest.mocked(onlineRequest).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      })
  );
  const screen = render(<MarkaiScreen />);
  await waitFor(() => expect(screen.getByText('Log food')).toBeTruthy());
  fireEvent.changeText(
    screen.getByLabelText('Message MarkAI'),
    'Protein ideas'
  );
  fireEvent.press(screen.getByText('Send'));
  expect(screen.getByText('Protein ideas')).toBeTruthy();
  expect(screen.getByLabelText('MarkAI is thinking…')).toBeTruthy();
  await act(async () => rejectRequest(new Error('Connection lost')));
  expect(screen.getByText('Protein ideas')).toBeTruthy();
  expect(screen.queryByLabelText('MarkAI is thinking…')).toBeNull();
  jest.mocked(onlineRequest).mockResolvedValueOnce(reply);
  fireEvent.press(screen.getByText('Not sent. Tap to retry.'));
  await waitFor(() =>
    expect(screen.getByText('Here is your answer.')).toBeTruthy()
  );
  expect(screen.getAllByText('Protein ideas')).toHaveLength(1);
  expect(screen.queryByText('Not sent. Tap to retry.')).toBeNull();
  expect(jest.mocked(onlineRequest).mock.calls[1]).toEqual(
    jest.mocked(onlineRequest).mock.calls[0]
  );
});
