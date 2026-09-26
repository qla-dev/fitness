import { activityTelemetry } from '../../src/utils/activityTelemetry';
import { RECORDING_DETAIL_TYPE } from '../../src/services/recording/types';

const detail = (detail_type: string, detail_data: unknown) => ({
  id: '1',
  provider_name: 'HealthKit',
  detail_type,
  detail_data,
});
it('reads saved indoor sensor samples after serialization', () => {
  const rows = [
    detail(RECORDING_DETAIL_TYPE, {
      points: [],
      sensors: [
        { timestamp: 2000, heartRate: 130 },
        { timestamp: 1000, heartRate: 120 },
        { timestamp: 3000, heartRate: null },
      ],
    }),
  ];
  expect(
    activityTelemetry(JSON.parse(JSON.stringify(rows))).hr.map(
      (sample) => sample.bpm
    )
  ).toEqual([120, 130]);
});
it('reads flat and nested synced heart-rate records', () => {
  const samples = [{ t: '2026-09-26T12:00:00Z', bpm: 125 }];
  for (const data of [
    { hr_samples: samples },
    { raw_data: { hr_samples: samples } },
  ]) {
    expect(activityTelemetry([detail('health_import', data)]).hr).toEqual([
      { t: '2026-09-26T12:00:00.000Z', bpm: 125 },
    ]);
  }
});
it('does not invent samples from an average or invalid readings', () => {
  expect(
    activityTelemetry([
      detail('health_import', {
        avg_heart_rate: 120,
        hr_samples: [
          { t: 'bad', bpm: 100 },
          { t: 1000, bpm: 0 },
        ],
      }),
    ]).hr
  ).toEqual([]);
});
