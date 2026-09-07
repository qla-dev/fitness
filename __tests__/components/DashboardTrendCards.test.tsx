import { render } from '@testing-library/react-native';
import DashboardTrendCards from '../../src/components/DashboardTrendCards';
import HealthTrendCard from '../../src/components/HealthTrendCard';
import { addDays, getTodayDate } from '../../src/utils/dateUtils';

jest.mock('../../src/components/HealthTrendCard', () => jest.fn(() => null));
jest.mock('../../src/components/SleepTimelineChart', () => () => null);
jest.mock('../../src/components/StepsBarChart', () => () => null);
jest.mock('../../src/components/WeightLineChart', () => () => null);

const today = getTodayDate();
const yesterday = addDays(today, -1);
const props = {
  range: '7d' as const,
  weightUnit: 'kg' as const,
  visibleTrends: ['weight', 'sleep'] as const,
  steps: { data: [], isLoading: false, isError: false },
  weight: {
    data: [
      { day: yesterday, weight: 80 },
      { day: today, weight: 82 },
    ],
    isLoading: false,
    isError: false,
  },
  sleep: {
    data: [
      {
        day: yesterday,
        timeAsleepSeconds: 21600,
        timeInBedSeconds: 28800,
        segments: [],
        zone: null,
      },
      {
        day: today,
        timeAsleepSeconds: null,
        timeInBedSeconds: 28800,
        segments: [],
        zone: null,
      },
    ],
    isLoading: false,
    isError: false,
    nightsWithData: 2,
    averageTimeInBedSeconds: 28800,
    averageTimeAsleepSeconds: 21600,
  },
};

beforeEach(() => jest.clearAllMocks());

it('averages recorded values without treating missing nights and weigh-ins as zero', () => {
  render(<DashboardTrendCards {...props} />);
  const cards = jest.mocked(HealthTrendCard).mock.calls.map(([card]) => card);
  expect(cards[0].average).toBe(81);
  expect(cards[1].average).toBe(6);
  expect(cards[1].values.at(-1)).toBeNull();
  expect(cards[0].values).toHaveLength(7);
});

it('preserves configured visibility and order', () => {
  render(<DashboardTrendCards {...props} visibleTrends={['sleep']} />);
  const cards = jest.mocked(HealthTrendCard).mock.calls.map(([card]) => card);
  expect(cards).toHaveLength(1);
  expect(cards[0].icon).toBe('sleep-bedtime');
});

it('keeps empty data unavailable rather than claiming a zero average', () => {
  render(
    <DashboardTrendCards
      {...props}
      weight={{ data: [], isLoading: false, isError: false }}
      visibleTrends={['weight']}
    />
  );
  expect(jest.mocked(HealthTrendCard).mock.calls[0][0].average).toBeNull();
});
