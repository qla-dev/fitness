import React from 'react';
import Svg, { Line, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * The torso pinching in at the waist, with the tape and its buckle across the
 * narrowest point.
 */
const WaistIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M164,90 C164,170 116,196 116,256 C116,316 164,342 164,422"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M348,90 C348,170 396,196 396,256 C396,316 348,342 348,422"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="96"
      y1="256"
      x2="416"
      y2="256"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Rect
      x="232"
      y="236"
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

export default WaistIcon;
