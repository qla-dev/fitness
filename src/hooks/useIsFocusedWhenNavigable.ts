import { useContext } from 'react';
import { NavigationContext, useIsFocused } from '@react-navigation/native';

/** `useIsFocused`, but only consulted where a navigator exists to consult. */
function useIsFocusedSafely(navigable: boolean): boolean {
  try {
    return useIsFocused();
  } catch {
    return !navigable;
  }
}

/**
 * Whether the screen holding this component is showing, or `true` where there
 * is no navigator to ask.
 *
 * `useIsFocused` throws outside a navigation container, which turns a
 * presentational component into something a caller can only render inside one
 * — and a card that draws a ring should not drag a NavigationContainer into
 * every test that mounts it. Nothing is on top of a ring with no navigator
 * above it, so "focused" is the honest answer.
 *
 * Used by the rings that replay their fill on every visit: the Tracker's
 * nutrition rings and the Activities rings both start empty each time the
 * screen is entered, whether or not the day's figures were already cached.
 */
export function useIsFocusedWhenNavigable(): boolean {
  const navigable = useContext(NavigationContext) != null;
  // Both hooks run on every render: the context decides which answer is used,
  // never whether a hook is called.
  const focused = useIsFocusedSafely(navigable);
  return navigable ? focused : true;
}
