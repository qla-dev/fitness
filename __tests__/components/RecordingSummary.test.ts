import { recordingDetailStats } from '../../src/components/recording/RecordingSummary';

jest.mock('../../src/components/RouteMap', () => () => null);

const t = (key: string, options?: Record<string, unknown>) =>
  String(options?.defaultValue ?? key).replace(
    '{{unit}}',
    String(options?.unit ?? '')
  );
const detail = {
  version: 1 as const,
  sport: 'run' as const,
  maxSpeed: 4.2,
  elevationGain: 12,
  avgHeartRate: 140,
  maxHeartRate: 171,
  avgCadence: null,
  points: [],
  sensors: [],
};

it('turns recorder readings into workout detail tiles', () => {
  const stats = recordingDetailStats(detail, 'km', t, true);
  expect(stats.map(({ label, value, unit }) => [label, value, unit])).toEqual([
    ['Max speed', '15.1', 'km/h'],
    ['Elevation gain', '12', 'm'],
    ['Maximum heart rate', '171', 'bpm'],
  ]);
});

it('adds the recorded average heart rate only when the session lacks one', () => {
  const labels = recordingDetailStats(detail, 'km', t, false).map(
    (stat) => stat.label
  );
  expect(labels).toContain('Average heart rate');
});
