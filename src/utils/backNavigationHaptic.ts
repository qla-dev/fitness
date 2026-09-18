import { fireSelectionHaptic } from '../services/haptics';

type RouteLike = { key: string };
type StackStateLike = { routes: readonly RouteLike[] } | undefined;

/**
 * Native-stack emits `transitionStart` with `closing: true` from
 * `onWillDisappear`, which fires for the outgoing screen on a *push* just as
 * it does on a pop — so `closing` alone cannot drive back feedback.
 *
 * The direction shows in the navigator's state at that moment: a push has
 * already added the incoming route, leaving the disappearing screen second
 * from the top, while a screen genuinely going back is still the last route
 * (native back button, whose POP reaches JS only after the animation) or is
 * gone from state already (a JS `goBack()`, dispatched before the animation).
 *
 * A stack holding a single route is the exception, and the reason this listener
 * is on every tab's inner stack as well as the root: pushing a root screen over
 * the tabs marks the tab's only route closing too, and that route is trivially
 * "the last one". There is nothing under it to go back to, so it is a push seen
 * from below — not a pop.
 */
export function isPopTransition(
  state: StackStateLike,
  targetKey: string | undefined
): boolean {
  if (!targetKey) return false;
  const routes = state?.routes;
  if (!routes || routes.length === 0) return false;
  const index = routes.findIndex((route) => route.key === targetKey);
  // Already removed: a JS goBack() dispatched before the animation, which is a
  // pop however short the stack now is.
  if (index === -1) return true;
  return routes.length > 1 && index === routes.length - 1;
}

/**
 * The selection haptic every header button fires, for back navigation. It
 * hangs off the pop transition rather than the back button because the iOS
 * native header back button is drawn by the OS and exposes no JS press
 * handler; the pop animation starts on the press, so this is the earliest
 * signal available.
 */
export function fireBackNavigationHaptic(
  state: StackStateLike,
  targetKey: string | undefined
): void {
  if (isPopTransition(state, targetKey)) fireSelectionHaptic();
}
