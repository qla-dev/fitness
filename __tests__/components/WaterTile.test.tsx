import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import WaterTile from '../../src/components/WaterTile';

const mockShow = jest.fn();

jest.mock('@expo/ui/community/menu', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    MenuView: React.forwardRef(
      (
        { children }: { children: React.ReactNode },
        ref: React.Ref<{ show: () => void }>
      ) => {
        React.useImperativeHandle(ref, () => ({ show: mockShow }), []);
        return <View>{children}</View>;
      }
    ),
  };
});

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
}));

describe('WaterTile long press (Android)', () => {
  let osSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    osSpy = jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => {
    if (osSpy) osSpy.restore();
  });

  /**
   * iOS opens the menu from the system's own recognizer, outside the responder
   * system. The Android shim is a JS Pressable around the tile, and the tile —
   * the deeper responder — wins the gesture, so holding it did nothing at all.
   */
  it('opens the menu itself, because the shim`s own Pressable never sees the hold', () => {
    const { getByTestId } = render(
      <WaterTile
        consumedMl={250}
        goalMl={2000}
        onPress={jest.fn()}
        onDecrease={jest.fn()}
        onChangeGoal={jest.fn()}
      />
    );

    fireEvent(getByTestId('water-tile'), 'longPress');

    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('leaves the open to the system recognizer on iOS', () => {
    osSpy?.restore();
    osSpy = jest.replaceProperty(Platform, 'OS', 'ios');

    const { getByTestId } = render(
      <WaterTile
        consumedMl={250}
        goalMl={2000}
        onPress={jest.fn()}
        onDecrease={jest.fn()}
        onChangeGoal={jest.fn()}
      />
    );

    fireEvent(getByTestId('water-tile'), 'longPress');

    expect(mockShow).not.toHaveBeenCalled();
  });

  /**
   * A tap pours a serving; the hold must not do both. Pressable drops onPress
   * once onLongPress has fired, which is what the handler is claiming.
   */
  it('does not pour a serving on the hold', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <WaterTile
        consumedMl={250}
        goalMl={2000}
        onPress={onPress}
        onDecrease={jest.fn()}
        onChangeGoal={jest.fn()}
      />
    );

    fireEvent(getByTestId('water-tile'), 'longPress');

    expect(onPress).not.toHaveBeenCalled();
  });
});
