import React, { useEffect, useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import CalendarModal, { type CalendarModalRef } from '../CalendarModal';
import FooterCTA from '../ui/FooterCTA';

/**
 * The photo editor's one prompt (where a photo was taken), drawn as a bottom
 * sheet inside the editor.
 *
 * The one exception to PromptSheet besides the calendar: the editor is a
 * full-screen React Native `Modal`, and nothing on the navigation stack can
 * appear above one, so a modal route opened from here would sit behind it.
 * Once the editor is a route of its own, this goes and the prompt becomes a
 * PromptSheet like every other.
 */
export default function EditorPromptSheet({
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
  footerTint,
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
  /** Match the action to the goal or metric being edited. */
  footerTint?: string;
  /** See the note above: it decides alignment and whether a keyboard opens. */
  hasTextInput?: boolean;
  /** Whether tapping the dimmed area closes the sheet. */
  dismissOnBackdropPress?: boolean;
  children: React.ReactNode;
}) {
  const sheet = useRef<CalendarModalRef>(null);
  const presented = useRef(false);

  useEffect(() => {
    if (open) {
      presented.current = true;
      sheet.current?.present();
    } else if (presented.current) {
      // Never dismiss a sheet that was not presented: gorhom marks a fresh
      // modal as DISMISSING, and its portal then skips every later present(),
      // so the first tap on a closed-on-mount sheet silently did nothing.
      presented.current = false;
      sheet.current?.dismiss();
    }
  }, [open]);

  return (
    <CalendarModal
      ref={sheet}
      fullHeight
      background="background"
      title={category ?? ''}
      dismissOnBackdropPress={dismissOnBackdropPress}
      onDismiss={() => {
        // Closed by the sheet itself (swipe, close chip, backdrop): it is no
        // longer presented, so the parent's open=false must not dismiss it a
        // second time — that left gorhom DISMISSING and every later open did
        // nothing.
        presented.current = false;
        onClose();
      }}
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
        tint={footerTint}
      />
    </CalendarModal>
  );
}
