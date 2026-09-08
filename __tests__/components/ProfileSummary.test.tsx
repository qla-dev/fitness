import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProfileSummary from '../../src/components/ProfileSummary';

jest.mock('../../src/components/MyLibrarySection', () => {
  const { Text } = require('react-native');
  return () => <Text>Saved collections</Text>;
});
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('../../src/services/api/profileApi', () => ({
  fetchProfile: jest.fn().mockResolvedValue({ full_name: 'Ada Lovelace' }),
}));

jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));

jest.mock('../../src/services/themeService', () => ({
  useThemePreference: () => 'System',
  setThemePreference: jest.fn(),
}));

function renderSummary() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileSummary enabled />
    </QueryClientProvider>
  );
}

describe('ProfileSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps My Clients and the purchase row inside the identity card', async () => {
    const { getByText, findByText, UNSAFE_root } = renderSummary();
    await findByText('Ada Lovelace');

    // The three card rows must be siblings of the name row, not a separate
    // group further down: reading the card's own subtree is what proves it.
    const card = UNSAFE_root.findAll(
      (node) =>
        typeof node.props?.className === 'string' &&
        node.props.className.includes('bg-surface rounded-2xl overflow-hidden')
    )[0];
    const cardText = card
      .findAllByType(require('react-native').Text)
      .map((node: { props: { children: unknown } }) => node.props.children)
      .filter((child: unknown) => typeof child === 'string');

    expect(cardText).toEqual(
      expect.arrayContaining(['My Clients', 'Additional Notifications'])
    );
    expect(getByText('My Clients')).toBeTruthy();
  });

  it('opens the premium screen from both premium rows', async () => {
    const { getByText, findByText } = renderSummary();
    await findByText('Ada Lovelace');

    fireEvent.press(getByText('My Clients'));
    expect(mockNavigate).toHaveBeenCalledWith('ProfilePremium');

    mockNavigate.mockClear();
    fireEvent.press(getByText('Additional Notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('ProfilePremium');
  });

  it('opens the goals list and the theme list as screens, not sheets', async () => {
    const { getByText, findByText } = renderSummary();
    await findByText('Ada Lovelace');

    fireEvent.press(getByText('Goals'));
    expect(mockNavigate).toHaveBeenCalledWith('ProfileGoals');

    fireEvent.press(getByText('Theme'));
    expect(mockNavigate).toHaveBeenCalledWith('ProfileTheme');
  });
});
