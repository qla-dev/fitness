import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import SafeImage from './SafeImage';
import { fetchProductImageByBarcode } from '../services/local/providerCatalog';

const NO_HEADERS = {};

/**
 * A product's photo, found by its barcode through the same Open Food Facts
 * lookup a scan uses; the food glyph while it loads or when there is none.
 * Photos do not change, so one lookup per barcode lasts the session.
 */
export default function ProductThumb({
  ean,
  size = 36,
}: {
  ean?: string | null;
  size?: number;
}) {
  const muted = useCSSVariable('--color-text-muted') as string;
  const { data: uri } = useQuery({
    queryKey: ['productImage', ean],
    queryFn: () => fetchProductImageByBarcode(ean as string),
    enabled: !!ean,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const fallback = (
    <View className="flex-1 items-center justify-center">
      <Icon name="food" size={size * 0.5} color={muted} />
    </View>
  );
  return (
    <View
      className="bg-raised overflow-hidden"
      style={{ width: size, height: size, borderRadius: size / 4 }}
    >
      {uri ? (
        <SafeImage
          source={{ uri, headers: NO_HEADERS }}
          style={{ width: size, height: size }}
          contentFit="cover"
          fallback={fallback}
        />
      ) : (
        fallback
      )}
    </View>
  );
}
