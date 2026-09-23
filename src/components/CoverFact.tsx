import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Icon from './Icon';
import { useCSSVariable } from 'uniwind';

const DEFAULT_COVER_ASPECT_RATIO = 1.5;

function coverAspectRatio(image: ImageSourcePropType): number {
  const asset = Image.resolveAssetSource(image);
  return asset?.width && asset?.height
    ? asset.width / asset.height
    : DEFAULT_COVER_ASPECT_RATIO;
}

/** Shared editorial card for goal facts and What's New features. */
export default function CoverFact({
  title,
  body,
  eyebrow,
  image,
  hero,
  cta,
}: {
  title: string;
  body: string;
  eyebrow?: string;
  image?: ImageSourcePropType;
  hero?: ReactNode;
  cta?: { label: string; onPress: () => void };
}) {
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <View className="bg-surface rounded-xl mb-4 overflow-hidden">
      {image ? (
        // A bundled image carries its pixel size as a default style, which
        // outranks aspectRatio on the Image itself, so the wrapper holds the
        // ratio and the cover is full width at its natural height.
        <View style={{ width: '100%', aspectRatio: coverAspectRatio(image) }}>
          <Image
            source={image}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessible={false}
          />
        </View>
      ) : (
        hero
      )}
      <View className="p-4">
        {eyebrow ? (
          <Text className="text-xs font-semibold tracking-wider text-accent-primary mb-1">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-lg font-bold text-text-primary mb-1">
          {title}
        </Text>
        <Text className="text-text-secondary text-sm leading-5">{body}</Text>
        {cta ? (
          <Pressable
            accessibilityRole="button"
            onPress={cta.onPress}
            className="flex-row items-center self-end mt-4"
            hitSlop={8}
          >
            <Text className="text-sm font-semibold text-accent-primary">
              {cta.label}
            </Text>
            <Icon
              name="chevron-forward"
              size={14}
              color={accent}
              weight="semibold"
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
