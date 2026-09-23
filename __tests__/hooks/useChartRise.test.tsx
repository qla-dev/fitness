import { act, renderHook } from '@testing-library/react-native';

import { useChartRise } from '../../src/hooks/useChartRise';

type Point = { day: string; steps: number };

const flatten = (point: Point): Point => ({ ...point, steps: 0 });

const advanceOneFrame = async () => {
  await act(async () => {
    jest.advanceTimersByTime(32);
  });
};

describe('useChartRise', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('draws one flat frame, then the real series', async () => {
    const data: Point[] = [
      { day: '2026-09-21', steps: 4000 },
      { day: '2026-09-22', steps: 6000 },
    ];

    const { result, rerender } = renderHook(() => useChartRise(data, flatten));

    expect(result.current.map((point) => point.steps)).toEqual([0, 0]);

    await advanceOneFrame();
    rerender(undefined);

    expect(result.current).toBe(data);
  });

  it('reveals a dataset that lands in the same commit as the opening frame', async () => {
    // The regression, and the reason a goal opened for the first time showed an
    // empty plot under a correctly scaled axis until you left and came back. A
    // resolving query and a scheduled frame batch into one commit; keyed on a
    // stored `risen` flag alone, that commit put the flag back to the value it
    // already held, so the effect's dependencies never changed, nothing was
    // rescheduled, and the flat frame became permanent. On the second visit the
    // data was cached at mount and the two never coincided.
    const empty: Point[] = [];
    const loaded: Point[] = [{ day: '2026-09-22', steps: 6000 }];

    const { result, rerender } = renderHook(
      ({ data }: { data: Point[] }) => useChartRise(data, flatten),
      { initialProps: { data: empty } }
    );

    await act(async () => {
      jest.advanceTimersByTime(32);
      rerender({ data: loaded });
    });

    // The frame that commit must have re-armed. Without it nothing is pending
    // and the flat frame is permanent, which is what shipped.
    await advanceOneFrame();
    rerender({ data: loaded });

    expect(result.current).toBe(loaded);
  });

  it('reveals the data even when the caller rebuilds its array every render', async () => {
    // `query.data?.stepsData ?? []` handed down a new array on every render
    // while the query was in flight. The range hooks return a shared constant
    // now, but the hook must not depend on that to eventually show something.
    let loaded: Point[] | null = null;
    const { result, rerender } = renderHook(() =>
      useChartRise(loaded ?? [], flatten)
    );

    await advanceOneFrame();
    loaded = [{ day: '2026-09-22', steps: 6000 }];
    rerender(undefined);
    await advanceOneFrame();
    rerender(undefined);

    expect(result.current).toBe(loaded);
  });

  it('flattens again when a new range lands, and reveals it too', async () => {
    const week: Point[] = [{ day: '2026-09-22', steps: 6000 }];
    const month: Point[] = [{ day: '2026-08-22', steps: 9000 }];

    const { result, rerender } = renderHook(
      ({ data }: { data: Point[] }) => useChartRise(data, flatten),
      { initialProps: { data: week } }
    );

    await advanceOneFrame();
    rerender({ data: week });
    expect(result.current).toBe(week);

    rerender({ data: month });
    expect(result.current.map((point) => point.steps)).toEqual([0]);

    await advanceOneFrame();
    rerender({ data: month });
    expect(result.current).toBe(month);
  });
});
