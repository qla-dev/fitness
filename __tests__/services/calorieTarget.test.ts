import { ageOn, resolveCalorieTarget } from '../../src/services/calorieTarget';

const body = { weightKg: 80, heightCm: 180, age: 30, gender: 'male' };

it('leaves the goal alone in maintain mode', () => {
  const info = resolveCalorieTarget({
    preferences: { calorie_goal_adjustment_mode: 'fixed' },
    baseGoal: 2000,
  });
  expect(info).toMatchObject({ base: 2000, target: 2000, adjustment: 0 });
  expect(info?.adaptive).toBe(false);
});

it('applies the goal mode to the typed goal', () => {
  const cut = resolveCalorieTarget({
    preferences: { goal_mode: 'cut', calorie_goal_adjustment_mode: 'fixed' },
    baseGoal: 2000,
  });
  expect(cut).toMatchObject({ target: 1700, adjustment: -300, percent: -15 });

  const bulk = resolveCalorieTarget({
    preferences: { goal_mode: 'lean_bulk' },
    baseGoal: 2000,
  });
  expect(bulk).toMatchObject({ target: 2200, adjustment: 200, percent: 10 });

  const custom = resolveCalorieTarget({
    preferences: { goal_mode: 'manual', goal_mode_custom_percentage: -60 },
    baseGoal: 2000,
  });
  // Clamped to the 40 % the shared calculation allows: 1200, which is the
  // clinical minimum itself, so the floor has nothing to hold.
  expect(custom?.percent).toBe(-40);
  expect(custom?.target).toBe(1200);
  expect(custom?.clamped).toBe(false);
});

it('holds a cut at the safety floor unless the floor is disabled', () => {
  const low = { goal_mode: 'high_cut' as const };
  expect(
    resolveCalorieTarget({ preferences: low, baseGoal: 1400, ...body })
    // The standard floor is the higher of resting metabolism (1780) and
    // the clinical minimum (1500).
  ).toMatchObject({ target: 1780, clamped: true, floor: 1780 });
  expect(
    resolveCalorieTarget({
      preferences: { ...low, calorie_safety_floor_mode: 'disabled' },
      baseGoal: 1400,
      ...body,
    })
  ).toMatchObject({ target: 1120, clamped: false, floor: null });
});

it('estimates the adaptive baseline from the body and activity', () => {
  const info = resolveCalorieTarget({
    preferences: {
      calorie_goal_adjustment_mode: 'adaptive',
      activity_level: 'moderate',
      goal_mode: 'cut',
    },
    baseGoal: 2000,
    ...body,
  });
  // Mifflin-St Jeor 1780 × 1.55 = 2759; a 15 % cut is 2345.
  expect(info).toMatchObject({ adaptive: true, learning: true, base: 2759 });
  expect(info?.target).toBe(2345);

  // Without the body data it falls back to the typed goal.
  expect(
    resolveCalorieTarget({
      preferences: { calorie_goal_adjustment_mode: 'adaptive' },
      baseGoal: 2000,
    })
  ).toMatchObject({ adaptive: true, base: 2000, target: 2000 });
});

it('has nothing to say without a goal', () => {
  expect(resolveCalorieTarget({ preferences: {}, baseGoal: 0 })).toBeNull();
});

it('works out age on a day', () => {
  expect(ageOn('1990-06-15', '2026-06-14')).toBe(35);
  expect(ageOn('1990-06-15', '2026-06-15')).toBe(36);
  expect(ageOn(null, '2026-06-15')).toBeNull();
});
