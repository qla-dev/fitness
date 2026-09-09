import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import AppWordmark from '../../src/components/AppWordmark';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('uniwind', () => ({ useCSSVariable: () => '#3B82F6' }));

describe('AppWordmark', () => {
  it('renders the whole name', () => {
    const { getByText } = render(<AppWordmark />);

    expect(getByText('qla.fit')).toBeTruthy();
  });

  /**
   * The suffix carries the accent on its own, so the name reads the same
   * wherever it is printed rather than depending on each screen to colour it.
   */
  it('puts the accent on .fit only', () => {
    const { getByText } = render(<AppWordmark />);

    const suffix = getByText('.fit');
    expect(suffix.props.style).toEqual(
      expect.objectContaining({ color: '#3B82F6' })
    );
  });

  /**
   * The brand face is bold already, so the inherited weight is cleared — left
   * on, the system synthesizes a second bold over a bold face.
   */
  it('sets the brand face without doubling the weight', () => {
    const { getByText } = render(<AppWordmark />);

    const mark = getByText('qla.fit');
    expect(mark.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: 'FacebookSansBold',
          fontWeight: 'normal',
        }),
      ])
    );
  });

  it('inherits the size of the sentence it sits in', () => {
    // Nested inside a caller's Text, so surrounding copy keeps the UI face and
    // only the name switches — the whole point of it being inline.
    const { getByText } = render(
      <Text style={{ fontSize: 22 }}>
        Log data into <AppWordmark />
      </Text>
    );

    expect(getByText(/Log data into/).props.style).toEqual(
      expect.objectContaining({ fontSize: 22 })
    );
  });
});
