import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RingCalendarSheet from '../../src/components/RingCalendarSheet';
import { fetchActivityRingsRange } from '../../src/services/api/measurementsApi';

// The real list defers rendering to viewability callbacks that do not fire
// under test; rendering every row is what lets the assertions below speak
// about which months actually requested their data.
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    BottomSheetFlatList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    }) => (
      <View>
        {data.map((item, index) => (
          <View key={index}>{renderItem({ item, index })}</View>
        ))}
      </View>
    ),
  };
});

jest.mock('../../src/components/CustomModal', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        { children, title }: { children: React.ReactNode; title?: string },
        ref: unknown
      ) => {
        React.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          dismiss: jest.fn(),
        }));
        const { Text } = require('react-native');
        return (
          <View>
            <Text testID="sheet-title">{title}</Text>
            {children}
          </View>
        );
      }
    ),
  };
});

jest.mock('../../src/services/api/measurementsApi', () => ({
  fetchActivityRingsRange: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../src/utils/calendarLocalization', () => ({
  useCalendarPresentation: () => ({
    appLocale: 'en',
    presentation: { firstDayOfWeek: 1 },
  }),
  getCalendarMonthNames: () => [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ],
  getCalendarWeekdayShortNames: () => ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
}));

const mockFetch = fetchActivityRingsRange as jest.MockedFunction<
  typeof fetchActivityRingsRange
>;

const renderSheet = (selectedDate: string) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <QueryClientProvider client={new QueryClient()}>
        <RingCalendarSheet selectedDate={selectedDate} onSelectDate={jest.fn()} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );

beforeEach(() => jest.clearAllMocks());

// Regression: activeMonths was only ever filled by onViewableItemsChanged, so
// when that did not fire no month fetched and every day drew an empty ring.
test('the open month requests its rings without any viewability callback', async () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const selected = `${today.getFullYear()}-${month}-15`;

  renderSheet(selected);

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  const requestedStarts = mockFetch.mock.calls.map((call) => call[0]);
  expect(
    requestedStarts.some((start) =>
      start.startsWith(`${today.getFullYear()}-${month}`)
    )
  ).toBe(true);
});

// Regression: the list was built oldest-first and relied on initialScrollIndex
// to jump to the current month. That jump did not land inside the bottom
// sheet, so the calendar opened twelve months in the past — on months with no
// data, and therefore no rings.
test('opens on the current month, not twelve months back', async () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const { getAllByText } = renderSheet(
    `${today.getFullYear()}-${month}-15`
  );

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  // The month the sheet asks for first is the one it is showing.
  const firstRequestedStart = mockFetch.mock.calls[0][0];
  expect(firstRequestedStart).toBe(
    `${today.getFullYear()}-${month}-01`
  );
  expect(
    getAllByText(
      new RegExp(String(today.getFullYear()))
    ).length
  ).toBeGreaterThan(0);
});

// The month name belongs to the sheet header, not to each page: it stays put
// while the grids slide underneath.
test('names the visible month and year in the sheet header', async () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ];

  const { getByTestId } = renderSheet(`${today.getFullYear()}-${month}-15`);

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  expect(getByTestId('sheet-title').props.children).toBe(
    `${monthNames[today.getMonth()]} ${today.getFullYear()}`
  );
});
