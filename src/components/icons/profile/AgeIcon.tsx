import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * An hourglass, for the age shown on the profile card.
 *
 * Not the calendar this row used to borrow from the shared icon set: a
 * calendar means a date, and a date is what the profile stores, but age is the
 * time that has run since. The sand carries the accent.
 */
const AgeIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Line
      x1="120"
      y1="96"
      x2="392"
      y2="96"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="120"
      y1="416"
      x2="392"
      y2="416"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M168,96 C168,180 256,214 256,256 C256,298 168,332 168,416"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M344,96 C344,180 256,214 256,256 C256,298 344,332 344,416"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="198"
      y1="148"
      x2="314"
      y2="148"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="256"
      y1="262"
      x2="256"
      y2="330"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M204,392 C222,348 290,348 308,392"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export default AgeIcon;
