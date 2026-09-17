import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabHeader from '../../src/components/TabHeader';
import i18n, { initializeI18n } from '../../src/localization/i18n';

function renderHeader(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
}

describe('TabHeader', () => {
  beforeAll(async () => {
    await initializeI18n('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test('shows the day on the left and opens the picker, with no day chevrons', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 0, 15, 12));
    const onDatePress = jest.fn();
    const { getByRole, queryByRole, getByText } = renderHeader(
      <TabHeader
        title="Dashboard"
        selectedDate="2025-01-15"
        onDatePress={onDatePress}
      />
    );

    expect(getByText('Today')).toBeTruthy();
    // Days move by the picker or a content swipe, so the bar carries no
    // previous/next buttons to crowd the centered title.
    expect(queryByRole('button', { name: 'Previous day' })).toBeNull();
    expect(queryByRole('button', { name: 'Next day' })).toBeNull();

    fireEvent.press(getByRole('button', { name: 'Choose date' }));
    expect(onDatePress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('always offers the profile button in the top-right corner', () => {
    const onProfilePress = jest.fn();
    const { getByRole } = renderHeader(
      <TabHeader title="Library" onProfilePress={onProfilePress} />
    );

    const profile = getByRole('button', { name: 'Profile' });
    expect(profile.props.style).toEqual(
      expect.objectContaining({ width: 44, height: 44 })
    );

    fireEvent.press(profile);
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  test('renders an extra action beside the profile button', () => {
    const onPress = jest.fn();
    const { getByRole } = renderHeader(
      <TabHeader
        title="Diary"
        onProfilePress={jest.fn()}
        action={{
          icon: 'people',
          accessibilityLabel: 'Open family diaries',
          onPress,
        }}
      />
    );

    fireEvent.press(getByRole('button', { name: 'Open family diaries' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: 'Profile' })).toBeTruthy();
  });

  test('offers the cart button, spaced apart, left of profile', () => {
    const onCartPress = jest.fn();
    const onProfilePress = jest.fn();
    const { getByRole } = renderHeader(
      <TabHeader
        title="Activities"
        onCartPress={onCartPress}
        onProfilePress={onProfilePress}
      />
    );

    const cart = getByRole('button', { name: 'Grocery List' });
    // Its own 44pt tap target, not a slice of a joined block.
    expect(cart.props.style).toEqual(
      expect.objectContaining({ width: 44, height: 44 })
    );

    fireEvent.press(cart);
    expect(onCartPress).toHaveBeenCalledTimes(1);
    expect(onProfilePress).not.toHaveBeenCalled();

    fireEvent.press(getByRole('button', { name: 'Profile' }));
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  test('omits the cart button where the header is not a tab root', () => {
    const { queryByRole } = renderHeader(
      <TabHeader title="Family diary" selectedDate="2025-01-15" />
    );

    expect(queryByRole('button', { name: 'Grocery List' })).toBeNull();
  });

  test('drops the profile button where the header is not a tab root', () => {
    const { queryByRole } = renderHeader(
      <TabHeader title="Family diary" selectedDate="2025-01-15" />
    );

    expect(queryByRole('button', { name: 'Profile' })).toBeNull();
  });
});
