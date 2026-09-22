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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /**
   * Fills the screen instead of sizing to content, for a sheet that is really
   * a one-question form: the input then sits at a fixed place with its action
   * pinned at the foot, the same shape the setup wizard uses, rather than
   * jumping up and down as an error line appears and clears.
   */
  fullHeight?: boolean;
  /**
   * Which token the sheet itself is filled with. The default surface is right
   * for a sheet of rows, but a sheet carrying a form wants the page background
   * — `PillInput` and every card in the app are `bg-surface`, so on a surface
   * sheet they vanish into it and an input reads as bare text.
   */
  background?: 'surface' | 'background';
  /**
   * Whether tapping the dimmed area closes the sheet. Off for a sheet you type
   * in: the first tap outside the field goes to dismissing the keyboard, and
   * closing on the same tap reads as the sheet giving up on your input.
   */
  dismissOnBackdropPress?: boolean;
}

/**
 * '100%' is of the space left under `topInset`, so this stops below the status
 * bar rather than over it.
 */
const FULL_HEIGHT_SNAP_POINTS = ['100%'];

/** Matches the system form-sheet corner, and the close chip matches its chips. */
const SHEET_CORNER_RADIUS = 44;
const CLOSE_CHIP_SIZE = 44;

/** Edge-attached, content-sized sheet with native-inspired header chrome. */
const CustomModal = forwardRef<CustomModalRef, Props>(
  (
    {
      title,
      titleStyle,
      children,
      onDismiss,
      onAnimate,
      onClose,
      fullHeight,
      background = 'surface',
      dismissOnBackdropPress = true,
    },
    ref
  ) => {
    const sheet = useRef<BottomSheetModal>(null);
    const { t } = useTranslation();
    const Container = fullHeight ? View : BottomSheetView;
    const containerStyle = fullHeight ? { flex: 1 } : { paddingBottom: 16 };
    const backdrop = useSheetBackdrop({ dismissOnPress: dismissOnBackdropPress });
    const insets = useSafeAreaInsets();
    const [surface, pageBackground, raised, foreground, muted] = useCSSVariable(
      [
        '--color-surface',
        '--color-background',
        '--color-raised',
        '--color-text-primary',
        '--color-text-muted',
      ]
    ) as [string, string, string, string, string];
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
        // Dynamic sizing and a fixed snap point are mutually exclusive: the
        // first measures the content, the second ignores it.
        enableDynamicSizing={!fullHeight}
        snapPoints={fullHeight ? FULL_HEIGHT_SNAP_POINTS : undefined}
        detached={false}
        bottomInset={0}
        // Tall content caps below the status bar instead of snapping to the
        // full screen height over it.
        topInset={insets.top}
        backdropComponent={backdrop}
        onDismiss={onDismiss}
        onAnimate={onAnimate}
        backgroundStyle={{
          backgroundColor: background === 'surface' ? surface : pageBackground,
          // The radius iOS gives a form sheet on 26. A tighter corner is what
          // makes a JS sheet read as not-quite-native beside a real one.
          borderTopLeftRadius: SHEET_CORNER_RADIUS,
          borderTopRightRadius: SHEET_CORNER_RADIUS,
        }}
        handleIndicatorStyle={{ backgroundColor: muted, width: 36, height: 5 }}
      >
        {/* A fixed snap point needs a plain flex view. BottomSheetView exists
            to measure its children for dynamic sizing, so it takes their
            natural height and leaves the rest of the sheet empty underneath —
            which stranded the footer well above the keyboard instead of
            sitting against it. */}
        <Container style={containerStyle}>
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
                width: CLOSE_CHIP_SIZE,
                height: CLOSE_CHIP_SIZE,
                borderRadius: CLOSE_CHIP_SIZE / 2,
                backgroundColor: raised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon
                name="close"
                size={20}
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
            <View style={{ width: CLOSE_CHIP_SIZE }} />
          </View>
          {children}
        </Container>
      </BottomSheetModal>
    );
  }
);
CustomModal.displayName = 'CustomModal';
export default CustomModal;
