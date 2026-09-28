import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import type { PhotoFont } from '../../services/recording/photoEditor';

// Native menus only render the system face, so samples live in this tray.
const families: Record<Exclude<PhotoFont, 'system'>, string> = {
  anton: 'PhotoAnton',
  bebas: 'PhotoBebasNeue',
  rajdhani: 'PhotoRajdhani',
  oswald: 'PhotoOswald',
};

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
  const [loaded] = useFonts({
    PhotoAnton: require('../../../assets/fonts/photo/anton/Anton-Regular.ttf'),
    PhotoBebasNeue: require('../../../assets/fonts/photo/bebasneue/BebasNeue-Regular.ttf'),
    PhotoRajdhani: require('../../../assets/fonts/photo/rajdhani/Rajdhani-SemiBold.ttf'),
    PhotoOswald: require('../../../assets/fonts/photo/oswald/Oswald[wght].ttf'),
  });
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
            <Text
              style={[
                styles.sampleText,
                id !== 'system' && loaded && { fontFamily: families[id] },
              ]}
            >
              Aa
            </Text>
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
  sampleText: { color: 'white', fontSize: 30 },
  label: { color: '#BBB', fontSize: 12, textAlign: 'center' },
  selectedLabel: { color: 'white', fontWeight: '700' },
});
