import {
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
} from '@shopify/react-native-skia';
import { APP_NAME_STEM, APP_NAME_SUFFIX } from '../../components/AppWordmark';
import { BRAND_ACCENT } from '../../components/AppLogo';
import { bundledAssetUri } from './photoFonts';

async function loadBranding() {
  const fontData = await Skia.Data.fromURI(
    bundledAssetUri(require('../../../assets/brand/FacebookSansBold.ttf'))
  );
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(fontData);
  if (!typeface) throw new Error('Photo branding could not be decoded');
  return { typeface };
}

/**
 * The app mark (assets/icons/logo-v4.png, see AppLogo) drawn as vectors, in
 * its own colours: the blue eaten arch over the white burned arch, each
 * closed into a faint full ring, with MarkAI's sparkles at the centre. Drawn
 * rather than stamped from the PNG because the PNG carries the black square
 * it is set on, and a watermark has to sit on the photo itself.
 *
 * Measured off the 1024px artwork, whose rings span 806px, so `size` is the
 * outer ring's diameter.
 */
function drawBrandMark(canvas: SkCanvas, x: number, y: number, size: number) {
  const scale = size / 806;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const ring = (radius: number, width: number, color: string, alpha = 1) => {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(width * scale);
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(alpha);
    paint.setStrokeCap(StrokeCap.Butt);
    canvas.drawCircle(cx, cy, radius * scale, paint);
  };
  const arch = (radius: number, width: number, color: string) => {
    const r = radius * scale;
    const path = Skia.PathBuilder.Make()
      .addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), 180, 180)
      .detach();
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(width * scale);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(1);
    canvas.drawPath(path, paint);
    path.dispose();
  };
  // A four-point sparkle with concave sides, centred on (sx, sy) in artwork
  // pixels from the mark's centre.
  const sparkle = (sx: number, sy: number, rx: number, ry: number) => {
    const px = cx + sx * scale;
    const py = cy + sy * scale;
    const w = rx * scale;
    const h = ry * scale;
    const k = 0.12;
    const path = Skia.PathBuilder.Make()
      .moveTo(px, py - h)
      .quadTo(px + w * k, py - h * k, px + w, py)
      .quadTo(px + w * k, py + h * k, px, py + h)
      .quadTo(px - w * k, py + h * k, px - w, py)
      .quadTo(px - w * k, py - h * k, px, py - h)
      .close()
      .detach();
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(BRAND_ACCENT));
    paint.setAlphaf(1);
    canvas.drawPath(path, paint);
    path.dispose();
  };
  try {
    ring(349, 108, BRAND_ACCENT, 0.2);
    ring(207, 106, '#FFFFFF', 0.23);
    arch(349, 108, BRAND_ACCENT);
    arch(207, 106, '#FFFFFF');
    sparkle(-12, 0, 85, 95);
    sparkle(65, -57, 34, 40);
  } finally {
    paint.dispose();
  }
}

let branding: ReturnType<typeof loadBranding> | undefined;

/** Share exports use the same brand face as AppWordmark, in the selected ink. */
export async function drawPhotoBranding(
  canvas: SkCanvas,
  width: number,
  height: number,
  color: string,
  placement?: {
    centerX: number;
    top: number;
    fontSize: number;
    inset?: number;
    align?: 'left' | 'center' | 'right';
  }
) {
  branding ??= loadBranding().catch((error) => {
    branding = undefined;
    throw error;
  });
  const { typeface } = await branding;
  const size = placement?.fontSize ?? width * 0.05;
  const font = Skia.Font(typeface, size);
  const paint = Skia.Paint();
  try {
    // The mark spans the name's full height: its top on the top of the "l"
    // and "f" ascenders, its bottom on the foot of the "q" descender, as in
    // the brand lockup. Both are measured glyph bounds, relative to the
    // baseline (negative is above it).
    const ascender = font.measureText('lf');
    const descender = font.measureText('q');
    const top = ascender.y;
    const bottom = descender.y + descender.height;
    const iconSize = bottom - top;
    const stemWidth = font.measureText(APP_NAME_STEM).width;
    const textWidth = font.measureText(APP_NAME_STEM + APP_NAME_SUFFIX).width;
    // The lockup in the store art spaces the mark from the "q" by ~14% of
    // the mark's own height.
    const gap = iconSize * 0.14;
    const totalWidth = iconSize + gap + textWidth;
    const inset = placement?.inset ?? 0;
    const x =
      placement?.align === 'left'
        ? inset
        : placement?.align === 'right'
          ? width - inset - totalWidth
          : (placement?.centerX ?? width / 2) - totalWidth / 2;
    const y = placement?.top ?? height * 0.965 - iconSize;
    drawBrandMark(canvas, x, y, iconSize);
    const textX = x + iconSize + gap;
    const baseline = y - top;
    // "qla" in the photo's ink, ".fit" always in the brand blue — the
    // wordmark's own two colours (AppWordmark).
    paint.setColor(Skia.Color(color));
    canvas.drawText(APP_NAME_STEM, textX, baseline, paint, font);
    paint.setColor(Skia.Color(BRAND_ACCENT));
    canvas.drawText(APP_NAME_SUFFIX, textX + stemWidth, baseline, paint, font);
  } finally {
    paint.dispose();
    font.dispose();
  }
}
