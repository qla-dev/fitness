import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** What either kind of scrollable answers to. */
type Scrollable = {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

/**
 * How long to let the scroll settle before checking whether it arrived. An
 * animated `scrollTo` runs about 300ms; this leaves it room to finish.
 */
const SETTLE_MS = 400;

/** Close enough to the top to call it arrived. */
const ARRIVED_EPSILON = 1;

/**
 * Remembers the offset the top of a scroll view actually sits at, and scrolls
 * back to it.
 *
 * Zero is not the top of a scroll view that has a content inset. Under the
 * native iOS tab bar these screens set
 * `contentInsetAdjustmentBehavior="automatic"`, so iOS reserves room for the
 * navigation bar and its large title by insetting the content — and at rest at
 * the top the offset is *negative*, `-insetTop`, not `0`.
 *
 * That inset is not readable from JS: the scroll event carries the explicitly
 * set `contentInset`, which is zero here, not the adjusted one iOS computed. So
 * this watches rather than asks — the view opens at the top and reports that
 * position the moment the inset lands, and the lowest offset seen up to then is
 * it. Seeded at 0, which is already correct for a screen with no inset.
 *
 * Learning stops the first time a finger touches the view, and that is the
 * whole subtlety. Dragging goes *past* the top — a rubber-band pull, and
 * further still for pull-to-refresh — so an offset seen during or after a drag
 * is not a resting position. Left to keep learning, the hook adopted the
 * deepest pull-to-refresh offset as "the top", and re-tapping the tab then
 * scrolled into the refresh zone and sat there with the spinner showing. The
 * inset lands within a few hundred ms of mount, long before anyone can drag, so
 * freezing costs nothing.
 *
 * Consumers must also set `scrollToOverflowEnabled` on the scroll view, or none
 * of this arrives: React Native clamps a programmatic offset against the
 * explicit `contentInset` (zero here), so every negative y is pinned to 0.
 */
export function useScrollTopOffset() {
  const topOffset = useRef(0);
  /** Where the view was last seen, to tell an arrival from a short landing. */
  const lastOffset = useRef(0);
  /** Set on the first drag; the top is known by then and only noise follows. */
  const settled = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retry.current) clearTimeout(retry.current);
    },
    []
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      lastOffset.current = y;
      if (settled.current) return;
      if (y < topOffset.current) topOffset.current = y;
    },
    []
  );

  /** Wire to the scroll view's `onScrollBeginDrag`. */
  const onScrollBeginDrag = useCallback(() => {
    settled.current = true;
  }, []);

  const scrollToTop = useCallback((node: Scrollable | null | undefined) => {
    if (!node) return;
    const goToTop = () => {
      const y = topOffset.current;
      if (typeof node.scrollTo === 'function')
        node.scrollTo({ y, animated: true });
      else node.scrollToOffset?.({ offset: y, animated: true });
    };

    goToTop();
    if (retry.current) clearTimeout(retry.current);
    retry.current = setTimeout(() => {
      retry.current = null;
      // Only when the first pass landed short. A view that arrived is left
      // alone, so nothing re-scrolls under someone who has already moved on.
      if (lastOffset.current > topOffset.current + ARRIVED_EPSILON) goToTop();
    }, SETTLE_MS);
  }, []);

  return { topOffset, onScroll, onScrollBeginDrag, scrollToTop };
}
