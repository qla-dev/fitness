import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SetupWizardScreen from '../../src/screens/SetupWizardScreen';
import { fireSelectionHaptic } from '../../src/services/haptics';
import {
  getSetupWizardSession,
  openSetupWizardSession,
  type SetupStep,
} from '../../src/services/setupWizardSession';

jest.mock('../../src/services/haptics', () => ({
  fireSelectionHaptic: jest.fn(),
  fireSuccessHaptic: jest.fn(),
}));

// The footer reads the inset context directly rather than through the hook,
// so that it can fall back to zero inside a bottom sheet, where there is no
// provider. The mock has to carry the context for the same reason.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn() }),
}));

const steps: SetupStep[] = [
  {
    id: 'one',
    heading: 'First heading',
    hint: 'First hint',
    fields: [
      {
        id: 'a',
        label: 'Field A',
        multiple: true,
        options: [
          { value: 'lose', label: 'Lose weight', icon: 'trend-down' },
          { value: 'muscle', label: 'Build muscle' },
        ],
      },
    ],
  },
  {
    id: 'two',
    heading: 'Second heading',
    hint: 'Second hint',
    fields: [
      {
        id: 'b',
        label: 'Age',
        numeric: true,
        integer: true,
        min: 13,
        max: 120,
        unit: 'years old',
      },
    ],
  },
];

function renderWizard(wizardSteps: SetupStep[] = steps) {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  const navigation = {
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  openSetupWizardSession({
    steps: wizardSteps,
    initial: {},
    onSave,
    onClose,
  });
  render(
    <SetupWizardScreen
      navigation={navigation as never}
      route={{ key: 'SetupWizard', name: 'SetupWizard' } as never}
    />
  );
  return { onSave, onClose, navigation };
}

describe('SetupWizardScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fires a haptic when an option is picked', () => {
    renderWizard();
    fireEvent.press(screen.getByText('Lose weight'));
    expect(fireSelectionHaptic).toHaveBeenCalledTimes(1);
  });

  it('advances to the next step on Continue', async () => {
    const { onSave } = renderWizard();
    expect(screen.getByText('First heading')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    expect(fireSelectionHaptic).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({ __step: '1' }, false);
    expect(screen.getByText('Second heading')).toBeTruthy();
  });

  it('skips the current step from the header', async () => {
    const { onSave } = renderWizard();
    await act(async () => {
      fireEvent.press(screen.getByText('Skip'));
    });
    expect(fireSelectionHaptic).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({ a: '', __step: '1' }, false);
    expect(screen.getByText('Second heading')).toBeTruthy();
  });

  it('closes from the first step through the header back button', async () => {
    const { onSave, onClose, navigation } = renderWizard();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back'));
    });
    expect(onSave).toHaveBeenCalledWith({ __step: '' }, true);
    expect(onClose).toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
    expect(getSetupWizardSession()).toBeNull();
  });

  it('shows the unit and the range error inside the input', async () => {
    renderWizard();
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    expect(screen.getByText('years old')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Age'), '7');
    expect(
      screen.getByText('Enter a whole number from 13 to 120.')
    ).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('counts multiple-choice selections on Continue', () => {
    renderWizard();
    fireEvent.press(screen.getByText('Lose weight'));
    expect(screen.getByText('Continue (1)')).toBeTruthy();
    fireEvent.press(screen.getByText('Build muscle'));
    expect(screen.getByText('Continue (2)')).toBeTruthy();
    fireEvent.press(screen.getByText('Lose weight'));
    expect(screen.getByText('Continue (1)')).toBeTruthy();
  });

  it('skips a step whose only question is hidden', async () => {
    renderWizard([
      steps[0],
      {
        id: 'hidden',
        heading: 'Hidden heading',
        hint: '',
        fields: [{ id: 'h', label: 'Hidden', showWhen: () => false }],
      },
      steps[1],
    ]);
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    expect(screen.queryByText('Hidden heading')).toBeNull();
    expect(screen.getByText('Second heading')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });
});
