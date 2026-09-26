import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProgramPurchaseScreen from '../../src/screens/ProgramPurchaseScreen';
import { installProgramAsPresets } from '../../src/services/programToPresets';

jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../../src/services/programToPresets', () => ({
  installProgramAsPresets: jest.fn(),
}));
jest.mock('../../src/hooks/useExternalProviders', () => ({
  useExternalProviders: () => ({ providers: [] }),
}));
jest.mock('../../src/hooks/useInstalledPrograms', () => ({
  installedProgramsQueryKey: ['installedPrograms'],
  useInstalledPrograms: () => new Set(),
}));
jest.mock('../../src/components/ProgramCover', () => () => null);
jest.mock('../../src/components/ProgramStore', () => ({
  useProgramAccents: () => ({}),
}));
jest.mock('../../src/components/ui/PromptScreen', () => {
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return ({
    children,
    footerLabel,
    onFooterPress,
    footerDisabled,
  }: {
    children: React.ReactNode;
    footerLabel: React.ReactNode;
    onFooterPress: () => void;
    footerDisabled: boolean;
  }) => (
    <View>
      {children}
      <Pressable
        testID="confirm"
        disabled={footerDisabled}
        onPress={onFooterPress}
      >
        {typeof footerLabel === 'string' ? (
          <Text>{footerLabel}</Text>
        ) : (
          footerLabel
        )}
      </Pressable>
    </View>
  );
});

const mockInstall = installProgramAsPresets as jest.Mock;
const navigation = { replace: jest.fn(), goBack: jest.fn() };
function screen() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProgramPurchaseScreen
        navigation={navigation as never}
        route={{
          key: 'purchase',
          name: 'ProgramPurchase',
          params: { programId: 'glutes-for-days' },
        }}
      />
    </QueryClientProvider>
  );
}
beforeEach(() => jest.clearAllMocks());

it('shows success only after installation and opens the exact installed program', async () => {
  const preset = { id: 91, name: 'Glutes' };
  mockInstall.mockResolvedValue({
    preset,
    presetsCreated: 1,
    exercisesAdded: 24,
    skipped: [],
  });
  const view = screen();
  expect(view.queryByText('Program added')).toBeNull();
  expect(view.queryByText('Cancel')).toBeNull();
  fireEvent.press(view.getByTestId('confirm'));
  await waitFor(() => expect(view.getByText('Program added')).toBeTruthy());
  fireEvent.press(view.getByTestId('confirm'));
  expect(navigation.replace).toHaveBeenCalledWith('WorkoutPresetDetail', {
    preset,
  });
});

it('offers a separate action to open My Programs', async () => {
  mockInstall.mockResolvedValue({
    preset: { id: 91 },
    presetsCreated: 1,
    exercisesAdded: 24,
    skipped: [],
  });
  const view = screen();
  fireEvent.press(view.getByTestId('confirm'));
  await waitFor(() => expect(view.getByText('My Programs')).toBeTruthy());
  fireEvent.press(view.getByText('My Programs'));
  expect(navigation.replace).toHaveBeenCalledWith('WorkoutPresetsLibrary');
});

it('keeps confirmation open with an error when no exercises could be installed', async () => {
  mockInstall.mockResolvedValue({
    presetsCreated: 0,
    exercisesAdded: 0,
    skipped: ['Missing'],
  });
  const view = screen();
  fireEvent.press(view.getByTestId('confirm'));
  await waitFor(() =>
    expect(
      view.getByText('Could not add this program. Please try again.')
    ).toBeTruthy()
  );
  expect(view.queryByText('Program added')).toBeNull();
  expect(navigation.replace).not.toHaveBeenCalled();
});
