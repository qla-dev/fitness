import { renderHook } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { useChartRise } from '../../src/hooks/useChartRise';
import { CHART_RISE_MS } from '../../src/constants/charts';

// The global mock resolves `withTiming` to its target value synchronously, so
// the shared value lands on its destination inside the effect. What each case
// asserts is therefore the destination and whether a rise was started at all —
// which is the whole contract: a chart either plays the gesture or it does not.
const timingSpy = () => jest.spyOn(Reanimated, 'withTiming');

describe('useChartRise', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stays flat while there is nothing to draw', () => {
    const withTiming = timingSpy();

    const { result } = renderHook(() => useChartRise('w:0:0', false));

    expect(result.current.value).toBe(0);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('rises on the frame the rows land, not before them', () => {
    const withTiming = timingSpy();

    const { result, rerender } = renderHook(
      ({ key, hasData }: { key: string; hasData: boolean }) =>
        useChartRise(key, hasData),
      { initialProps: { key: 'w:0:0', hasData: false } }
    );

    expect(result.current.value).toBe(0);

    rerender({ key: 'w:7:9000', hasData: true });

    expect(result.current.value).toBe(1);
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: CHART_RISE_MS })
    );
  });

  it('draws the window again when it changes, cached rows or not', () => {
    // The regression this hook was rewritten for. Keyed on the data array's
    // identity, a range whose rows were already in the query cache came back
    // with the very same array, so nothing re-ran and the chart appeared at
    // full height instead of being drawn. Tapping W after M is exactly the
    // moment the gesture is worth playing.
    const withTiming = timingSpy();

    const { rerender } = renderHook(
      ({ key }: { key: string }) => useChartRise(key, true),
      { initialProps: { key: 'w:7:9000' } }
    );

    expect(withTiming).toHaveBeenCalledTimes(1);

    rerender({ key: 'm:30:15000' });
    expect(withTiming).toHaveBeenCalledTimes(2);

    rerender({ key: 'w:7:9000' });
    expect(withTiming).toHaveBeenCalledTimes(3);
  });

  it('holds still while the window and its contents both hold still', () => {
    const withTiming = timingSpy();

    const { rerender } = renderHook(
      ({ key }: { key: string }) => useChartRise(key, true),
      { initialProps: { key: 'w:7:9000' } }
    );

    rerender({ key: 'w:7:9000' });
    rerender({ key: 'w:7:9000' });

    expect(withTiming).toHaveBeenCalledTimes(1);
  });

  it('hands over a finished chart when the system asks for less movement', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const withTiming = timingSpy();

    const { result } = renderHook(() => useChartRise('w:7:9000', true));

    expect(result.current.value).toBe(1);
    expect(withTiming).not.toHaveBeenCalled();
  });
});
