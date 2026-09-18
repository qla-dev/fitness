import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A stadiometer: the marked post, the sliding headpiece, and someone standing
 * against it. The headpiece is what gives the reading, so it takes the accent.
 */
const HeightIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Line
      x1="110"
      y1="80"
      x2="110"
      y2="432"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="140"
      x2="156"
      y2="140"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="200"
      x2="138"
      y2="200"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="260"
      x2="156"
      y2="260"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="320"
      x2="138"
      y2="320"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="380"
      x2="156"
      y2="380"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="110"
      y1="168"
      x2="410"
      y2="168"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="320"
      cy="214"
      r="30"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="320"
      y1="244"
      x2="320"
      y2="340"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="320"
      y1="340"
      x2="286"
      y2="432"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="320"
      y1="340"
      x2="354"
      y2="432"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="320"
      y1="272"
      x2="274"
      y2="312"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="320"
      y1="272"
      x2="366"
      y2="312"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default HeightIcon;
