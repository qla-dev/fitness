import { StatusBar, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import AnchoredMenu from '../../src/components/AnchoredMenu';

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

const anchor = { x: 1100, y: 192, width: 132, height: 132 };

/**
 * The anchor and this menu's own overlay are both screen-absolute under
 * Android edge-to-edge, so nothing is added for the status bar. A height was
 * once added back here, which pushed every menu down by that much.
 */
describe('AnchoredMenu placement', () => {
  it('sits just under the trigger, with no status-bar height added', () => {
    jest.replaceProperty(StatusBar, 'currentHeight', 156);

    const { getByTestId } = render(
      <AnchoredMenu
        visible
        anchor={anchor}
        items={[{ key: 'all', label: 'All', onPress: jest.fn() }]}
        onClose={jest.fn()}
      />
    );

    const style = StyleSheet.flatten(
      getByTestId('anchored-menu-panel').props.style ?? {}
    ) as { top?: number };
    expect(style.top).toBe(anchor.y + anchor.height + 6);
  });
});
