import React from 'react';
import { render, screen } from '@testing-library/react-native';
import FlashOverlay from '../../src/components/ui/FlashOverlay';

jest.mock('../../src/services/haptics', () => ({
  fireSuccessHaptic: jest.fn(),
}));

it('shows the result with where it falls on the scale', () => {
  render(
    <FlashOverlay
      visible
      icon="scale"
      eyebrow="Your BMI"
      value="27.1"
      title="Overweight"
      caption="From your height and weight."
      meter={{
        position: 0.48,
        segments: [
          { weight: 3.5, color: '#00f' },
          { weight: 6.5, color: '#0f0' },
          { weight: 5, color: '#fa0' },
          { weight: 10, color: '#f00' },
        ],
        ticks: [
          { at: 0.14, label: '18.5' },
          { at: 0.4, label: '25' },
          { at: 0.6, label: '30' },
        ],
      }}
      onDone={jest.fn()}
    />
  );
  expect(screen.getByText('27.1')).toBeTruthy();
  expect(screen.getByText('Overweight')).toBeTruthy();
  expect(screen.getByText('18.5')).toBeTruthy();
  expect(screen.getByText('30')).toBeTruthy();
});

it('breaks a plan down into its tiles, and reads them out as one', () => {
  render(
    <FlashOverlay
      visible
      icon="flame"
      eyebrow="Your daily goals"
      value="2,400"
      title="kcal a day"
      stats={[
        {
          key: 'protein',
          icon: 'fish',
          color: '#0f0',
          label: 'Protein',
          value: '150 g',
        },
        {
          key: 'carbs',
          icon: 'leaf',
          color: '#a0f',
          label: 'Carbs',
          value: '260 g',
        },
        {
          key: 'fat',
          icon: 'hydration',
          color: '#fa0',
          label: 'Fat',
          value: '80 g',
        },
      ]}
      onDone={jest.fn()}
    />
  );
  expect(screen.getByText('150 g')).toBeTruthy();
  expect(screen.getByText('Carbs')).toBeTruthy();
  expect(
    screen.getByLabelText(
      'Your daily goals, 2,400, kcal a day, Protein 150 g, Carbs 260 g, Fat 80 g'
    )
  ).toBeTruthy();
});
