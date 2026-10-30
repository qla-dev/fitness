import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ActionSheet, {
  type ActionSheetItem,
  type ActionSheetRef,
} from '../../src/components/ActionSheet';
import { dismissPromptSheet } from '../../src/components/ui/PromptSheet';

let mockHeaderRight: { label: string; onPress: () => void } | undefined;
jest.mock('../../src/components/ui/PromptSheet', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    dismissPromptSheet: jest.fn(),
    default: ({
      open,
      title,
      headerRight,
      children,
    }: {
      open: boolean;
      title: string;
      headerRight?: { label: string; onPress: () => void };
      children: React.ReactNode;
    }) => {
      mockHeaderRight = headerRight;
      return open ? (
        <View>
          <Text>{title}</Text>
          {children}
        </View>
      ) : null;
    },
  };
});

const items = (
  overrides: Partial<ActionSheetItem>[] = []
): ActionSheetItem[] => [
  { key: 'edit', label: 'Edit', onPress: jest.fn(), ...overrides[0] },
  {
    key: 'delete',
    label: 'Delete',
    destructive: true,
    onPress: jest.fn(),
    ...overrides[1],
  },
];

const open = (
  ui: React.ReactElement<{ ref?: unknown }>,
  ref = createRef<ActionSheetRef>()
) => {
  const screen = render(React.cloneElement(ui, { ref }));
  act(() => ref.current?.present());
  return { screen, ref };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaderRight = undefined;
});

it('shows the title and its actions once presented', () => {
  const ref = createRef<ActionSheetRef>();
  const screen = render(<ActionSheet ref={ref} title="Meal" items={items()} />);
  expect(screen.queryByText('Meal')).toBeNull();
  act(() => ref.current?.present());
  expect(screen.getByText('Meal')).toBeTruthy();
  expect(screen.getByLabelText('Edit')).toBeTruthy();
  expect(screen.getByLabelText('Delete')).toBeTruthy();
});

it('draws one card per group', () => {
  const list: ActionSheetItem[] = [
    { key: 'a', label: 'A', group: 'one', onPress: jest.fn() },
    { key: 'b', label: 'B', group: 'one', onPress: jest.fn() },
    { key: 'c', label: 'C', group: 'two', onPress: jest.fn() },
  ];
  const { screen } = open(<ActionSheet title="Menu" items={list} />);
  expect(screen.getAllByTestId('action-sheet-group')).toHaveLength(2);
});

it('closes at once, then runs the action, then tells the owner', () => {
  const onDismiss = jest.fn();
  const list = items();
  const order: string[] = [];
  jest.mocked(dismissPromptSheet).mockImplementation(() => order.push('close'));
  jest.mocked(list[0].onPress).mockImplementation(() => order.push('action'));
  const { screen } = open(
    <ActionSheet title="Meal" items={list} onDismiss={onDismiss} />
  );
  fireEvent.press(screen.getByTestId('action-sheet-item-edit'));
  expect(order).toEqual(['close', 'action']);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Meal')).toBeNull();
});

it('stays open for an item that swaps the content in place', () => {
  const list = items([{ dismissOnPress: false }]);
  const { screen } = open(<ActionSheet title="Meal" items={list} />);
  fireEvent.press(screen.getByTestId('action-sheet-item-edit'));
  expect(list[0].onPress).toHaveBeenCalled();
  expect(dismissPromptSheet).not.toHaveBeenCalled();
  expect(screen.getByText('Meal')).toBeTruthy();
});

it('offers Back in the header only when given onBack', () => {
  const onBack = jest.fn();
  open(<ActionSheet title="Meal" items={items()} />);
  expect(mockHeaderRight).toBeUndefined();
  open(<ActionSheet title="Meal" items={items()} onBack={onBack} />);
  expect(mockHeaderRight?.label).toBe('Back');
  mockHeaderRight?.onPress();
  expect(onBack).toHaveBeenCalled();
});
