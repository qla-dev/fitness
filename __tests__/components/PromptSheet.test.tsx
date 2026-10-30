import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import PromptSheet, {
  dismissPromptSheet,
  PromptSheetScreen,
} from '../../src/components/ui/PromptSheet';

// A tiny stand-in for the root stack: the routes, and the listeners each
// Sheet route registered for `beforeRemove`.
type Route = { key: string; name: string; params?: { owner: number } };
const mockStack: Route[] = [{ key: 'tabs', name: 'Tabs' }];
const mockRemoveListeners = new Map<string, () => void>();
let mockKey = 0;

const mockRemove = (key: string) => {
  const index = mockStack.findIndex((route) => route.key === key);
  if (index < 0) return;
  mockStack.splice(index, 1);
  mockRemoveListeners.get(key)?.();
};

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: () => true,
    getRootState: () => ({ routes: mockStack }),
    getCurrentRoute: () => mockStack[mockStack.length - 1],
    dispatch: (
      action:
        | {
            type: string;
            payload?: { name: string; params: { owner: number } };
          }
        | ((state: { routes: Route[] }) => { payload: { routes: Route[] } })
    ) => {
      if (typeof action === 'function') {
        const next = action({ routes: [...mockStack] }).payload.routes;
        [...mockStack]
          .filter((route) => !next.includes(route))
          .forEach((route) => mockRemove(route.key));
        return;
      }
      if (action.type === 'PUSH' && action.payload) {
        mockStack.push({
          key: `sheet-${++mockKey}`,
          name: action.payload.name,
          params: action.payload.params,
        });
      }
      if (action.type === 'POP')
        mockRemove(mockStack[mockStack.length - 1].key);
    },
  },
}));

let mockScreenKey = '';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => mockStack.find((route) => route.key === mockScreenKey),
  useNavigation: () => ({
    addListener: (_event: string, listener: () => void) => {
      const key = mockScreenKey;
      mockRemoveListeners.set(key, listener);
      return () => mockRemoveListeners.delete(key);
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

/** Renders the Sheet route at the top of the stack, as the navigator would. */
const renderTopSheet = () => {
  mockScreenKey = mockStack[mockStack.length - 1].key;
  return render(<PromptSheetScreen />);
};

beforeEach(() => {
  mockStack.splice(1);
  mockRemoveListeners.clear();
});

const Owner = ({
  open,
  title = 'Pick one',
  label,
  onClose,
}: {
  open: boolean;
  title?: string;
  label: string;
  onClose: () => void;
}) => (
  <PromptSheet open={open} onClose={onClose} headerTitle="" title={title}>
    <Text>{label}</Text>
  </PromptSheet>
);

it('opens a Sheet route showing the owner’s live content', () => {
  const onClose = jest.fn();
  const owner = render(<Owner open={false} label="First" onClose={onClose} />);
  expect(mockStack).toHaveLength(1);

  owner.rerender(<Owner open label="First" onClose={onClose} />);
  expect(mockStack[1].name).toBe('Sheet');
  const route = renderTopSheet();
  expect(route.getByText('Pick one')).toBeTruthy();
  expect(route.getByText('First')).toBeTruthy();

  // The owner re-renders with new state: the open sheet shows it at once.
  owner.rerender(<Owner open label="Second" onClose={onClose} />);
  expect(route.getByText('Second')).toBeTruthy();
});

it('closes its route when the owner closes it, without calling onClose', () => {
  const onClose = jest.fn();
  const owner = render(<Owner open label="Body" onClose={onClose} />);
  renderTopSheet();
  owner.rerender(<Owner open={false} label="Body" onClose={onClose} />);
  expect(mockStack).toHaveLength(1);
  expect(onClose).not.toHaveBeenCalled();
});

it('tells the owner when the route closes by itself (close button, swipe, Back)', () => {
  const onClose = jest.fn();
  render(<Owner open label="Body" onClose={onClose} />);
  const route = renderTopSheet();
  act(() => mockRemove(mockStack[1].key));
  expect(onClose).toHaveBeenCalledTimes(1);
  route.rerender(<PromptSheetScreen />);
  expect(route.queryByText('Body')).toBeNull();
});

it('stacks a sheet opened from inside another, and closing it returns to the first', () => {
  const closeOuter = jest.fn();
  const closeInner = jest.fn();
  render(<Owner open title="History" label="Fasts" onClose={closeOuter} />);
  const outer = renderTopSheet();
  const inner = render(
    <Owner open={false} title="Edit" label="One fast" onClose={closeInner} />
  );
  inner.rerender(
    <Owner open title="Edit" label="One fast" onClose={closeInner} />
  );
  expect(mockStack.map((route) => route.name)).toEqual([
    'Tabs',
    'Sheet',
    'Sheet',
  ]);
  inner.rerender(
    <Owner open={false} title="Edit" label="One fast" onClose={closeInner} />
  );
  expect(mockStack).toHaveLength(2);
  expect(outer.getByText('History')).toBeTruthy();
  expect(closeOuter).not.toHaveBeenCalled();
});

it('closes the top sheet at once for an action that navigates right after', () => {
  const onClose = jest.fn();
  render(<Owner open label="Body" onClose={onClose} />);
  renderTopSheet();
  dismissPromptSheet();
  expect(mockStack).toHaveLength(1);
  expect(onClose).not.toHaveBeenCalled();
});
