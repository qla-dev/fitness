import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SmallGraphFact from '../../src/components/SmallGraphFact';

it('keeps a selected value and guide on release and clears both for new data', () => {
  const props = {
    title: 'Steps',
    body: 'Pace',
    icon: 'flame' as const,
    color: '#FF5500',
    formatValue: String,
    variant: 'line' as const,
    labels: ['00:00', '01:00'],
  };
  const series = [
    { label: 'Today', value: 100, values: [0, 100] },
    { label: 'Typical', value: 200, values: [0, 200] },
  ];
  const screen = render(<SmallGraphFact {...props} series={series} />);
  fireEvent(screen.getByTestId('fact-plot'), 'layout', {
    nativeEvent: { layout: { width: 300 } },
  });
  const touch = { nativeEvent: { locationX: 220, locationY: 60 } };
  fireEvent(screen.getByTestId('fact-touch-overlay'), 'touchStart', touch);
  fireEvent(screen.getByTestId('fact-touch-overlay'), 'touchEnd', touch);
  expect(screen.getByText('01:00 · Today: 100 · Typical: 200')).toBeTruthy();
  expect(screen.getByTestId('fact-touch-overlay-selection-line')).toBeTruthy();
  screen.rerender(
    <SmallGraphFact
      {...props}
      series={[{ label: 'Today', value: 300, values: [0, 300] }]}
    />
  );
  expect(screen.queryByTestId('fact-touch-overlay-selection-line')).toBeNull();
  expect(screen.queryByText('01:00 · Today: 100 · Typical: 200')).toBeNull();
});
