import { forwardRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type ViewStyle,
  type ScrollViewInstance,
} from 'react-native';
import { useNativeHeaderOffset } from '../../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../../services/nativeTabBarPreference';

/**
 * A ScrollView that starts its content below a transparent native header by
 * padding it, rather than by `contentInsetAdjustmentBehavior="automatic"`.
 *
 * Under iOS 26's Liquid Glass bar the automatic inset was applied twice once
 * the content had been dragged: the screen opened in the right place, then a
 * pull settled it a bar's height lower and it stayed there. Padding by the
 * measured bar height leaves UIKit nothing to adjust, so the resting position
 * is the opening one. Off the native header path this is a plain ScrollView.
 */
type NativeHeaderScrollViewProps = ScrollViewProps & {
  /**
   * Overrides the measured bar height on the native header path. For a screen
   * whose bar hides and returns with a state change (the food dashboard's
   * search): the measured height only arrives a frame or more after the bar
   * has moved, so padding by it lays the new content out at the old height
   * and then snaps it. A screen that knows the height up front passes it here
   * and the padding changes in the same render as the content.
   */
  topOffset?: number;
};

const NativeHeaderScrollView = forwardRef<
  ScrollViewInstance,
  NativeHeaderScrollViewProps
>(
  function NativeHeaderScrollView(
    { contentContainerStyle, scrollIndicatorInsets, topOffset, ...rest },
    ref
  ) {
    const usesNativeHeader = useNativeIOSHeadersActive();
    const headerOffset = useNativeHeaderOffset();
    const top = usesNativeHeader ? (topOffset ?? headerOffset) : 0;
    const flat = (StyleSheet.flatten(contentContainerStyle) ?? {}) as ViewStyle;
    // Content starts flush with the bar on every screen: the bar carries the
    // gap above it, so a screen's own top padding is not added again.
    return (
      <ScrollView
        ref={ref}
        {...rest}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={{ ...scrollIndicatorInsets, top }}
        contentContainerStyle={[flat, { paddingTop: top }]}
      />
    );
  }
);

export default NativeHeaderScrollView;
