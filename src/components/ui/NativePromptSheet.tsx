import React, { useEffect, useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import CustomModal, { type CustomModalRef } from '../CustomModal';
import FooterCTA from './FooterCTA';

/**
 * The app's one-decision sheet: a title, a line of explanation, one control,
 * and the action that commits it.
 *
 * Modelled on the system sheets Apple uses for the same job — set today's Move
 * goal, confirm a permission — rather than on a screen squeezed into a modal.
 *
 * It is {@link CustomModal} in `fullHeight`, which is what makes it read as
 * native: the app's handle, corner radius, status-bar inset and round close
 * chip, on the page background so the control inside is not a surface on a
 * surface. Built from a bare `BottomSheetModal` instead, the footer stranded
 * itself mid-sheet — `BottomSheetView` measures its children, so under a fixed
 * snap point it takes their natural height and leaves the rest empty
 * underneath. The same trap `CustomModal` already carries a comment about.
 *
 * `hasTextInput` is the one thing that changes its shape, because typing and
 * tapping want opposite layouts:
 *
 * - **With** a field, the control sits against the explanation and the
 *   keyboard is expected, so nothing is centred into the space it will take.
 * - **Without** one, the control is centred in the room between the title and
 *   the action, and no keyboard is raised — a stepper should not summon one
 *   just by opening.
 */
export default function NativePromptSheet({
  open,
  onClose,
  category,
  title,
  description,
  footnote,
  footerLabel,
  onFooterPress,
  footerDisabled,
  footerLoading,
  hasTextInput = false,
  dismissOnBackdropPress = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * What kind of thing is being set, centred in the sheet's own bar above the
   * title — "Measurements" over Weight. Left out, the bar holds only the close
   * chip, which is how Apple's own single-value sheets look.
   */
  category?: string;
  /** The heading: the one thing this sheet changes. */
  title: string;
  /** The line under the title explaining what the choice affects. */
  description?: string;
  /** Small print above the action — a caveat, not an instruction. */
  footnote?: string;
  /** The committing action, in the app's standard footer bar. */
  footerLabel: ReactNode;
  onFooterPress: () => void;
  footerDisabled?: boolean;
  footerLoading?: boolean;
  /** See the note above: it decides alignment and whether a keyboard opens. */
  hasTextInput?: boolean;
  /** Whether tapping the dimmed area closes the sheet. */
  dismissOnBackdropPress?: boolean;
  children: React.ReactNode;
}) {
  const sheet = useRef<CustomModalRef>(null);

  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);

  return (
    <CustomModal
      ref={sheet}
      fullHeight
      background="background"
      title={category ?? ''}
      dismissOnBackdropPress={dismissOnBackdropPress}
      onDismiss={onClose}
    >
      <View className="px-5">
        <Text className="text-text-primary text-3xl font-bold">{title}</Text>
        {description ? (
          <Text className="text-text-secondary text-base mt-2">
            {description}
          </Text>
        ) : null}
      </View>

      <View
        className={`flex-1 px-5 ${hasTextInput ? 'pt-6' : 'justify-center'}`}
      >
        {children}
      </View>

      {footnote ? (
        <Text className="text-text-muted text-xs px-5 pb-3">{footnote}</Text>
      ) : null}
      <FooterCTA
        // The sheet lifts for the keyboard on its own; a sticky footer lifting
        // again on top of that threw it to the top of the sheet.
        sticky={false}
        glass
        label={footerLabel}
        onPress={onFooterPress}
        disabled={footerDisabled}
        loading={footerLoading}
      />
    </CustomModal>
  );
}
