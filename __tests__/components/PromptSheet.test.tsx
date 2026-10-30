import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import PromptSheet, {
  dismissPromptSheet,
  PromptSheetScreen,
} from '../../src/components/ui/PromptSheet';

const mockRoute = { name: 'Tabs' };
const mockNavigate = jest.fn((name: string) => {
  mockRoute.name = name;
});
const mockDispatch = jest.fn(() => {
  mockRoute.name = 'Tabs';
  mockRemove?.();
});
let mockRemove: (() => void) | undefined;

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => mockRoute,
    navigate: (name: string) => mockNavigate(name),
    dispatch: () => mockDispatch(),
  },
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    addListener: (_event: string, listener: () => void) => {
      mockRemove = listener;
      return () => {
        mockRemove = undefined;
      };
    },
  }),
}));
jest.mock('../../src/components/ui/PromptScreen', () => {
  const { Text: RNText, View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <View>
        <RNText>{title}</RNText>
        {children}
      </View>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute.name = 'Tabs';
});

const Owner = ({
  open,
  label,
  onClose,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
}) => (
  <PromptSheet open={open} onClose={onClose} headerTitle="" title="Pick one">
    <Text>{label}</Text>
  </PromptSheet>
);

it('opens the Sheet route and shows the owner’s live content there', () => {
  const onClose = jest.fn();
  const route = render(<PromptSheetScreen />);
  const owner = render(<Owner open={false} label="First" onClose={onClose} />);
  expect(mockNavigate).not.toHaveBeenCalled();

  owner.rerender(<Owner open label="First" onClose={onClose} />);
  expect(mockNavigate).toHaveBeenCalledWith('Sheet');
  expect(route.getByText('Pick one')).toBeTruthy();
  expect(route.getByText('First')).toBeTruthy();

  // The owner re-renders with new state: the open sheet shows it at once.
  owner.rerender(<Owner open label="Second" onClose={onClose} />);
  expect(route.getByText('Second')).toBeTruthy();
});

it('closes the route when the owner closes it, without calling onClose', () => {
  const onClose = jest.fn();
  render(<PromptSheetScreen />);
  const owner = render(<Owner open label="Body" onClose={onClose} />);
  owner.rerender(<Owner open={false} label="Body" onClose={onClose} />);
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

it('tells the owner when the route closes by itself (close button, swipe, Back)', () => {
  const onClose = jest.fn();
  const route = render(<PromptSheetScreen />);
  render(<Owner open label="Body" onClose={onClose} />);
  act(() => mockRemove?.());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(route.queryByText('Body')).toBeNull();
});

it('closes at once for an action that navigates right after', () => {
  const onClose = jest.fn();
  render(<PromptSheetScreen />);
  render(<Owner open label="Body" onClose={onClose} />);
  dismissPromptSheet();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});
