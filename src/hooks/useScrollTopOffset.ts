import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Remembers the content offset the top of a scroll view actually sits at, so
 * "scroll to top" can go there instead of to zero.
 *
 * Zero is not the top of a scroll view that has a content inset. Under the
 * native iOS tab bar these screens set
 * `contentInsetAdjustmentBehavior="automatic"`, so iOS reserves room for the
 * navigation bar and its large title by insetting the content — and at rest at
 * the top the offset is *negative*, `-insetTop`, not `0`. Scrolling to zero
 * therefore stops with the large title already collapsed and the first card
 * tucked under the bar, which is the "doesn't go to the very top" you get from
 * the obvious implementation.
 *
 * The inset is not readable from JS: the scroll event carries the explicitly
 * set `contentInset`, which is zero here, and not the adjusted one iOS
 * computed. So this watches instead of asking — the lowest offset the view has
 * ever reported IS the top, because a scroll view opens at the top and can
 * only be dragged away from it. Seeded at 0, which is correct for every screen
 * with no inset, and refined the first time the user drags.
 */
export function useScrollTopOffset() {
  const topOffset = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      if (y < topOffset.current) topOffset.current = y;
    },
    []
  );

  return { topOffset, onScroll };
}
