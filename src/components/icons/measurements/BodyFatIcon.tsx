import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A body with a per-cent mark on it.
 *
 * Calipers were tried first and read as a teabag: the instrument is too
 * specialised to recognise at this size. What body fat actually is — a share
 * of the body — draws in one glance.
 */
const BodyFatIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Circle
      cx="256"
      cy="104"
      r="44"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M150,430 C150,338 136,290 136,238 C136,192 180,162 226,160 L286,160 C332,162 376,192 376,238 C376,290 362,338 362,430"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle
      cx="212"
      cy="252"
      r="26"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="300"
      cy="340"
      r="26"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="196"
      y1="356"
      x2="316"
      y2="236"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default BodyFatIcon;
