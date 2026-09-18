import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A bone: a shaft between two pairs of knobs. Built from circles and one line
 * so the two ends stay identical however the icon is scaled.
 */
const BoneIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Circle
      cx="152"
      cy="324"
      r="40"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="188"
      cy="360"
      r="40"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="360"
      cy="188"
      r="40"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="324"
      cy="152"
      r="40"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="196"
      y1="316"
      x2="316"
      y2="196"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="224"
      y1="288"
      x2="288"
      y2="224"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default BoneIcon;
