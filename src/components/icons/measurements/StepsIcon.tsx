import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
}

/**
 * Two footprints, a stride apart.
 *
 * Sits low in its box on purpose: the toes reach much further up than the
 * heels reach down, so centring the shapes by eye left the pair riding high
 * against the icons beside it. The whole drawing is offset to put the inked
 * area on the box's centre, not the geometry.
 *
 * Pulled well clear of one another: overlapping soles read as one shape, and
 * the two arcs of toes ran together into a single string of beads. A real sole
 * is broad at the ball, pinched at the arch and round again at the heel — the
 * pinch is what stops it reading as a capsule.
 */
const StepsIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
}) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path
      d="M158,198 C196,198 220,226 220,264 C220,296 206,318 198,340 C190,362 196,382 196,404 C196,440 174,464 144,464 C116,464 98,442 100,408 C102,380 114,362 120,340 C128,314 126,280 130,250 C134,218 136,198 158,198 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle
      cx="112"
      cy="166"
      r="13"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="148"
      cy="152"
      r="11"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="180"
      cy="156"
      r="10"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="208"
      cy="172"
      r="9"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Path
      d="M354,104 C316,104 292,132 292,170 C292,202 306,224 314,246 C322,268 316,288 316,310 C316,346 338,370 368,370 C396,370 414,348 412,314 C410,286 398,268 392,246 C384,220 386,186 382,156 C378,124 376,104 354,104 Z"
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle
      cx="400"
      cy="72"
      r="13"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="364"
      cy="58"
      r="11"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="332"
      cy="62"
      r="10"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
    <Circle
      cx="304"
      cy="78"
      r="9"
      stroke={accentColor}
      strokeWidth={14}
      strokeLinecap="round"
      strokeMiterlimit={10}
      fill="none"
    />
  </Svg>
);

export default StepsIcon;
