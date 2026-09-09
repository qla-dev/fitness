import {
  createIOSNativeHeaderOptions,
  createIOSSmallNativeHeaderOptions,
  createNativeHeaderIconButtonItem,
} from '../../src/utils/nativeHeaderItems';

describe('native header options', () => {
  it('uses accent color for controls and text color for titles', () => {
    const options = createIOSNativeHeaderOptions('#0A84FF', '#111827');

    expect(options.headerTintColor).toBe('#0A84FF');
    expect(options.headerTitleStyle).toMatchObject({ color: '#111827' });
    expect(options.headerLargeTitleStyle).toMatchObject({ color: '#111827' });
  });

  it('keeps small headers from enabling large titles', () => {
    const options = createIOSSmallNativeHeaderOptions('#0A84FF', '#111827');

    expect(options.headerLargeTitleEnabled).toBe(false);
    expect(options.headerTintColor).toBe('#0A84FF');
  });
});

describe('native header icon button items', () => {
  const base = {
    sfSymbol: 'cart',
    onPress: jest.fn(),
    tintColor: '#0A84FF',
    identifier: 'tab-header-cart',
    accessibilityLabel: 'Cart',
  };

  it('shares one Liquid Glass background by default', () => {
    const item = createNativeHeaderIconButtonItem(base);

    expect(item.sharesBackground).toBe(true);
  });

  /**
   * iOS 26 merges adjacent bar items that share a background into a single
   * glass capsule, so a cart next to a profile button reads as one joined
   * control. `separated` opts out of the SHARING — the button must still get
   * its own capsule, so `hidesSharedBackground` (which strips the background
   * entirely and leaves a bare glyph) is never what this sets.
   */
  it('gives a separated button its own capsule rather than none at all', () => {
    const item = createNativeHeaderIconButtonItem({ ...base, separated: true });

    expect(item.sharesBackground).toBe(false);
    expect(item.hidesSharedBackground).toBeUndefined();
  });
});
