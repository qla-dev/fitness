import { useState, type ReactNode } from 'react';
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
  const [width, setWidth] = useState(0);
  return (
    <View
      className="bg-surface rounded-xl mb-4 overflow-hidden"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {image ? (
        // Full width at the image's own proportions, as a height worked out
        // from the card's measured width. Not `aspectRatio`: a bundled image
        // carries its pixel size as a default style that outranks it, and on
        // a wrapper it left the text below laid out for one width and drawn
        // at another, with its last line clipped and a blank band under it.
        <Image
          source={image}
          style={{ width: '100%', height: width / coverAspectRatio(image) }}
          resizeMode="cover"
          accessible={false}
        />
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
        {/* Styled exactly like a text fact's body — size, line height and
            colour — so the two read as one voice when they sit together. */}
        <Text className="text-base leading-6 text-text-primary">{body}</Text>
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
