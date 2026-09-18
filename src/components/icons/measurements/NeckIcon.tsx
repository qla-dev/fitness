import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Head and shoulders with the tape round the neck itself.
 *
 * The neck is drawn long enough to carry the tape: at first it was a stub, so
 * the tape landed on the collarbone and read as a fringe lying on the
 * shoulders rather than a band wrapping anything.
 */
const NeckIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M256,58 C320,58 366,104 366,172 C366,200 360,224 350,244 C338,290 300,330 256,330 C212,330 174,290 162,244 C152,224 146,200 146,172 C146,104 192,58 256,58 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M150,176 C126,168 118,196 130,214 C138,226 150,226 156,220"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M362,176 C386,168 394,196 382,214 C374,226 362,226 356,220"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="214"
      y1="322"
      x2="214"
      y2="392"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="298"
      y1="322"
      x2="298"
      y2="392"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M96,466 C104,414 152,396 214,392 L298,392 C360,396 408,414 416,466"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M196,338 C214,358 298,358 316,338"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Line
      x1="212"
      y1="350"
      x2="210"
      y2="372"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="240"
      y1="356"
      x2="240"
      y2="380"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="272"
      y1="356"
      x2="272"
      y2="380"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Line
      x1="300"
      y1="350"
      x2="302"
      y2="372"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default NeckIcon;
