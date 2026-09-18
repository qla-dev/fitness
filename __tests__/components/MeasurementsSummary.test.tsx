import React from 'react';
import { render } from '@testing-library/react-native';
import MeasurementsSummary from '../../src/components/MeasurementsSummary';

jest.mock('../../src/components/Icon', () => 'Icon');

jest.mock('../../src/components/icons/measurements', () => ({
  MeasurementIcons: {},
}));

jest.mock('uniwind', () => ({
  useCSSVariable: jest.fn(() => ['#000', '#666']),
  useUniwind: jest.fn(() => ({ theme: 'light' })),
}));

// The card renders the More sheet beside its tiles; the sheet itself is
// covered by its own test, and mounting the real bottom-sheet modal here would
// only drag native sheet chrome into a tile-rendering test.
jest.mock('../../src/components/MoreMeasurementsSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(() => null),
  };
});

const customEntry = (name: string, source: string, value: string) => ({
  id: `entry-${name}`,
  category_id: `cat-${name}`,
  value,
  entry_date: '2024-06-15',
  source,
  custom_categories: {
    id: `cat-${name}`,
    name,
    measurement_type: '',
    frequency: 'Daily',
  },
});

describe('MeasurementsSummary', () => {
  // A card that disappears on the days you have not weighed yourself hides the
  // prompt on exactly the day it is worth something, so weight and body fat
  // always render — with a placeholder where the value would be.
  test('always renders weight and body fat, with a placeholder when unrecorded', () => {
    const { getByText, getAllByText } = render(
      <MeasurementsSummary measurements={undefined} date="2024-06-15" />
    );
    expect(getByText('Weight')).toBeTruthy();
    expect(getByText('Body fat %')).toBeTruthy();
    expect(getAllByText('—')).toHaveLength(2);
  });

  test('a day with no values still renders the two standing tiles', () => {
    const { getByText, getAllByText } = render(
      <MeasurementsSummary
        measurements={{ entry_date: '2024-06-15' }}
        date="2024-06-15"
      />
    );
    expect(getByText('Weight')).toBeTruthy();
    expect(getAllByText('—')).toHaveLength(2);
  });

  test('offers More, which opens the full list', () => {
    const { getByLabelText } = render(
      <MeasurementsSummary measurements={undefined} date="2024-06-15" />
    );
    expect(getByLabelText('More')).toBeTruthy();
  });

  test('shows measurements section header', () => {
    const { getByText } = render(
      <MeasurementsSummary
        measurements={{ entry_date: '2024-06-15', weight: 75 }}
        customMeasurements={[]}
        date="2024-06-15"
      />
    );
    expect(getByText('Measurements')).toBeTruthy();
  });

  // The card sits above the meal list, so its height has to be the same every
  // day. Anything else the day happens to hold lives behind More, which is why
  // neither a recorded built-in nor a custom entry may add a tile here.
  test('shows only weight and body fat, whatever else the day holds', () => {
    const { getByText, queryByText } = render(
      <MeasurementsSummary
        measurements={{
          entry_date: '2024-06-15',
          weight: 75,
          steps: 10000,
          waist: 84,
        }}
        customMeasurements={
          [
            customEntry('Blood Pressure', 'manual', '120'),
            customEntry('Resting Heart Rate', 'healthkit', '58'),
          ] as React.ComponentProps<
            typeof MeasurementsSummary
          >['customMeasurements']
        }
        date="2024-06-15"
      />
    );
    expect(getByText('Weight')).toBeTruthy();
    expect(getByText('Body fat %')).toBeTruthy();
    expect(queryByText('Steps')).toBeNull();
    expect(queryByText('Waist')).toBeNull();
    expect(queryByText('Blood Pressure')).toBeNull();
    expect(queryByText('Resting Heart Rate')).toBeNull();
  });

  // Height moved to the profile: it is a standing fact about the person, not
  // something recorded alongside a weigh-in.
  test('never shows height, even on a day that recorded one', () => {
    const { queryByText } = render(
      <MeasurementsSummary
        measurements={{ entry_date: '2024-06-15', weight: 75, height: 180 }}
        date="2024-06-15"
      />
    );
    expect(queryByText('Height')).toBeNull();
    expect(queryByText('180 cm')).toBeNull();
  });

  // The question the tile is asked every day is "did I measure this today",
  // and an empty tile has to answer it as plainly as a stale one does.
  test('says when body fat was not recorded today', () => {
    const { getAllByText } = render(
      <MeasurementsSummary
        measurements={{ entry_date: '2024-06-15', weight: 75 }}
        date="2024-06-15"
      />
    );
    // Weight was recorded, body fat was not, so exactly one tile says so.
    expect(getAllByText('Not recorded today')).toHaveLength(1);
  });

  // The corner always answers, because a blank one reads as a tile still
  // loading. Three answers: not recorded, what came before, or nothing did.
  test('a reading recorded today shows what came before it', () => {
    const { getByText } = render(
      <MeasurementsSummary
        measurements={{ entry_date: '2024-06-15', weight: 80 }}
        history={
          {
            weight: { shown: 80, shownDate: '2024-06-15', previous: 79 },
            body_fat_percentage: {
              shown: null,
              shownDate: null,
              previous: null,
            },
          } as React.ComponentProps<typeof MeasurementsSummary>['history']
        }
        date="2024-06-15"
      />
    );
    expect(getByText('Previous: 79 kg')).toBeTruthy();
  });

  test('a reading with nothing before it says so', () => {
    const { getByText, getAllByText } = render(
      <MeasurementsSummary
        measurements={{
          entry_date: '2024-06-15',
          weight: 80,
          body_fat_percentage: 18,
        }}
        date="2024-06-15"
      />
    );
    // Both tiles were recorded today and neither has a day-before reading.
    expect(getByText('Weight')).toBeTruthy();
    expect(getAllByText('No history data')).toHaveLength(2);
  });

  test('a body fat reading on the day carries no such note', () => {
    const { queryByText } = render(
      <MeasurementsSummary
        measurements={{
          entry_date: '2024-06-15',
          weight: 75,
          body_fat_percentage: 18,
        }}
        date="2024-06-15"
      />
    );
    expect(queryByText('Not recorded today')).toBeNull();
  });
});
