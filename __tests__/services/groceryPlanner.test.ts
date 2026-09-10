import {
  makeSamplePlan,
  matchingRecipes,
  planIngredients,
  recipeCost,
} from '../../src/services/groceryPlanner';

describe('sample grocery planning', () => {
  it('distinguishes skipped equipment from explicitly having none', () => {
    expect(matchingRecipes({}).some((r) => r.equipment.length)).toBe(true);
    expect(
      matchingRecipes({ appliances: ['none'] }).every(
        (r) => !r.equipment.length
      )
    ).toBe(true);
  });

  it('respects equipment alternatives, allergies, time and diet together', () => {
    const recipes = matchingRecipes({
      appliances: ['airfryer'],
      diet: 'vegan',
      allergies: ['gluten'],
      minutes: '30',
    });
    expect(recipes.map((r) => r.id)).toContain('potato');
    expect(recipes.map((r) => r.id)).not.toContain('lentils');
    expect(
      recipes.every(
        (r) => r.diet === 'vegan' && !r.allergens.includes('gluten')
      )
    ).toBe(true);
  });

  it('does not claim to handle an unrecognised custom allergy', () => {
    expect(matchingRecipes({ otherAllergies: 'celery' })).toEqual([]);
  });

  it('keeps the household plan within the sample weekly budget', () => {
    const plan = makeSamplePlan({
      servings: '2',
      days: '7',
      currency: 'BAM',
      budget: '40',
    });
    expect(plan.meals).toHaveLength(7);
    expect(plan.total).toBeLessThanOrEqual(40);
    expect(makeSamplePlan({ budget: '1' }).meals).toEqual([]);
  });

  it('merges repeated ingredients and scales quantities and costs for everyone', () => {
    const plan = makeSamplePlan({ servings: '3', days: '2', leftovers: 'yes' });
    expect(plan.meals[0]).toBe(plan.meals[1]);
    const items = planIngredients(plan.meals, 3, 'EUR');
    const first = plan.meals[0].ingredients[0];
    expect(items.find((i) => i.name === first.name)?.amount).toBe(
      first.amount * 6
    );
    expect(items.reduce((sum, item) => sum + item.cost, 0)).toBeCloseTo(
      recipeCost(plan.meals[0], 6, 'EUR')
    );
  });

  it('uses defaults for malformed numeric drafts', () => {
    const plan = makeSamplePlan({
      servings: 'invalid',
      days: 'invalid',
      budget: 'invalid',
    });
    expect(plan.servings).toBe(1);
    expect(plan.meals).toHaveLength(7);
    expect(Number.isFinite(plan.total)).toBe(true);
  });
});
