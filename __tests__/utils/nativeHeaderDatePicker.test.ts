import {
  createNativeHeaderDatePickerItems,
  createNativeProfileAction,
  setNativeHeaderDatePickerOptions,
} from '../../src/utils/nativeHeaderDatePicker';
import type { TFunction } from 'i18next';

describe('nativeHeaderDatePicker', () => {
  const onDatePress = jest.fn();
  const options = {
    selectedDate: '2025-01-15',
    onDatePress,
    tintColor: '#0A84FF',
    accessibilityLabel: 'Choose diary date',
    t: ((key: string, values?: { defaultValue?: string }) =>
      values?.defaultValue ?? key) as TFunction,
    locale: 'en-US',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates one tappable accent-colored date control, with no day chevrons', () => {
    const items = createNativeHeaderDatePickerItems(options);

    // The day steps by swiping the content, matching the fallback TabHeader —
    // the native header shows only the label that opens the picker.
    expect(items).toHaveLength(1);
    expect(items[0]?.identifier).toBe('date-picker');
    expect(items[0]?.tintColor).toBe('#0A84FF');
    expect(items[0]?.label).toContain('Jan 15');

    items[0]?.onPress();
    expect(onDatePress).toHaveBeenCalledTimes(1);
  });

  it('puts the day on the left so the native header can center the title', () => {
    const setOptions = jest.fn();

    setNativeHeaderDatePickerOptions({ setOptions }, options);

    expect(setOptions).toHaveBeenCalledTimes(1);
    const configuredOptions = setOptions.mock.calls[0]?.[0];
    expect(configuredOptions).toEqual({
      unstable_headerLeftItems: expect.any(Function),
      unstable_headerRightItems: undefined,
    });
    expect(configuredOptions.unstable_headerLeftItems()).toHaveLength(1);
  });

  it('puts the trailing actions on the right, profile last', () => {
    const onFamilyPress = jest.fn();
    const onProfilePress = jest.fn();
    const setOptions = jest.fn();

    setNativeHeaderDatePickerOptions(
      { setOptions },
      {
        ...options,
        trailingActions: [
          {
            sfSymbol: 'person.2.fill',
            onPress: onFamilyPress,
            accessibilityLabel: 'Open family diaries',
            identifier: 'family-diaries',
          },
          createNativeProfileAction(onProfilePress, 'Profile'),
        ],
      }
    );

    const configuredOptions = setOptions.mock.calls[0]?.[0];
    const trailingItems = configuredOptions.unstable_headerRightItems();
    expect(trailingItems).toEqual([
      expect.objectContaining({
        icon: { type: 'sfSymbol', name: 'person.2.fill' },
        accessibilityLabel: 'Open family diaries',
        identifier: 'family-diaries',
      }),
      expect.objectContaining({
        icon: { type: 'sfSymbol', name: 'person.crop.circle' },
        accessibilityLabel: 'Profile',
        identifier: 'tab-header-profile',
      }),
    ]);

    trailingItems[0]?.onPress();
    trailingItems[1]?.onPress();
    expect(onFamilyPress).toHaveBeenCalledTimes(1);
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  it('clears previously configured trailing actions when they disappear', () => {
    let configuredOptions: Record<string, unknown> = {};
    const setOptions = jest.fn((nextOptions: Record<string, unknown>) => {
      configuredOptions = { ...configuredOptions, ...nextOptions };
    });

    setNativeHeaderDatePickerOptions(
      { setOptions },
      {
        ...options,
        trailingActions: [createNativeProfileAction(jest.fn(), 'Profile')],
      }
    );
    expect(configuredOptions.unstable_headerRightItems).toEqual(
      expect.any(Function)
    );

    setNativeHeaderDatePickerOptions({ setOptions }, options);

    expect(configuredOptions.unstable_headerRightItems).toBeUndefined();
  });
});
