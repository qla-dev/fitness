import React from 'react';
import { render } from '@testing-library/react-native';

import SettingsRow from '../../src/components/SettingsRow';

const SUBTITLE =
  'Repeat each reminder every 10 minutes, up to 3 times, until the dose is logged.';

describe('SettingsRow', () => {
  it('keeps menu subtitles on one truncated line by default', () => {
    const { getByText } = render(
      <SettingsRow title="Repeat Reminders" subtitle={SUBTITLE} />
    );

    // A menu row must keep its height stable across labels of any length, so
    // an over-long subtitle is cut with a trailing ellipsis rather than
    // pushing the row to a second line.
    expect(getByText(SUBTITLE).props.numberOfLines).toBe(1);
    expect(getByText(SUBTITLE).props.ellipsizeMode).toBe('tail');
  });

  it('lets string subtitles wrap when subtitleNumberOfLines is 0', () => {
    const { getByText } = render(
      <SettingsRow
        title="Repeat Reminders"
        subtitle={SUBTITLE}
        subtitleNumberOfLines={0}
      />
    );

    expect(getByText(SUBTITLE).props.numberOfLines).toBe(0);
  });
});
