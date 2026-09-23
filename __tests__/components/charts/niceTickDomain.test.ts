import { niceTickDomain } from '../../../src/components/charts/chartFormatting';

// d3's step for a span over five ticks, which is how Victory places them.
const step = (span: number) => {
  const rough = span / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const error = rough / power;
  return (
    (error >= Math.sqrt(50)
      ? 10
      : error >= Math.sqrt(10)
        ? 5
        : error >= Math.sqrt(2)
          ? 2
          : 1) * power
  );
};

describe('niceTickDomain', () => {
  it('rounds the top up to the next tick', () => {
    expect(niceTickDomain(0, 16500, 5)).toEqual([0, 20000]);
    expect(niceTickDomain(0, 7600, 5)).toEqual([0, 8000]);
    expect(niceTickDomain(0, 993, 5)).toEqual([0, 1000]);
  });

  it('widens both ends of an offset domain', () => {
    expect(niceTickDomain(71.3, 74.8, 5)).toEqual([71, 75]);
  });

  it('always ends on a tick of the domain it returns', () => {
    for (const max of [1, 37, 993, 4100, 7600, 10100, 15000, 16500, 187223]) {
      const [low, high] = niceTickDomain(0, max, 5);
      expect(high).toBeGreaterThanOrEqual(max);
      const ticks = (high - low) / step(high - low);
      expect(Math.abs(ticks - Math.round(ticks))).toBeLessThan(1e-9);
    }
  });

  it('passes a flat domain through', () => {
    expect(niceTickDomain(0, 0, 5)).toEqual([0, 0]);
    expect(niceTickDomain(72, 72, 5)).toEqual([72, 72]);
  });
});
