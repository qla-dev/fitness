import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Platform, View } from 'react-native';
import {
  MenuView,
  type MenuAction,
  type MenuComponentRef,
} from '@expo/ui/community/menu';

export interface TileMenuAction {
  id: string;
  title: string;
  /** SF Symbol shown on the menu row. */
  image: string;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * The system long-press menu around a tracker tile, the one the water tile
 * opens. A tap stays the tile's own; holding it opens the menu.
 *
 * `children` is the tile, handed an `onLongPress` it must give its own
 * Pressable: claiming the press there is what stops a hold from also firing
 * the tap, and on Android — where the menu is a JS shim the tile out-ranks —
 * it is what opens the menu at all. `show()` is a no-op on iOS by design.
 */
export default function TileMenu({
  actions,
  children,
}: {
  actions: TileMenuAction[];
  children: ReactElement<{ onLongPress?: () => void }>;
}) {
  // Held as state through a callback ref rather than read off a ref object:
  // the long-press handler is handed to the tile during render, and reading a
  // ref's `current` there is exactly what the compiler forbids.
  const [menu, setMenu] = useState<MenuComponentRef | null>(null);
  // The menu dismisses itself with an animation, and a navigation that starts
  // inside it lands on a screen the menu is still drawn over.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The trigger is a native host that sizes itself to its content, so it
  // takes no width from the grid cell; it is handed the measured one.
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    []
  );

  const handleLongPress = () => {
    if (Platform.OS === 'android') menu?.show();
  };

  const menuActions: MenuAction[] = actions.map((action) => ({
    id: action.id,
    title: action.title,
    image: action.image,
    ...(action.disabled ? { attributes: { disabled: true } } : {}),
  })) as MenuAction[];

  return (
    <View
      style={{ alignSelf: 'stretch' }}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        setCellWidth((current) => (current === width ? current : width));
      }}
    >
      <MenuView
        ref={setMenu}
        style={{ width: cellWidth ?? '100%' }}
        actions={menuActions}
        shouldOpenOnLongPress
        onPressAction={({ nativeEvent }) => {
          const action = actions.find((a) => a.id === nativeEvent.event);
          if (!action) return;
          if (pending.current) clearTimeout(pending.current);
          pending.current = setTimeout(action.onSelect, 250);
        }}
      >
        <View collapsable={false} style={{ width: cellWidth ?? '100%' }}>
          {cloneElement(children, { onLongPress: handleLongPress })}
        </View>
      </MenuView>
    </View>
  );
}
