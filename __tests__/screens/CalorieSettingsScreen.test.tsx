import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import i18n, { initializeI18n } from '../../src/localization/i18n';
import CalorieSettingsScreen from '../../src/screens/CalorieSettingsScreen';

const mockMutate = jest.fn();
let mockPreferences: Record<string, unknown> = {};

jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: mockPreferences }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    cancelQueries: jest.fn(),
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  }),
  useMutation: () => ({ mutate: mockMutate }),
}));

jest.mock('../../src/components/BottomSheetPicker', () => {
  const ReactModule = require('react');
  const { Pressable: MockPressable, Text: MockText } = require('react-native');
  return {
    __esModule: true,
    // Renders the screen's own trigger (the settings row) and, as radios, the
    // options the sheet would list, so tests can both read the row and pick.
    default: ({
      value,
      options,
      onSelect,
      title,
      renderTrigger,
    }: {
      value: string;
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
      title?: string;
      renderTrigger?: (props: {
        onPress: () => void;
        selectedOption: { label: string; value: string } | undefined;
      }) => unknown;
    }) =>
      ReactModule.createElement(
        ReactModule.Fragment,
        null,
        renderTrigger?.({
          onPress: () => mockOpenPicker(title),
          selectedOption: options.find((option) => option.value === value),
        }),
        ...options.map((option: { label: string; value: string }) =>
          ReactModule.createElement(
            MockPressable,
            {
              key: option.value,
              accessibilityRole: 'radio',
              accessibilityLabel: option.label,
              onPress: () => onSelect(option.value),
            },
            ReactModule.createElement(MockText, null, option.label)
          )
        )
      ),
  };
});

const mockOpenPicker = jest.fn();

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));

jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('uniwind', () => ({
  useCSSVariable: () => ['#22c55e'],
}));

const navigation = { goBack: jest.fn(), setOptions: jest.fn() } as never;
const route = { params: {} } as never;

describe('CalorieSettingsScreen', () => {
  beforeEach(async () => {
    await act(async () => {
      await initializeI18n('en');
      await i18n.changeLanguage('en');
    });
    jest.clearAllMocks();
    mockPreferences = {
      calorie_goal_adjustment_mode: 'adaptive',
      goal_mode: 'maintain',
      goal_mode_custom_percentage: 0,
      calorie_safety_floor_mode: 'standard',
      calorie_safety_floor_value: 1200,
    };
  });

  it('explains that Device Projection applies Goal Mode to Health Connect TDEE', () => {
    mockPreferences.calorie_goal_adjustment_mode = 'tdee';
    const { getByText } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );

    expect(
      getByText(
        'Current-day Health Connect total calories are projected to midnight; completed days use the recorded total. Goal Mode is applied to that TDEE, with BMR + active calories as a fallback.'
      )
    ).toBeTruthy();
    expect(
      getByText(
        'Health Connect total calories (BMR + active calories fallback)'
      )
    ).toBeTruthy();
    expect(getByText('Projected TDEE × Goal Mode − Eaten')).toBeTruthy();
  });

  it('offers and saves Goal Mode percentages on Android', () => {
    const { getByRole } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );

    expect(getByRole('radio', { name: 'Maintain (0%)' })).toBeTruthy();
    expect(getByRole('radio', { name: 'Body Recomposition (-10%)' })).toBeTruthy();
    expect(getByRole('radio', { name: 'Lean Bulk (+10%)' })).toBeTruthy();

    fireEvent.press(getByRole('radio', { name: 'Body Recomposition (-10%)' }));
    expect(mockMutate).toHaveBeenCalledWith({ goal_mode: 'recomp' });
  });

  it('shows each choice as a settings row with its current value that opens its sheet', () => {
    mockPreferences.goal_mode = 'lean_bulk';
    const { getByRole } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );

    const rows = [
      ['Calorie Mode', 'Adjustment Mode'],
      ['Activity Level', 'Activity Level'],
      ['Goal Mode', 'Goal Mode'],
      ['Safety Floor', 'Safety Floor'],
    ] as const;
    for (const [rowTitle, sheetTitle] of rows) {
      const row = getByRole('button', { name: rowTitle });
      expect(row.props.accessibilityHint).toBe('Opens selection menu');
      mockOpenPicker.mockClear();
      fireEvent.press(row);
      expect(mockOpenPicker).toHaveBeenCalledWith(sheetTitle);
    }

    // The current value sits under the title; the explanation stays too.
    const goalRow = getByRole('button', { name: 'Goal Mode' });
    expect(within(goalRow).getByText('Lean Bulk (+10%)')).toBeTruthy();
    expect(
      within(goalRow).getByText(
        'Adjusts your calorie target for maintenance, a deficit, or a surplus.'
      )
    ).toBeTruthy();
    const floorRow = getByRole('button', { name: 'Safety Floor' });
    expect(within(floorRow).getByText('Standard')).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('saves a bounded custom Goal Mode percentage', () => {
    mockPreferences.goal_mode = 'manual';
    mockPreferences.goal_mode_custom_percentage = -10;
    const { getByDisplayValue } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    const input = getByDisplayValue('-10');

    fireEvent.changeText(input, '45');
    fireEvent(input, 'blur');

    expect(mockMutate).toHaveBeenCalledWith({
      goal_mode_custom_percentage: 40,
    });
  });

  it('offers standard, custom, and disabled safety floor modes', () => {
    const { getByRole, getByText } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );

    expect(getByText('Safety Floor')).toBeTruthy();
    expect(getByRole('radio', { name: 'Standard' })).toBeTruthy();
    expect(getByRole('radio', { name: 'Custom' })).toBeTruthy();
    expect(getByRole('radio', { name: 'Disabled' })).toBeTruthy();
  });

  it('saves a selected safety floor mode', () => {
    const { getByRole } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByRole('radio', { name: 'Disabled' }));
    expect(mockMutate).toHaveBeenCalledWith({
      calorie_safety_floor_mode: 'disabled',
    });
  });

  it('saves a custom safety floor value', () => {
    mockPreferences.calorie_safety_floor_mode = 'custom';
    const { getByDisplayValue } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    const input = getByDisplayValue('1200');

    fireEvent.changeText(input, '1150');
    fireEvent(input, 'blur');

    expect(mockMutate).toHaveBeenCalledWith({
      calorie_safety_floor_value: 1150,
    });
  });

  it('restores the saved value without persisting when the custom input is blank', () => {
    mockPreferences.calorie_safety_floor_mode = 'custom';
    const { getByDisplayValue } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    const input = getByDisplayValue('1200');

    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');

    expect(getByDisplayValue('1200')).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it.each([
    ['799', 800],
    ['5001', 5000],
  ])('clamps custom floor %s to %s kcal', (inputValue, expectedValue) => {
    mockPreferences.calorie_safety_floor_mode = 'custom';
    const { getByDisplayValue } = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    const input = getByDisplayValue('1200');

    fireEvent.changeText(input, inputValue);
    fireEvent(input, 'blur');

    expect(mockMutate).toHaveBeenCalledWith({
      calorie_safety_floor_value: expectedValue,
    });
  });
  it('renders the shipped Polish safety floor labels, descriptions, custom minimum, and keeps raw values', async () => {
    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    const cases = [
      [
        'standard',
        'Używa wyższej z wartości: szacowane PPM lub minimum kliniczne.',
      ],
      [
        'custom',
        'Zastępuje standardowe minimum wybraną przez Ciebie wartością. Zalecenia zdrowotne pozostają widoczne.',
      ],
      [
        'disabled',
        'Wyłącza automatyczne ograniczanie celu. Ostrzeżenia zdrowotne pozostają widoczne.',
      ],
    ] as const;
    const screen = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    expect(screen.getByText('Bezpieczne minimum')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Standardowe' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Własne' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Wyłączone' })).toBeTruthy();
    for (const [mode, description] of cases) {
      mockPreferences.calorie_safety_floor_mode = mode;
      screen.rerender(
        <CalorieSettingsScreen navigation={navigation} route={route} />
      );
      expect(screen.getByText(description)).toBeTruthy();
      if (mode === 'custom') {
        expect(screen.getByText('Własne minimum (kcal)')).toBeTruthy();
      }
    }
    fireEvent.press(screen.getByRole('radio', { name: 'Standardowe' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Własne' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Wyłączone' }));
    expect(mockMutate).toHaveBeenNthCalledWith(1, {
      calorie_safety_floor_mode: 'standard',
    });
    expect(mockMutate).toHaveBeenNthCalledWith(2, {
      calorie_safety_floor_mode: 'custom',
    });
    expect(mockMutate).toHaveBeenNthCalledWith(3, {
      calorie_safety_floor_mode: 'disabled',
    });
  });

  it('updates labels on the same mounted instance when language changes', async () => {
    const screen = render(
      <CalorieSettingsScreen navigation={navigation} route={route} />
    );
    expect(screen.getByText('Safety Floor')).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    expect(screen.getByText('Bezpieczne minimum')).toBeTruthy();
    await act(async () => {
      await initializeI18n('en');
      await i18n.changeLanguage('en');
    });
    expect(screen.getByText('Safety Floor')).toBeTruthy();
  });
});
