import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Sunrise: the sun breaking a horizon, with the rays picked out in the accent.
 *
 * Drawn to the same rules as the measurement icons beside it in the tile grid —
 * a 512 box, 14-wide round-capped strokes, the large form in `color` and the
 * one detail that carries the meaning in `accentColor`, the way the scale's
 * needle and the body icon's calipers do.
 *
 * The sun, its rays and the horizon alone made a wide, shallow band: roughly
 * 386 across and 210 tall inside a square box, so the mark rendered noticeably
 * smaller than the measurement icons beside it, which fill their box. The two
 * gulls above and the tapering reflection below are there to square it up —
 * content reaching y 63 at the top and 455 at the bottom, against 63 and 449
 * across — so every icon in the row is drawn to the same scale.
 */
const WakeUpIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    {/* Two arcs apiece: down from the raised wingtip to the body, then up to
        the far tip. Both in `color`, so the rays keep the only accent. */}
    <Path
      d="M180,108 Q202,136 224,132 Q246,136 268,108"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M300,70 Q315,90 331,87 Q347,90 362,70"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Exactly a semicircle: the chord is twice the radius, so the dome sits
        flush on the horizon however the icon is scaled. */}
    <Path
      d="M166,306 A90,90 0 0 1 346,306"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="70"
      y1="306"
      x2="442"
      y2="306"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    {/* Three strokes tapering away below the horizon: the sun's reflection,
        and what gives the drawing its lower half. */}
    <Line
      x1="146"
      y1="354"
      x2="366"
      y2="354"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="186"
      y1="402"
      x2="326"
      y2="402"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="222"
      y1="448"
      x2="290"
      y2="448"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    {/* Five rays struck from the sun's centre at 22.5° steps, every one between
        the same two radii so they read as one family. */}
    <Line
      x1="256"
      y1="194"
      x2="256"
      y2="158"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="335"
      y1="227"
      x2="361"
      y2="201"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="177"
      y1="227"
      x2="151"
      y2="201"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="360"
      y1="263"
      x2="393"
      y2="249"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="152"
      y1="263"
      x2="119"
      y2="249"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default WakeUpIcon;
