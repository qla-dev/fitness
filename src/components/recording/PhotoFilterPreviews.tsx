import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  ColorMatrix,
  Image,
  useImage,
} from '@shopify/react-native-skia';
import {
  photoFilterMatrices,
  type PhotoFilter,
} from '../../services/recording/photoEditor';

export default function PhotoFilterPreviews({
  uri,
  filters,
  selected,
  disabled,
  onSelect,
}: {
  uri: string;
  filters: { id: PhotoFilter; title: string }[];
  selected: PhotoFilter;
  disabled: boolean;
  onSelect: (filter: PhotoFilter) => void;
}) {
  const image = useImage(uri);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {filters.map(({ id, title }) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ selected: selected === id, disabled }}
          disabled={disabled}
          onPress={() => onSelect(id)}
          style={styles.item}
        >
          <View style={[styles.thumbnail, selected === id && styles.selected]}>
            <Canvas style={styles.canvas}>
              <Image
                image={image}
                x={0}
                y={0}
                width={76}
                height={96}
                fit="cover"
              >
                {id !== 'original' && (
                  <ColorMatrix matrix={photoFilterMatrices[id]} />
                )}
              </Image>
            </Canvas>
          </View>
          <Text style={[styles.label, selected === id && styles.selectedLabel]}>
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
  thumbnail: {
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selected: { borderColor: 'white' },
  canvas: { width: 76, height: 96, backgroundColor: '#282828' },
  label: { color: '#BBB', fontSize: 12, textAlign: 'center' },
  selectedLabel: { color: 'white', fontWeight: '700' },
});
