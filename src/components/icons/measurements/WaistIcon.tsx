import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A woman's torso with the tape round the narrowest point.
 *
 * Shares its silhouette with the hips icon and differs only in where the tape
 * sits — which is the whole difference between the two measurements.
 */
const WaistIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M164,74 C164,132 124,156 124,194 C124,230 170,244 170,276 C170,312 122,330 118,382 C116,414 128,432 138,446"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M348,74 C348,132 388,156 388,194 C388,230 342,244 342,276 C342,312 390,330 394,382 C396,414 384,432 374,446"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M158,268 C196,296 316,296 354,268"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="176"
      y1="284"
      x2="170"
      y2="310"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="212"
      y1="294"
      x2="208"
      y2="322"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="256"
      y1="298"
      x2="256"
      y2="326"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="300"
      y1="294"
      x2="304"
      y2="322"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="336"
      y1="284"
      x2="342"
      y2="310"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default WaistIcon;
