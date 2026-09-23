import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon, { type IconName } from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * The pill's own height. The bar around it adds the gap below and the safe
 * area, which is what {@link TAB_BAR_HEIGHT} covers.
 */
const PILL_HEIGHT = 60;
/** Between the pill and the screen's bottom inset, and beside the circle. */
const PILL_GAP = 8;

export const TAB_BAR_HEIGHT = PILL_HEIGHT + PILL_GAP;

export const TAB_ICONS: Record<string, IconName> = {
  Dashboard: 'exercise-weights',
  Diary: 'checklist',
  Trends: 'chart-bar',
  Exercises: 'tab-dashboard',
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [chrome, chromeBorder, tabActive, tabInactive, accentPrimary] =
    useCSSVariable([
      '--color-chrome',
      '--color-chrome-border',
      '--color-tab-active',
      '--color-tab-inactive',
      '--color-accent-primary',
    ]) as [string, string, string, string, string];

  // The tab bar iOS 26 draws: the content tabs in one floating pill, and the
  // food button as its own circle beside it rather than a notch punched
  // through the middle. Add is pulled out of the row for that reason — it
  // opens a screen, it is not a place you are.
  const tabRoutes = state.routes.filter((route) => route.name !== 'Add');
  const addRoute = state.routes.find((route) => route.name === 'Add');

  // The Add tab hands its own bottom row to the screen: a way back to the tab
  // you came from, and the search field, in the bar's place. Keeping the tabs
  // as well would stack two bars on top of each other and push the field —
  // the one thing that screen is for — up off the thumb.
  if (state.routes[state.index]?.name === 'Add') return null;

  const pressHandlers = (route: (typeof state.routes)[number]) => {
    const isFocused = state.routes[state.index]?.key === route.key;
    return {
      onPress: () => {
        fireSelectionHaptic();
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!event.defaultPrevented && !isFocused) {
          navigation.navigate(route.name, route.params);
        }
      },
      onLongPress: () => {
        navigation.emit({ type: 'tabLongPress', target: route.key });
      },
    };
  };

  return (
    <View
      className="flex-row items-end"
      style={{
        paddingHorizontal: 12,
        paddingBottom: Math.max(insets.bottom, PILL_GAP),
        gap: PILL_GAP,
        backgroundColor: 'transparent',
      }}
      pointerEvents="box-none"
    >
      <View
        className="flex-1 flex-row items-center overflow-hidden"
        style={{
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: chrome,
          borderColor: chromeBorder,
          borderWidth: StyleSheet.hairlineWidth,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
            },
            android: { elevation: 3 },
          }),
        }}
      >
        {tabRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.key === route.key;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const iconName = TAB_ICONS[route.name];
          const tintColor = isFocused ? tabActive : tabInactive;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : undefined}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              {...pressHandlers(route)}
              className="flex-1 items-center justify-center gap-0.5"
            >
              {iconName && (
                <Icon
                  name={iconName}
                  size={22}
                  color={tintColor}
                  weight={isFocused ? 'bold' : 'regular'}
                />
              )}
              <Text
                className={`text-[11px] ${isFocused ? 'font-semibold' : 'font-medium'}`}
                style={{ color: tintColor }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {addRoute ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            descriptors[addRoute.key]?.options.tabBarAccessibilityLabel ??
            t('navigation.add', { defaultValue: 'Add' })
          }
          {...pressHandlers(addRoute)}
          activeOpacity={0.8}
          className="items-center justify-center"
          style={{
            width: PILL_HEIGHT,
            height: PILL_HEIGHT,
            borderRadius: PILL_HEIGHT / 2,
            backgroundColor: accentPrimary,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
              },
              android: { elevation: 4 },
            }),
          }}
        >
          <Icon name="food" size={24} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default CustomTabBar;
