import { render, fireEvent } from '@testing-library/react-native';
import TrendRangeSelector from '../../src/components/TrendRangeSelector';
import { HEALTH_TREND_RANGES, RANGE_DAYS } from '../../src/types/healthTrends';

/**
 * The window picker every trend screen shares.
 *
 * It replaced the same five-item array written out on three screens, so the
 * thing worth holding is that the list comes from one place: a range added to
 * the registry has to appear here without anyone editing a screen.
 */
describe('TrendRangeSelector', () => {
  test('offers every registered range, in registry order', () => {
    const { getAllByRole } = render(
      <TrendRangeSelector range="w" onSelect={jest.fn()} />
    );

    expect(getAllByRole('tab')).toHaveLength(HEALTH_TREND_RANGES.length);
  });

  test('labels them the way the Health app abbreviates them', () => {
    const { getByText } = render(
      <TrendRangeSelector range="w" onSelect={jest.fn()} />
    );

    for (const label of ['D', 'W', 'M', '6M', 'Y'])
      expect(getByText(label)).toBeTruthy();
  });

  test('reports the key behind the label that was pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TrendRangeSelector range="w" onSelect={onSelect} />
    );

    fireEvent.press(getByText('6M'));

    expect(onSelect).toHaveBeenCalledWith('6m');
  });

  test('marks only the current range as selected', () => {
    const { getAllByRole } = render(
      <TrendRangeSelector range="m" onSelect={jest.fn()} />
    );

    const selected = getAllByRole('tab').filter(
      (tab) => tab.props.accessibilityState?.selected
    );

    expect(selected).toHaveLength(1);
  });

  // The periods are what the labels promise; the day counts behind them are
  // what every chart and query actually reads.
  test('each range covers the period its label names', () => {
    expect(RANGE_DAYS).toEqual({ d: 1, w: 7, m: 30, '6m': 180, y: 365 });
  });
});
