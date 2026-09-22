import { Platform, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import FilterChipRow, { CHIP_HEIGHT } from '../../src/components/FilterChipRow';

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

const options = [
  { value: 'all', label: 'All' },
  { value: 'moving', label: 'Moving' },
];

function renderRow() {
  return render(
    <FilterChipRow
      value="all"
      options={options}
      onChange={jest.fn()}
      clearValue="all"
    />
  );
}

/**
 * Off Liquid Glass the surface falls back to `--color-chrome`, which the
 * true-black dark theme sets to black — so an unselected chip painted with it
 * disappeared into the page and only the tinted one still read as a control.
 */
describe('FilterChipRow fill without Liquid Glass', () => {
  let osSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    osSpy = jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => {
    if (osSpy) osSpy.restore();
  });

  /** The pill itself: the first ancestor carrying the chip's own height. */
  function pillStyle(label: string) {
    const { getByText } = renderRow();
    let node = getByText(label).parent;
    for (let depth = 0; depth < 10 && node; depth += 1) {
      const style = StyleSheet.flatten(node.props?.style ?? {}) as {
        height?: number;
        backgroundColor?: string;
      };
      if (style?.height === CHIP_HEIGHT) return style;
      node = node.parent;
    }
    throw new Error(`No chip pill found for ${label}`);
  }

  it('gives an unselected chip a fill of its own', () => {
    expect(pillStyle('Moving').backgroundColor).toBeTruthy();
  });

  it('gives the selected chip its tint as the fill', () => {
    // Both come out of the same surface, so the selected one must not end up
    // with the plain fill painted over its tint.
    expect(pillStyle('All').backgroundColor).toBeTruthy();
  });
});
