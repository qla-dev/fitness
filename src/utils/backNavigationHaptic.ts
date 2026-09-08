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
 */
export function isPopTransition(
  state: StackStateLike,
  targetKey: string | undefined
): boolean {
  if (!targetKey) return false;
  const routes = state?.routes;
  if (!routes || routes.length === 0) return false;
  const index = routes.findIndex((route) => route.key === targetKey);
  return index === -1 || index === routes.length - 1;
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
