import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Head and shoulders with a tape drawn round the neck. The tape is the accent
 * in each of the three girth icons, so they read as one family.
 */
const NeckIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Circle
      cx="256"
      cy="164"
      r="76"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M218,238 L218,304"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M294,238 L294,304"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M120,424 C120,344 176,306 218,304 L294,304 C336,306 392,344 392,424"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Ellipse
      cx="256"
      cy="296"
      rx="56"
      ry="16"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default NeckIcon;
