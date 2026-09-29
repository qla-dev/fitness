import React from 'react';
import * as Reanimated from 'react-native-reanimated';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MarkaiScreen from '../../src/screens/MarkaiScreen';
import MacrosScreen from '../../src/screens/MacrosScreen';
import { onlineRequest } from '../../src/services/online/account';
import AsyncStorage from '@react-native-async-storage/async-storage';

beforeEach(async () => {
  mockSignedIn = true;
  await AsyncStorage.clear();
  mockNavigate.mockClear();
  jest.mocked(onlineRequest).mockReset();
});

// The shared animation mock omits color interpolation; keep this renderer stub
// local to the screen tests rather than changing animation mocks app-wide.
Object.assign(Reanimated, {
  interpolateColor: (_value: number, _range: number[], colors: string[]) =>
    colors[0],
});
Object.assign(Reanimated.default, { Text });

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));

const mockNavigate = jest.fn();
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardChatScrollView: require('react-native').ScrollView,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn() }),
  useRoute: () => ({ params: undefined }),
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
let mockSignedIn = true;
jest.mock('../../src/hooks/useAppleSignIn', () => ({
  useAppleSignIn: () => ({
    available: true,
    busy: false,
    error: null,
    signIn: jest.fn(),
  }),
}));
jest.mock('../../src/services/online/account', () => ({
  useOnlineAccount: (selector: (state: unknown) => unknown) =>
    selector({
      session: mockSignedIn ? { user: { id: 'account', ai_coins: 100 } } : null,
    }),
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
    onAttach,
    attachment,
    disabled,
    busy,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    onSend: () => void;
    onAttach: (source: 'camera' | 'library') => void;
    attachment?: string | null;
    disabled: boolean;
    busy: boolean;
  }) => {
    const { TextInput, Button, View, Text } = require('react-native');
    return (
      <View>
        <Button
          title="Choose from Library"
          onPress={() => onAttach('library')}
        />
        {attachment ? <Text>{'attached:' + attachment}</Text> : null}
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

jest.mock('../../src/utils/pickImage', () => ({
  pickImageFromCamera: jest.fn(),
  pickImagesFromLibrary: jest.fn(async () => [{ uri: 'file:///meal.jpg' }]),
}));
jest.mock('../../src/services/online/markai', () => ({
  ...jest.requireActual('../../src/services/online/markai'),
  prepareMarkaiImage: jest.fn(async () => ({
    uri: 'file:///meal-small.jpg',
    data: 'data:image/jpeg;base64,AAAA',
  })),
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

it('opens food details for confirmation even when MarkAI requests logging', async () => {
  jest.mocked(onlineRequest).mockResolvedValueOnce({
    ...reply,
    reply: {
      ...reply.reply,
      log_requested: true,
      food: {
        name: 'Oats',
        serving: 'bowl',
        calories: 300,
        protein: 12,
        carbs: 45,
        fat: 8,
      },
    },
  });
  const screen = render(<MarkaiScreen />);
  await waitFor(() => expect(screen.getByText('Log food')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Message MarkAI'), 'Log oats');
  fireEvent.press(screen.getByText('Send'));
  await waitFor(() => expect(screen.getByText('Oats')).toBeTruthy());
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Log food'));
  expect(mockNavigate).toHaveBeenCalledWith(
    'FoodEntryAdd',
    expect.objectContaining({
      item: expect.objectContaining({
        name: 'Oats',
        source: 'external',
        calories: 300,
        protein: 12,
      }),
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  );
});

it('uses the same chat for the legacy Tracker route and shows prompt choices without a greeting', async () => {
  expect(MacrosScreen).toBe(MarkaiScreen);
  const screen = render(<MarkaiScreen />);
  await waitFor(() => expect(screen.getByText('Log food')).toBeTruthy());
  expect(screen.queryByText("Hi, I'm MarkAI.")).toBeNull();
  fireEvent.press(screen.getByText('Log food'));
  expect(screen.getByLabelText('Message MarkAI').props.value).toBe(
    'Help me log my meal: '
  );
  expect(screen.queryByText('More ideas')).toBeNull();
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

it('sends a library photo with no text and shows it in the chat', async () => {
  jest.mocked(onlineRequest).mockResolvedValueOnce(reply);
  const screen = render(<MarkaiScreen />);
  await waitFor(() => expect(screen.getByText('Send')).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByText('Choose from Library'));
  });
  expect(screen.getByText('attached:file:///meal-small.jpg')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText('Send'));
  });
  expect(onlineRequest).toHaveBeenLastCalledWith(
    '/markai/messages',
    expect.objectContaining({ image: 'data:image/jpeg;base64,AAAA' })
  );
  expect(jest.mocked(onlineRequest).mock.lastCall?.[1]).not.toHaveProperty(
    'prompt'
  );
  await waitFor(() =>
    expect(screen.getByText('Here is your answer.')).toBeTruthy()
  );
  expect(screen.getByLabelText('Photo')).toBeTruthy();
  expect(screen.queryByText(/^attached:/)).toBeNull();
});

it('signed out, shows a still screen with sign-in pinned in the footer', () => {
  mockSignedIn = false;
  const screen = render(<MarkaiScreen />);
  expect(
    screen.UNSAFE_queryByType(require('react-native').ScrollView)
  ).toBeNull();
  expect(screen.getByText('Sign in with Apple')).toBeTruthy();
  expect(screen.getByText(/Sign in to get 100 AI coins/)).toBeTruthy();
  expect(screen.getByText('Training help')).toBeTruthy();
});
