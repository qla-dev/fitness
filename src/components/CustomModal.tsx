import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import PromptSheet, { dismissPromptSheet } from './ui/PromptSheet';
import type { HeaderItem } from '../hooks/useScreenHeader';

export interface CustomModalRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  /** The sheet's heading; it moves into the native bar once scrolled under. */
  title: string;
  /** One native header action opposite the close button. */
  headerRight?: HeaderItem;
  children: ReactNode;
  /** Called once the sheet has closed, however it was closed. */
  onDismiss?: () => void;
  /** Called as the sheet closes (kept for callers; same moment as onDismiss). */
  onClose?: () => void;
  /** A committing action, in the shared footer. Left out, there is none. */
  footerLabel?: ReactNode;
  onFooterPress?: () => void;
  footerDisabled?: boolean;
  footerLoading?: boolean;
}

/**
 * A sheet of rows or a short form, opened with `present()` and closed with
 * `dismiss()`.
 *
 * It is {@link PromptSheet} in its list layout: GoalEdit's modal route, native
 * header and close button, and the page scrolling under the bar with its
 * title moving into it. The body pads its own sides, as it did in the bottom
 * sheet this used to be.
 */
const CustomModal = forwardRef<CustomModalRef, Props>(
  (
    {
      title,
      headerRight,
      children,
      onDismiss,
      onClose,
      footerLabel,
      onFooterPress,
      footerDisabled,
      footerLoading,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const openRef = useRef(false);
    useEffect(() => {
      openRef.current = open;
    }, [open]);
    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          openRef.current = true;
          setOpen(true);
        },
        // Closed at once, so a navigation right after it lands on top of the
        // screen the sheet came from.
        dismiss: () => {
          if (openRef.current) dismissPromptSheet();
          openRef.current = false;
          setOpen(false);
        },
      }),
      []
    );

    const wasOpen = useRef(false);
    useEffect(() => {
      if (wasOpen.current && !open) {
        onClose?.();
        onDismiss?.();
      }
      wasOpen.current = open;
      // Only the open state decides; the callbacks are read as they are now.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
      <PromptSheet
        open={open}
        onClose={() => setOpen(false)}
        headerTitle=""
        title={title}
        headerRight={headerRight}
        footerLabel={footerLabel}
        onFooterPress={onFooterPress}
        footerDisabled={footerDisabled}
        footerLoading={footerLoading}
        topAligned
        bleed
      >
        {children}
      </PromptSheet>
    );
  }
);

CustomModal.displayName = 'CustomModal';
export default CustomModal;
