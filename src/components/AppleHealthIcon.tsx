import { View } from 'react-native';
import Icon from './Icon';

/** Apple Health's own pink, from its app icon. */
const HEALTH_PINK = '#FF2D55';

/**
 * The Health app's icon at a settings row's tile size: a white tile with the
 * heart in its top-right corner, so the connector row reads as Apple Health at
 * a glance instead of as a generic heart glyph.
 */
export default function AppleHealthIcon({ size = 39 }: { size?: number }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="rounded-lg"
      style={{
        width: size,
        height: size,
        backgroundColor: '#FFFFFF',
        // A hairline so the white tile still has an edge on a light card.
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.08)',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          right: size * 0.12,
        }}
      >
        <Icon
          name="heart-rate"
          size={Math.round(size * 0.4)}
          color={HEALTH_PINK}
        />
      </View>
    </View>
  );
}
