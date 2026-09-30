import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SetupWizardScreen from '../../src/screens/SetupWizardScreen';
import { fireSelectionHaptic } from '../../src/services/haptics';
import {
  getSetupWizardSession,
  isSetupComplete,
  openSetupWizardSession,
  type SetupStep,
  offerSetupAnswer,
  type SetupWizardSession,
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

function renderWizard(
  wizardSteps: SetupStep[] = steps,
  extra: Partial<SetupWizardSession> = {}
) {
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
    ...extra,
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
    expect(onSave).toHaveBeenCalledWith(
      { a: '', __skipped: ['a'], __step: '1' },
      false
    );
    expect(screen.getByText('Second heading')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Skip'));
    });
    const saved = onSave.mock.calls[1][0];
    expect(saved.__skipped).toEqual(['a', 'b']);
    expect(isSetupComplete(steps, saved)).toBe(true);
  });

  it('closes from the first step through the header back button', async () => {
    const { onSave, onClose, navigation } = renderWizard();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back'));
    });
    expect(onSave).toHaveBeenCalledWith({ __step: '' }, true);
    expect(isSetupComplete(steps, onSave.mock.calls[0][0])).toBe(false);
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

  describe('first round', () => {
    const round: SetupStep[] = [
      { ...steps[0], required: true },
      { ...steps[1], required: true },
      {
        id: 'three',
        heading: 'Third heading',
        hint: '',
        fields: [{ id: 'c', label: 'Notes' }],
      },
    ];
    const firstRound = {
      label: 'Calculate my BMI',
      flash: jest.fn(() => ({
        eyebrow: 'Your BMI',
        value: '22.9',
        title: 'Healthy weight',
      })),
    };

    it('asks it without Skip, then flashes the result and goes on', async () => {
      const { onSave } = renderWizard(round, { firstRound });
      expect(screen.queryByText('Skip')).toBeNull();
      // Continue waits for an answer.
      await act(async () => {
        fireEvent.press(screen.getByText('Continue'));
      });
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText('Lose weight'));
      await act(async () => {
        fireEvent.press(screen.getByText('Continue (1)'));
      });
      expect(screen.getByText('Second heading')).toBeTruthy();
      expect(screen.queryByText('Skip')).toBeNull();

      fireEvent.changeText(screen.getByLabelText('Age'), '30');
      await act(async () => {
        fireEvent.press(screen.getByText('Calculate my BMI'));
      });
      expect(firstRound.flash).toHaveBeenCalledWith(
        expect.objectContaining({ a: ['lose'], b: '30' })
      );
      expect(screen.getByText('22.9')).toBeTruthy();
      expect(screen.getByText('Healthy weight')).toBeTruthy();
      // Everything after the first round can be skipped.
      expect(screen.getByText('Third heading')).toBeTruthy();
      expect(screen.getByText('Skip')).toBeTruthy();
    });

    it('is a normal tour when it was answered before', () => {
      openSetupWizardSession({
        steps: round,
        initial: { a: ['lose'], b: '30' },
        onSave: jest.fn(),
        onClose: jest.fn(),
        firstRound,
      });
      render(
        <SetupWizardScreen
          navigation={
            {
              goBack: jest.fn(),
              setOptions: jest.fn(),
              addListener: jest.fn(() => jest.fn()),
            } as never
          }
          route={{ key: 'SetupWizard', name: 'SetupWizard' } as never}
        />
      );
      expect(screen.getByText('Skip')).toBeTruthy();
    });
  });

  describe('MarkAI assists', () => {
    const goalSteps: SetupStep[] = [
      steps[1],
      {
        id: 'calories',
        heading: 'Calories heading',
        hint: '',
        fields: [
          {
            id: 'calories',
            label: 'Daily calorie goal',
            numeric: true,
            unit: 'kcal',
            assists: [
              { label: 'Calculate with MarkAI', prompt: (f) => f.join('|') },
              {
                label: 'Calculate all macros · 10 coins',
                prompt: (f) => 'ALL ' + f.join('|'),
                task: 'all_macros',
              },
            ],
          },
        ],
      },
    ];

    it('asks MarkAI from the answers, and takes back what it worked out', async () => {
      let focus = () => {};
      const navigation = {
        goBack: jest.fn(),
        setOptions: jest.fn(),
        push: jest.fn(),
        addListener: jest.fn((event: string, listener: () => void) => {
          if (event === 'focus') focus = listener;
          return jest.fn();
        }),
      };
      openSetupWizardSession({
        steps: goalSteps,
        initial: { b: '30', calories: '1800', __step: '1' },
        onSave: jest.fn().mockResolvedValue(undefined),
        onClose: jest.fn(),
      });
      render(
        <SetupWizardScreen
          navigation={navigation as never}
          route={{ key: 'SetupWizard', name: 'SetupWizard' } as never}
        />
      );

      fireEvent.press(screen.getByText('Calculate with MarkAI'));
      // One goal leaves its own question out of the facts…
      expect(navigation.push).toHaveBeenLastCalledWith('MarkAI', {
        preset: {
          prompt: 'Age: 30 years old',
          mode: 'free',
          returnToSetup: true,
          task: undefined,
        },
      });
      fireEvent.press(screen.getByText('Calculate all macros · 10 coins'));
      // …the macro plan works from every answer, the calorie goal included.
      expect(navigation.push).toHaveBeenLastCalledWith('MarkAI', {
        preset: {
          prompt: 'ALL Age: 30 years old|Daily calorie goal: 1800 kcal',
          mode: 'free',
          returnToSetup: true,
          task: 'all_macros',
        },
      });

      offerSetupAnswer('calories', '2200');
      offerSetupAnswer('protein', '150');
      act(() => focus());
      expect(screen.getByDisplayValue('2200')).toBeTruthy();
    });
  });
});
