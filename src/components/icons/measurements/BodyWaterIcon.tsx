import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/** A droplet with the water line inside it, drawn as a wave. */
const BodyWaterIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M256,76 C256,76 122,216 122,300 C122,368 182,420 256,420 C330,420 390,368 390,300 C390,216 256,76 256,76 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M142,322 C172,302 202,342 232,322 C262,302 292,342 322,322 C338,312 354,316 366,326"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export default BodyWaterIcon;
