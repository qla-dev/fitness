import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Icon from './Icon';
import MenuItemIcon from './MenuItemIcon';

/** Apple Health's own pink, from its app icon. */
const HEALTH_PINK = '#FF2D55';
const HEALTH_PINK_LIGHT = '#FF6482';
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

type Props = {
  size?: number;
  /**
   * `tile` (default): the themed settings-row tile every neighbour uses, with
   * the heart in its top-right corner.
   * `app`: the Health app's real icon — a white squircle with the pink
   * gradient heart top-right — for hero placements.
   */
  variant?: 'tile' | 'app';
};

export default function AppleHealthIcon({ size = 39, variant = 'tile' }: Props) {
  if (variant === 'app') {
    const heart = size * 0.44;
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.225,
          borderCurve: 'continuous',
          backgroundColor: '#FFFFFF',
          // A hairline so the white icon still has an edge on a light screen.
          borderWidth: 0.5,
          borderColor: 'rgba(0, 0, 0, 0.1)',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <View
          style={{ position: 'absolute', top: size * 0.12, right: size * 0.1 }}
        >
          <Svg width={heart} height={heart} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id="appleHealthHeart" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={HEALTH_PINK_LIGHT} />
                <Stop offset="1" stopColor={HEALTH_PINK} />
              </LinearGradient>
            </Defs>
            <Path d={HEART_PATH} fill="url(#appleHealthHeart)" />
          </Svg>
        </View>
      </View>
    );
  }

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <MenuItemIcon size={size}>
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
      </MenuItemIcon>
    </View>
  );
}
