import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import LiquidGlassSurface from './LiquidGlassSurface';
import { canUseLiquidGlass } from '../utils/liquidGlass';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * One of the facts an entry is filed under — its day, its time, its meal —
 * as a card in a horizontal strip.
 *
 * Glass, like the stat cards on the workout setup screen: three labelled
 * values side by side read as one control rather than as three sentences
 * stacked down the page, each with its own shortcuts trailing off to the
 * right. Off iOS 26 the material falls back to the raised fill.
 */
export default function EntryContextCard({
  label,
  value,
  onPress,
}: {
  label: string;
  /** What is on file now; an em dash where nothing is. */
  value: string;
  onPress: () => void;
}) {
  const usesGlass = canUseLiquidGlass();
  const textSecondary = useCSSVariable('--color-text-secondary') as string;

  return (
    <LiquidGlassSurface
      isInteractive
      style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={() => {
          fireSelectionHaptic();
          onPress();
        }}
        className={`px-3 py-2.5${usesGlass ? '' : ' bg-raised'}`}
      >
        <Text className="text-text-muted text-xs" numberOfLines={1}>
          {label}
        </Text>
        <View className="flex-row items-center">
          <Text
            className="text-text-primary text-base font-semibold flex-1"
            numberOfLines={1}
          >
            {value}
          </Text>
          <Icon
            name="chevron-down"
            size={11}
            color={textSecondary}
            weight="medium"
            style={{ marginLeft: 4 }}
          />
        </View>
      </Pressable>
    </LiquidGlassSurface>
  );
}
