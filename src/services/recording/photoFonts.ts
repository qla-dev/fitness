import { Asset } from 'expo-asset';
import { Skia, type SkTypeface } from '@shopify/react-native-skia';
import type { PhotoFont } from './photoEditor';

const assets = {
  anton: require('../../../assets/fonts/photo/anton/Anton-Regular.ttf'),
  bebas: require('../../../assets/fonts/photo/bebasneue/BebasNeue-Regular.ttf'),
  rajdhani: require('../../../assets/fonts/photo/rajdhani/Rajdhani-SemiBold.ttf'),
  oswald: require('../../../assets/fonts/photo/oswald/Oswald[wght].ttf'),
};
const cache = new Map<PhotoFont, Promise<SkTypeface>>();

/** Bundled fonts work offline; failed loads may be retried by the editor. */
export async function photoTypeface(font: PhotoFont) {
  if (font === 'system') return null;
  let pending = cache.get(font);
  if (!pending) {
    pending = (async () => {
      const asset = await Asset.fromModule(assets[font]).downloadAsync();
      const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
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
