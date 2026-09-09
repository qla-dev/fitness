import { useState, type ReactNode } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { MENU_ITEM_RIGHT_INSET } from './menuItemLayout';

export function MenuItemDivider({ inset = 64 }: { inset?: number }) {
  return (
    <View
      className="bg-border-subtle"
      style={{
        height: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
        marginLeft: inset,
      }}
    />
  );
}

/** Shared row geometry. Callers own navigation, swiping and native menus. */
export default function MenuItem({
  leading,
  children,
  trailing,
  width,
}: {
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  width?: number;
}) {
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const [trailingWidth, setTrailingWidth] = useState(80);
  const availableWidth = width ?? measuredWidth;
  const leadingWidth = leading ? 39 + 12 : 0;
  const trailingSpace = trailing ? trailingWidth + 12 : 0;
  return (
    <View
      onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}
      style={{
        width: width ?? '100%',
        minHeight: 66,
        paddingLeft: 13,
        paddingRight: MENU_ITEM_RIGHT_INSET,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {leading ? (
        <View style={{ width: 39, flexShrink: 0 }}>{leading}</View>
      ) : null}
      <View
        style={{
          flexGrow: availableWidth === undefined ? 1 : 0,
          flexShrink: 1,
          minWidth: 0,
          width:
            availableWidth === undefined
              ? undefined
              : Math.max(
                  0,
                  availableWidth -
                    13 -
                    MENU_ITEM_RIGHT_INSET -
                    leadingWidth -
                    trailingSpace
                ),
          marginRight: trailingSpace,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
      {trailing ? (
        <View
          onLayout={({ nativeEvent }) =>
            setTrailingWidth(nativeEvent.layout.width)
          }
          style={{
            position: 'absolute',
            right: MENU_ITEM_RIGHT_INSET,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          {trailing}
        </View>
      ) : null}
    </View>
  );
}
