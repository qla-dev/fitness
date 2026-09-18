import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A dial: basal metabolic rate is a rate, so it is shown being read off a
 * gauge rather than as the flame every calorie figure already uses — body
 * water's droplet is close enough to a flame as it is.
 */
const BmrIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M86,300 A170,170 0 0 1 426,300"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="256"
      y1="170"
      x2="256"
      y2="140"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="144"
      y1="235"
      x2="118"
      y2="220"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="368"
      y1="235"
      x2="394"
      y2="220"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="256"
      y1="300"
      x2="202"
      y2="207"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="256"
      cy="300"
      r="15"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="150"
      y1="348"
      x2="362"
      y2="348"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="186"
      y1="396"
      x2="326"
      y2="396"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default BmrIcon;
