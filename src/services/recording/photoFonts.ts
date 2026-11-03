import { Image } from 'react-native';
import { Skia, type SkTypeface } from '@shopify/react-native-skia';
import type { PhotoFont } from './photoEditor';

const assets = {
  anton: require('../../../assets/fonts/photo/anton/Anton-Regular.ttf'),
  bebas: require('../../../assets/fonts/photo/bebasneue/BebasNeue-Regular.ttf'),
  rajdhani: require('../../../assets/fonts/photo/rajdhani/Rajdhani-SemiBold.ttf'),
  oswald: require('../../../assets/fonts/photo/oswald/Oswald[wght].ttf'),
};
const cache = new Map<PhotoFont, Promise<SkTypeface>>();

/**
 * Where a bundled file can be read from: Metro's URL in development, the
 * app bundle in a release build. Resolved by React Native itself, the way
 * Skia's own loaders and every <Image> do, rather than through expo-asset,
 * whose registry lookup came back undefined and failed every photo save.
 */
export function bundledAssetUri(module: number) {
  const uri = Image.resolveAssetSource(module)?.uri;
  if (!uri) throw new Error(`Bundled asset ${module} could not be resolved`);
  return uri;
}

/** Bundled fonts work offline; failed loads may be retried by the editor. */
export async function photoTypeface(font: PhotoFont) {
  if (font === 'system') return null;
  let pending = cache.get(font);
  if (!pending) {
    pending = (async () => {
      const data = await Skia.Data.fromURI(bundledAssetUri(assets[font]));
      try {
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) throw new Error(`Could not decode photo font: ${font}`);
        return typeface;
      } finally {
        data.dispose();
      }
    })().catch((error) => {
      cache.delete(font);
      throw error;
    });
    cache.set(font, pending);
  }
  return pending;
}
