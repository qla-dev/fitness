import React from 'react';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  accentColor?: string;
  /** How full to draw it, 0–1. Omitted draws the bottle empty. */
  fill?: number;
}

/** The bottle's inner cavity, in the 512 box. The water is clipped to it. */
const WATER_TOP = 168;
const WATER_BOTTOM = 448;

/**
 * A drinking bottle, filled to the share of the day's goal that has been
 * drunk.
 *
 * Same rules as the measurement icons beside it — a 512 box, 14-wide
 * round-capped strokes, the vessel in `color` and what is in it in
 * `accentColor` — but this one is the only icon in the set that reports a
 * value rather than naming a thing, so the water is a filled shape rather than
 * an outline.
 *
 * The level is clipped to the bottle's own outline rather than drawn as a
 * rectangle behind it, so the water takes the shoulders' curve at the top of
 * the range instead of spilling square over them.
 */
const WaterBottleIcon: React.FC<Props> = ({
  size = 24,
  color = '#464b53',
  accentColor = '#518df1',
  fill = 0,
}) => {
  const level = Math.min(1, Math.max(0, fill));
  const waterTop = WATER_BOTTOM - (WATER_BOTTOM - WATER_TOP) * level;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <ClipPath id="bottle-cavity">
          <Path d="M196,168 C196,140 206,124 206,104 L306,104 C306,124 316,140 316,168 C330,196 336,232 336,286 L336,410 C336,436 318,452 292,452 L220,452 C194,452 176,436 176,410 L176,286 C176,232 182,196 196,168 Z" />
        </ClipPath>
      </Defs>

      {/* Water first, so the outline draws over its edge. */}
      {level > 0 ? (
        <Rect
          x="160"
          y={waterTop}
          width="192"
          height={WATER_BOTTOM - waterTop}
          fill={accentColor}
          clipPath="url(#bottle-cavity)"
        />
      ) : null}

      {/* Cap, then neck, then the body — three strokes so the cap reads as a
          separate piece rather than a bump on the shoulders. */}
      <Path
        d="M214,58 L298,58 C306,58 312,64 312,72 L312,96 C312,102 306,108 298,108 L214,108 C206,108 200,102 200,96 L200,72 C200,64 206,58 214,58 Z"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M196,168 C196,140 206,124 206,108 M316,168 C316,140 306,124 306,108"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M196,168 C182,196 176,232 176,286 L176,410 C176,436 194,452 220,452 L292,452 C318,452 336,436 336,410 L336,286 C336,232 330,196 316,168 Z"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
};

export default WaterBottleIcon;
