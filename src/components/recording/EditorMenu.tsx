import { View } from 'react-native';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import Icon, { type IconName } from '../Icon';
import LiquidGlassSurface from '../LiquidGlassSurface';
import { fireSelectionHaptic } from '../../services/haptics';

export interface EditorMenuProps {
  label: string;
  icon: IconName;
  actions: MenuAction[];
  onSelect: (id: string) => void;
  onOpen: () => void;
}

export const editorMenuToolStyle = {
  width: 48,
  height: 48,
  borderRadius: 24,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** A round glass tool on the photo editor that opens a system menu. */
export default function EditorMenu({
  label,
  icon,
  actions,
  onSelect,
  onOpen,
}: EditorMenuProps) {
  return (
    // The touch is heard outside the menu, as the color pickers do: inside it
    // the native menu takes the touch first, so the press had no haptic.
    <View
      collapsable={false}
      onTouchStart={() => {
        fireSelectionHaptic();
        onOpen();
      }}
    >
      <MenuView
        actions={actions}
        onPressAction={({ nativeEvent }) => {
          fireSelectionHaptic();
          onSelect(nativeEvent.event);
        }}
      >
        <View
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {/* Not interactive: the press effect grows the glass past its bounds,
            and the menu's square native host clipped that into a grey square. */}
          <LiquidGlassSurface colorScheme="dark" style={editorMenuToolStyle}>
            <Icon name={icon} size={24} color="white" />
          </LiquidGlassSurface>
        </View>
      </MenuView>
    </View>
  );
}
