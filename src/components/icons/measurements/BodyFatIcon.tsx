import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A torso with calipers closing on it from both sides — body fat is the one
 * measurement taken by pinching rather than reading off a dial.
 */
const BodyFatIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M256,96 C170,96 140,170 140,250 C140,350 190,416 256,416 C322,416 372,350 372,250 C372,170 342,96 256,96 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M76,256 L116,256"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M100,236 L120,256 L100,276"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M436,256 L396,256"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M412,236 L392,256 L412,276"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export default BodyFatIcon;
