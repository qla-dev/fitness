import { resolveActivityKind } from '../../../src/services/shared/writebackActivityTypes';

describe('resolveActivityKind', () => {
  it('reads the sport out of a plain activity name', () => {
    expect(resolveActivityKind('Running')).toBe('running');
    expect(resolveActivityKind('Morning run')).toBe('running');
    expect(resolveActivityKind('Evening Walk')).toBe('walking');
    expect(resolveActivityKind('Swimming')).toBe('swimming');
    expect(resolveActivityKind('Yoga')).toBe('yoga');
  });

  it('matches multi-word phrases before single tokens', () => {
    expect(resolveActivityKind('Jump Rope')).toBe('jumpRope');
    expect(resolveActivityKind('High Intensity Interval Training')).toBe(
      'hiit'
    );
    expect(resolveActivityKind('Indoor Cycling')).toBe('cycling');
    expect(resolveActivityKind('Stair Climbing')).toBe('stairClimbing');
  });

  it('files a lifting movement as strength even when its name contains a cardio word', () => {
    // The whole point of STRENGTH_MOVEMENT_TOKENS: a walking lunge is not a walk.
    expect(resolveActivityKind('Walking Lunge', 'strength')).toBe(
      'strengthTraining'
    );
    expect(resolveActivityKind('Seated Cable Row', 'strength')).toBe(
      'strengthTraining'
    );
    expect(resolveActivityKind('Running Man Press')).toBe('strengthTraining');
  });

  it('still recognises a rowing machine session as rowing', () => {
    // 'machine' is not a strength token, so the phrase wins.
    expect(resolveActivityKind('Rowing Machine', 'cardio')).toBe('rowing');
  });

  it('matches tokens whole, so a substring never triggers a sport', () => {
    // 'row' must not fire on 'arrow', 'run' must not fire on 'runner-up'.
    expect(resolveActivityKind('Arrow Throwing')).toBe('other');
  });

  it('falls back to the category when the name says nothing', () => {
    expect(resolveActivityKind('Leg Day', 'strength')).toBe('strengthTraining');
    expect(resolveActivityKind('Session A', 'isometric')).toBe('coreTraining');
    expect(resolveActivityKind('Untitled', 'plyometrics')).toBe('hiit');
  });

  it('treats a cardio category as a real answer of "other", not a miss', () => {
    // The category cannot tell a row from a swim, so it must not be upgraded to
    // the caller's strength fallback.
    expect(resolveActivityKind('Session A', 'cardio', 'strengthTraining')).toBe(
      'other'
    );
  });

  it('uses the caller fallback only when name and category both fail', () => {
    expect(resolveActivityKind('Push Day', null, 'strengthTraining')).toBe(
      'strengthTraining'
    );
    expect(resolveActivityKind('Push Day')).toBe('other');
    expect(resolveActivityKind(null, null, 'strengthTraining')).toBe(
      'strengthTraining'
    );
  });

  it('ignores case, underscores and slashes', () => {
    expect(resolveActivityKind('OUTDOOR_CYCLING')).toBe('cycling');
    expect(resolveActivityKind('run/walk')).toBe('running');
  });
});
