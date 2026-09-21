import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCSSVariable } from 'uniwind';

import Icon from '../Icon';
import { sheetContainer, useSheetBackdrop } from './sheetChrome';

/**
 * The app's one-decision sheet: a title, a line of explanation, one control,
 * and the action that commits it.
 *
 * Modelled on the system sheets Apple uses for the same job — set today's Move
 * goal, confirm a permission — rather than on a screen squeezed into a modal.
 * The chrome lives here so every such sheet dismisses, scrolls and sizes the
 * same way, and the caller supplies only the control in the middle.
 *
 * `hasTextInput` is the one thing that changes its shape, because typing and
 * tapping want opposite layouts:
 *
 * - **With** a field, the content sits against the top and the keyboard is
 *   expected, so nothing is centred into the space the keyboard will take.
 * - **Without** one, the content is centred and no keyboard is raised — a
 *   stepper or a picker should not summon one just by opening.
 */
export default function NativePromptSheet({
  open,
  onClose,
  title,
  description,
  footnote,
  footer,
  hasTextInput = false,
  dismissOnBackdropPress = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The line under the title explaining what the choice affects. */
  description?: string;
  /** Small print above the action — a caveat, not an instruction. */
  footnote?: string;
  /** The committing action. Rendered against the bottom edge. */
  footer?: React.ReactNode;
  /** See the note above: it decides alignment and whether a keyboard opens. */
  hasTextInput?: boolean;
  /**
   * Whether tapping the dimmed area closes the sheet. Off for a sheet you type
   * in: the first tap outside the field goes to dismissing the keyboard, and
   * closing on the same tap reads as the sheet giving up on your input.
   */
  dismissOnBackdropPress?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const backdrop = useSheetBackdrop({ dismissOnPress: dismissOnBackdropPress });
  const textPrimary = useCSSVariable('--color-text-primary') as string;

  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);

  const close = useCallback(() => sheet.current?.dismiss(), []);

  const body = (
    <>
      <View className="px-5 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          hitSlop={8}
          onPress={close}
          className="w-9 h-9 rounded-full bg-raised items-center justify-center mb-4"
        >
          <Icon name="close" size={18} color={textPrimary} />
        </Pressable>
        <Text className="text-text-primary text-2xl font-bold">{title}</Text>
        {description ? (
          <Text className="text-text-secondary text-base mt-2">
            {description}
          </Text>
        ) : null}
      </View>

      <View
        className={`px-5 ${hasTextInput ? 'pt-6' : 'flex-1 justify-center py-8'}`}
      >
        {children}
      </View>

      <View className="px-5 pb-2">
        {footnote ? (
          <Text className="text-text-muted text-xs mb-3">{footnote}</Text>
        ) : null}
        {footer}
      </View>
    </>
  );

  return (
    <BottomSheetModal
      ref={sheet}
      // A typed sheet sizes itself around the field and the keyboard; a tapped
      // one takes the tall snap point so its control sits in the middle of the
      // screen rather than in the middle of a short sheet.
      enableDynamicSizing={hasTextInput}
      snapPoints={hasTextInput ? undefined : ['85%']}
      keyboardBehavior={hasTextInput ? 'interactive' : 'extend'}
      android_keyboardInputMode="adjustResize"
      onDismiss={onClose}
      backdropComponent={backdrop}
      containerComponent={sheetContainer}
    >
      {hasTextInput ? (
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={{ flex: 1 }}>{body}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
}
