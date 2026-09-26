import { Asset } from 'expo-asset';
import { BlendMode, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { APP_NAME_STEM, APP_NAME_SUFFIX } from '../../components/AppWordmark';

async function loadBranding() {
  const [logoAsset, fontAsset] = await Promise.all([
    Asset.fromModule(
      require('../../../assets/brand/logo-white.png')
    ).downloadAsync(),
    Asset.fromModule(
      require('../../../assets/brand/FacebookSansBold.ttf')
    ).downloadAsync(),
  ]);
  const [logoData, fontData] = await Promise.all([
    Skia.Data.fromURI(logoAsset.localUri ?? logoAsset.uri),
    Skia.Data.fromURI(fontAsset.localUri ?? fontAsset.uri),
  ]);
  const logo = Skia.Image.MakeImageFromEncoded(logoData);
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(fontData);
  if (!logo || !typeface) {
    logo?.dispose();
    typeface?.dispose();
    throw new Error('Photo branding could not be decoded');
  }
  return { logo, typeface };
}

let branding: ReturnType<typeof loadBranding> | undefined;

/** Share exports use the same brand face as AppWordmark, in the selected ink. */
export async function drawPhotoBranding(
  canvas: SkCanvas,
  width: number,
  height: number,
  color: string
) {
  branding ??= loadBranding().catch((error) => {
    branding = undefined;
    throw error;
  });
  const { logo, typeface } = await branding;
  const size = width * 0.05;
  const font = Skia.Font(typeface, size);
  const paint = Skia.Paint();
  const tint = Skia.ColorFilter.MakeBlend(Skia.Color(color), BlendMode.SrcIn);
  try {
    const name = APP_NAME_STEM + APP_NAME_SUFFIX;
    const textWidth = font.measureText(name).width;
    const iconSize = size * 1.4;
    const gap = size * 0.18;
    const x = (width - iconSize - gap - textWidth) / 2;
    const y = height * 0.965 - iconSize;
    paint.setColorFilter(tint);
    canvas.drawImageRect(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      Skia.XYWHRect(x, y, iconSize, iconSize),
      paint
    );
    paint.setColorFilter(null);
    paint.setColor(Skia.Color(color));
    const metrics = font.getMetrics();
    canvas.drawText(
      name,
      x + iconSize + gap,
      y + iconSize / 2 - (metrics.ascent + metrics.descent) / 2,
      paint,
      font
    );
  } finally {
    tint.dispose();
    paint.dispose();
    font.dispose();
  }
}
