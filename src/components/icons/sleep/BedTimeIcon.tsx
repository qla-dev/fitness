import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * A crescent moon with three sparks, the night half of the pair the wake tile
 * opens with.
 *
 * Same rules as the measurement icons beside it: a 512 box, 14-wide
 * round-capped strokes, the large form in `color` and the detail in
 * `accentColor`.
 *
 * The crescent is two arcs of two circles of equal radius — meeting where
 * those circles cross. The outer arc takes the long way round the right and
 * bottom; the inner one cuts back the short way, and the gap between them is
 * the moon. Equal radii are what keep the crescent's horns symmetric.
 *
 * Moon and sparks together are centred on the 512 box, not the moon alone: the
 * sparks carry real visual weight up and to the right, so centring the crescent
 * by itself would have left the mark sitting low and left of the icons it
 * shares a row with.
 */
const BedTimeIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M301.34,139.66 A160,160 0 1 1 80.66,360.34 A160,160 0 0 0 301.34,139.66 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Sparks as crossed strokes rather than drawn stars: at tile size a
        five-point star fills in, while two strokes stay two strokes. Each sits
        clear of the moon's outer arc at its own height. */}
    <Line
      x1="378"
      y1="125"
      x2="378"
      y2="169"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="356"
      y1="147"
      x2="400"
      y2="147"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="322"
      y1="77"
      x2="322"
      y2="105"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="308"
      y1="91"
      x2="336"
      y2="91"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="418"
      y1="211"
      x2="418"
      y2="239"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="404"
      y1="225"
      x2="432"
      y2="225"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default BedTimeIcon;
