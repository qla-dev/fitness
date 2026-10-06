import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Skia,
  Text as SkiaText,
  type SkTypeface,
} from '@shopify/react-native-skia';
import type { PhotoFont } from '../../services/recording/photoEditor';
import { photoTypeface } from '../../services/recording/photoFonts';

const SAMPLE = 'Aa';
const SAMPLE_SIZE = 30;
const SAMPLE_BOX = 70;

/**
 * Drawn with the exact typeface the export uses. Registering the files as
 * React Native fonts instead left every sample in the system face whenever
 * one of them (the variable Oswald) failed, since they loaded as one batch.
 */
function FontSample({ font }: { font: PhotoFont }) {
  const [typeface, setTypeface] = useState<SkTypeface | null>(null);
  useEffect(() => {
    let cancelled = false;
    photoTypeface(font)
      .then((loaded) => {
        if (!cancelled) setTypeface(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [font]);
  if (font === 'system' || !typeface)
    return <Text style={styles.sampleText}>{SAMPLE}</Text>;
  const skiaFont = Skia.Font(typeface, SAMPLE_SIZE);
  const width = skiaFont.measureText(SAMPLE).width;
  const metrics = skiaFont.getMetrics();
  return (
    <Canvas style={styles.sampleCanvas}>
      <SkiaText
        text={SAMPLE}
        font={skiaFont}
        color="white"
        x={(SAMPLE_BOX - width) / 2}
        y={SAMPLE_BOX / 2 - (metrics.ascent + metrics.descent) / 2}
      />
    </Canvas>
  );
}

export default function PhotoFontPreviews({
  fonts,
  selected,
  disabled,
  onSelect,
}: {
  fonts: { id: PhotoFont; title: string }[];
  selected: PhotoFont;
  disabled: boolean;
  onSelect: (font: PhotoFont) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {fonts.map(({ id, title }) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ selected: selected === id, disabled }}
          disabled={disabled}
          onPress={() => onSelect(id)}
          style={styles.item}
        >
          <View style={[styles.sample, selected === id && styles.selected]}>
            <FontSample font={id} />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.label, selected === id && styles.selectedLabel]}
          >
            {title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, gap: 12, paddingVertical: 12 },
  item: { width: 82, alignItems: 'center', gap: 6 },
  sample: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: 'white' },
  sampleText: { color: 'white', fontSize: SAMPLE_SIZE },
  sampleCanvas: { width: SAMPLE_BOX, height: SAMPLE_BOX },
  label: { color: '#BBB', fontSize: 12, textAlign: 'center' },
  selectedLabel: { color: 'white', fontWeight: '700' },
});
