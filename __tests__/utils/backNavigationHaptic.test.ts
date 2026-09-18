import { isPopTransition } from '../../src/utils/backNavigationHaptic';

// Native-stack reports `closing: true` for the outgoing screen of a push as
// well as a pop, so these cases pin down the direction test that tells them
// apart. A push had already fired a second haptic before this existed.
describe('isPopTransition', () => {
  const state = (...keys: string[]) => ({ routes: keys.map((key) => ({ key })) });

  it('treats the top route leaving as a pop', () => {
    // Native back button: the POP action reaches JS only after the animation,
    // so the leaving route is still last in state when the haptic fires.
    expect(isPopTransition(state('a', 'b'), 'b')).toBe(true);
  });

  it('treats a route already removed from state as a pop', () => {
    // A JS goBack() dispatches before the animation starts.
    expect(isPopTransition(state('a'), 'b')).toBe(true);
  });

  it('does not treat the outgoing screen of a push as a pop', () => {
    expect(isPopTransition(state('a', 'b'), 'a')).toBe(false);
  });

  it('does not fire for the incoming screen of a push', () => {
    expect(isPopTransition(state('a', 'b', 'c'), 'b')).toBe(false);
  });

  // The tab stacks carry this listener too, and each holds a single route. A
  // root push over the tabs marks that route closing, and it is trivially the
  // last one — which used to read as a pop and fire a second haptic on top of
  // the button's own.
  it('does not treat a lone route as a pop when something pushes over it', () => {
    expect(isPopTransition(state('a'), 'a')).toBe(false);
  });

  it('ignores a missing target or empty state', () => {
    expect(isPopTransition(state('a'), undefined)).toBe(false);
    expect(isPopTransition({ routes: [] }, 'a')).toBe(false);
    expect(isPopTransition(undefined, 'a')).toBe(false);
  });
});
