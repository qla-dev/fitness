import React from 'react';
import { Switch as RNSwitch, type SwitchProps } from 'react-native';
import { useCSSVariable } from 'uniwind';

const THUMB_COLOR = '#FFFFFF';

/**
 * The app's one switch: primary accent when on, the neutral form track when
 * off. Use it instead of React Native's Switch so every toggle matches.
 */
const Switch: React.FC<SwitchProps> = ({
  trackColor,
  thumbColor,
  ios_backgroundColor,
  ...rest
}) => {
  const [accentPrimary, formDisabled] = useCSSVariable([
    '--color-accent-primary',
    '--color-form-disabled',
  ]) as [string, string];

  return (
    <RNSwitch
      trackColor={trackColor ?? { false: formDisabled, true: accentPrimary }}
      thumbColor={thumbColor ?? THUMB_COLOR}
      // iOS paints the off track from this, not trackColor.false.
      ios_backgroundColor={ios_backgroundColor ?? formDisabled}
      {...rest}
    />
  );
};

export default Switch;
