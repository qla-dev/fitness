import { useEffect, useRef } from 'react';

/** What a navigation object needs to offer for this to attach. */
type TabPressNavigation = {
  addListener?: (event: string, callback: () => void) => () => void;
  getParent?: () => TabPressNavigation | undefined;
  isFocused?: () => boolean;
};

/**
 * Runs `onPress` when the tab a screen belongs to is tapped while that screen
 * is already the one on show — the "take me back to the top" gesture every tab
 * bar has.
 *
 * The listener is attached to every navigator up the chain rather than to the
 * screen's own, and that is the whole reason this is a hook. Under the native
 * iOS tab bar each tab wraps its screen in a tab-local native stack, so a
 * screen's `navigation` belongs to that stack — which never emits `tabPress`,
 * because the tab navigator above it is what emits it. A screen listening on
 * itself therefore works on the fallback tab bar, where screens are direct
 * children of the tab navigator, and silently does nothing on the native one.
 * Walking the parents covers both, and only the tab navigator answers to the
 * event, so nothing fires twice.
 *
 * The focus check is what stops the first tap of a tab *switch* from scrolling
 * the screen being left, and stops a tap that pops a pushed screen from also
 * scrolling the root underneath it.
 *
 * Takes the navigation object rather than calling `useNavigation()` so it can
 * be used by a screen rendered without a navigation container — which is how
 * most of these screens are tested.
 */
export function useTabPress(navigation: unknown, onPress: () => void): void {
  // `unknown` rather than a navigation type: React Navigation types
  // `addListener` to the events of one navigator, and the whole point here is
  // to attach an event that a DIFFERENT navigator up the chain owns. Narrowing
  // at the boundary keeps the cast in one place instead of at every call site.
  const nav = navigation as TabPressNavigation | undefined;
  // Held in a ref so a caller's inline closure does not re-subscribe on every
  // render; the subscription only depends on the navigator.
  const handler = useRef(onPress);
  useEffect(() => {
    handler.current = onPress;
  }, [onPress]);

  useEffect(() => {
    if (!nav) return;
    const unsubscribes: (() => void)[] = [];
    let current: TabPressNavigation | undefined = nav;
    while (current) {
      if (typeof current.addListener === 'function') {
        unsubscribes.push(
          current.addListener('tabPress', () => {
            // No isFocused to ask means no way to tell a re-tap from a switch,
            // so the safe answer is to do nothing.
            if (nav.isFocused?.()) handler.current();
          })
        );
      }
      current =
        typeof current.getParent === 'function' ? current.getParent() : undefined;
    }
    return () => unsubscribes.forEach((off) => off());
  }, [nav]);
}
