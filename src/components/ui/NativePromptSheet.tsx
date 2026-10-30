import type { ReactNode } from 'react';
import PromptSheet from './PromptSheet';

/**
 * The one-decision sheet (a title, a line of explanation, one control, the
 * action that commits it), opened from a screen with `open` / `onClose`.
 *
 * It is {@link PromptSheet}: the same modal route and PromptScreen as the
 * Tracker's GoalEdit, so its header, close button, corner and footer are
 * GoalEdit's. `hasTextInput` decides alignment, as there: with a field the
 * control sits against the explanation; without one it is centred.
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
  footerTint,
  hasTextInput = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** What kind of thing is being set, in the bar above the title. */
  category?: string;
  /** The heading: the one thing this sheet changes. */
  title: string;
  /** The line under the title explaining what the choice affects. */
  description?: string;
  /** Small print above the action — a caveat, not an instruction. */
  footnote?: string;
  /** The committing action, in the shared footer. */
  footerLabel: ReactNode;
  onFooterPress: () => void;
  footerDisabled?: boolean;
  footerLoading?: boolean;
  /** Match the action to the goal or metric being edited. */
  footerTint?: string;
  /** See the note above: it decides alignment. */
  hasTextInput?: boolean;
  /** Kept for callers; a modal route always closes by its own gestures. */
  dismissOnBackdropPress?: boolean;
  children: ReactNode;
}) {
  return (
    <PromptSheet
      open={open}
      onClose={onClose}
      headerTitle={category ?? ''}
      title={title}
      description={description}
      footnote={footnote}
      footerLabel={footerLabel}
      onFooterPress={onFooterPress}
      footerDisabled={footerDisabled}
      footerLoading={footerLoading}
      footerTint={footerTint}
      hasTextInput={hasTextInput}
    >
      {children}
    </PromptSheet>
  );
}
