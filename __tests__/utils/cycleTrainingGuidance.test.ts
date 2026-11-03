import type { TFunction } from 'i18next';
import {
  trainingGuidanceFor,
  trainingGuidanceCopy,
} from '../../src/utils/cycleTrainingGuidance';
import type { CyclePredictionData } from '../../src/hooks/useCyclePredictionData';

const data = (
  day: number,
  phase: string,
  extra: Partial<CyclePredictionData> = {}
): CyclePredictionData =>
  ({
    day,
    phase,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    fertileStartDay: null,
    fertileEndDay: null,
    ovulationDay: null,
    nextPeriodStart: '2026-11-29',
    daysLate: 0,
    prediction: { cycles: [] },
    ...extra,
  }) as unknown as CyclePredictionData;

describe('trainingGuidanceFor', () => {
  it('marks the first two period days as tough rest days', () => {
    expect(
      trainingGuidanceFor(data(1, 'menstrual'), '2026-11-01')
    ).toMatchObject({ kind: 'periodHeavy', tough: true });
    expect(trainingGuidanceFor(data(2, 'menstrual'), '2026-11-02').tough).toBe(
      true
    );
  });

  it('keeps the rest of the period light but not tough', () => {
    expect(
      trainingGuidanceFor(data(4, 'menstrual'), '2026-11-04')
    ).toMatchObject({ kind: 'period', tough: false });
  });

  it('flags the last three days before a predicted period', () => {
    expect(trainingGuidanceFor(data(26, 'luteal'), '2026-11-26')).toMatchObject(
      {
        kind: 'premenstrual',
        tough: true,
        daysToPeriod: 3,
      }
    );
    expect(trainingGuidanceFor(data(20, 'luteal'), '2026-11-20')).toMatchObject(
      {
        kind: 'steady',
        tough: false,
      }
    );
  });

  it('suits hard work from the follicular phase to ovulation', () => {
    for (const phase of ['follicular', 'fertile', 'ovulation'])
      expect(trainingGuidanceFor(data(10, phase), '2026-11-10').kind).toBe(
        'peak'
      );
  });

  it('does not warn on a late period', () => {
    expect(
      trainingGuidanceFor(
        data(31, 'luteal', { daysLate: 2, nextPeriodStart: '2026-11-29' }),
        '2026-12-01'
      )
    ).toMatchObject({ kind: 'steady', tough: false });
  });
});

describe('trainingGuidanceCopy', () => {
  const t = ((_key: string, options: { defaultValue: string }) =>
    options.defaultValue) as unknown as TFunction;

  it('keeps cycle words out of discreet copy', () => {
    const copy = trainingGuidanceCopy(
      t,
      trainingGuidanceFor(data(1, 'menstrual'), '2026-11-01'),
      true
    );
    expect(copy.title).not.toMatch(/cycle|period/i);
    expect(copy.body).not.toMatch(/cycle|period/i);
  });
});
