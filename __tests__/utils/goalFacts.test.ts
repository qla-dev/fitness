import {
  averageFact,
  stepFactPeriods,
  stepPace,
} from '../../src/utils/goalFacts';

describe('goal fact calculations', () => {
  it('includes recorded zeroes and never invents missing days', () => {
    expect(averageFact([])).toBeNull();
    expect(
      averageFact([
        { day: '2026-09-01', value: 0 },
        { day: '2026-09-03', value: 1000 },
      ])
    ).toBe(500);
  });

  it('keeps the 13-day and 15-day windows disjoint and handles January', () => {
    const points = [
      { day: '2025-12-15', value: 1 },
      { day: '2025-12-17', value: 2 },
      { day: '2025-12-18', value: 3 },
      { day: '2026-01-01', value: 4 },
      { day: '2026-01-02', value: 5 },
    ];
    const p = stepFactPeriods(points, '2026-01-01');
    expect(p.earlier.map((x) => x.value)).toEqual([1, 2]);
    expect(p.recent.map((x) => x.value)).toEqual([3, 4]);
    expect(p.thisMonth.map((x) => x.value)).toEqual([4]);
    expect(p.lastMonth.map((x) => x.value)).toEqual([1, 2, 3]);
    expect(p.thisYear).toEqual(p.thisMonth);
    expect(p.lastYear).toEqual(p.lastMonth);
  });

  it('compares cumulative steps at the same hour and excludes today from the baseline', () => {
    const points = [
      { day: '2026-09-01', value: 240, hourly: Array(24).fill(10) },
      { day: '2026-09-02', value: 720, hourly: Array(24).fill(30) },
      { day: '2026-09-03', value: 2400, hourly: Array(24).fill(100) },
    ];
    expect(stepPace(points, '2026-09-03', 1)).toEqual({
      current: [0, 100, 200],
      typical: [0, 20, 40],
    });
    expect(stepPace([], '2026-09-03', 1)).toEqual({ current: [], typical: [] });
  });
});
