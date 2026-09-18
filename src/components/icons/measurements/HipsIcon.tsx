import React from 'react';
import Svg, { Line, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * The same tape as the neck and waist icons, drawn lower and round a shape
 * that flares instead of pinching — the three differ only where they measure.
 */
const HipsIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M186,88 C186,150 150,180 132,244 C112,314 140,378 186,414"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M326,88 C326,150 362,180 380,244 C400,314 372,378 326,414"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="100"
      y1="320"
      x2="412"
      y2="320"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Rect
      x="232"
      y="300"
      width="48"
      height="40"
      rx="10"
      ry="10"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default HipsIcon;
