import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { useSheetBackdrop } from './ui/sheetChrome';
import { fireSelectionHaptic } from '../services/haptics';

export interface CustomModalRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  /** Plain text, or a node when the title mixes faces (e.g. the wordmark). */
  title: React.ReactNode;
  titleStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
  onDismiss?: () => void;
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  onClose?: () => void;
}

/** Edge-attached, content-sized sheet with native-inspired header chrome. */
const CustomModal = forwardRef<CustomModalRef, Props>(
  ({ title, titleStyle, children, onDismiss, onAnimate, onClose }, ref) => {
    const sheet = useRef<BottomSheetModal>(null);
    const { t } = useTranslation();
    const backdrop = useSheetBackdrop();
    const [surface, raised, foreground, muted] = useCSSVariable([
      '--color-surface',
      '--color-raised',
      '--color-text-primary',
      '--color-text-muted',
    ]) as [string, string, string, string];
    useImperativeHandle(
      ref,
      () => ({
        present: () => sheet.current?.present(),
        dismiss: () => sheet.current?.dismiss(),
      }),
      []
    );
    return (
      <BottomSheetModal
        ref={sheet}
        enableDynamicSizing
        detached={false}
        bottomInset={0}
        backdropComponent={backdrop}
        onDismiss={onDismiss}
        onAnimate={onAnimate}
        backgroundStyle={{
          backgroundColor: surface,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
        }}
        handleIndicatorStyle={{ backgroundColor: muted, width: 36, height: 5 }}
      >
        <BottomSheetView style={{ paddingBottom: 16 }}>
          <View
            collapsable={false}
            className="flex-row items-center px-4 pb-3 pt-1"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
              hitSlop={8}
              onPress={() => {
                fireSelectionHaptic();
                if (onClose) onClose();
                else sheet.current?.dismiss();
              }}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: raised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon
                name="close"
                size={18}
                weight="semibold"
                color={foreground}
              />
            </Pressable>
            <Text
              className="flex-1 text-center text-lg font-semibold text-text-primary"
              accessibilityRole="header"
              style={titleStyle}
            >
              {title}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
CustomModal.displayName = 'CustomModal';
export default CustomModal;
