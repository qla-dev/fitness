import type { SetupAnswers } from './personalSetup';

export interface SampleIngredient { name: string; amount: number; unit: 'g' | 'ml' | 'item'; cost: number }
export interface SampleRecipe { id: string; name: string; minutes: number; equipment: string[][]; allergens: string[]; diet: 'vegan' | 'vegetarian' | 'pescatarian' | 'any'; ingredients: SampleIngredient[]; instructions: string }
// Sample catalogue content, not product UI copy. Costs are illustrative EUR
// amounts per serving, not retailer quotes or current exchange rates.
const ingredient = (name: string, amount: number, unit: SampleIngredient['unit'], cost: number): SampleIngredient => ({ name, amount, unit, cost });
export const SAMPLE_RECIPES: SampleRecipe[] = [
  { id: 'chickpea', name: 'Chickpea & cucumber salad', minutes: 10, equipment: [], allergens: [], diet: 'vegan', ingredients: [ingredient('Canned chickpeas', 150, 'g', .65), ingredient('Cucumber', 100, 'g', .35), ingredient('Tomatoes', 100, 'g', .45), ingredient('Olive oil', 10, 'ml', .15)], instructions: 'Drain and rinse chickpeas. Chop the vegetables and toss with olive oil.' },
  { id: 'beans', name: 'White bean & pepper bowl', minutes: 10, equipment: [], allergens: [], diet: 'vegan', ingredients: [ingredient('Canned white beans', 180, 'g', .8), ingredient('Bell pepper', 100, 'g', .5), ingredient('Tomatoes', 100, 'g', .45), ingredient('Olive oil', 10, 'ml', .15)], instructions: 'Drain and rinse the beans. Dice the vegetables and mix everything together.' },
  { id: 'oats', name: 'Banana & oat bowl', minutes: 5, equipment: [], allergens: ['gluten'], diet: 'vegan', ingredients: [ingredient('Rolled oats', 80, 'g', .25), ingredient('Banana', 1, 'item', .3), ingredient('Oat drink', 200, 'ml', .4)], instructions: 'Combine oats and oat drink, cover and refrigerate overnight. Slice the banana on top before serving.' },
  { id: 'lentils', name: 'One-pot tomato lentils', minutes: 30, equipment: [['stove'], ['multicooker']], allergens: [], diet: 'vegan', ingredients: [ingredient('Red lentils', 100, 'g', .4), ingredient('Canned tomatoes', 200, 'g', .6), ingredient('Carrots', 100, 'g', .2), ingredient('Olive oil', 10, 'ml', .15)], instructions: 'Rinse lentils. Add to a pot with chopped carrots, tomatoes and water to cover. Simmer until tender, stirring and adding water as needed. Use the appropriate lentil programme for a multicooker.' },
  { id: 'potato', name: 'Crispy potatoes & chickpeas', minutes: 30, equipment: [['oven'], ['airfryer']], allergens: [], diet: 'vegan', ingredients: [ingredient('Potatoes', 250, 'g', .4), ingredient('Canned chickpeas', 150, 'g', .65), ingredient('Olive oil', 10, 'ml', .15)], instructions: 'Cut potatoes into small pieces. Toss with drained chickpeas and oil. Roast at 200°C until potatoes are tender, turning halfway; check earlier in an air fryer.' },
  { id: 'eggs', name: 'Spinach & tomato scramble', minutes: 15, equipment: [['stove']], allergens: ['eggs'], diet: 'vegetarian', ingredients: [ingredient('Eggs', 2, 'item', .6), ingredient('Spinach', 100, 'g', .55), ingredient('Tomatoes', 100, 'g', .45), ingredient('Olive oil', 10, 'ml', .15)], instructions: 'Soften the vegetables in a pan with oil. Add beaten eggs and stir until set.' },
  { id: 'tuna', name: 'Tuna & white bean salad', minutes: 10, equipment: [], allergens: ['fish'], diet: 'pescatarian', ingredients: [ingredient('Canned tuna', 100, 'g', 1.2), ingredient('Canned white beans', 150, 'g', .65), ingredient('Cucumber', 100, 'g', .35)], instructions: 'Drain tuna and beans. Chop cucumber and combine.' },
  { id: 'yogurt', name: 'Yogurt, oats & berries', minutes: 5, equipment: [], allergens: ['milk', 'gluten'], diet: 'vegetarian', ingredients: [ingredient('Plain yogurt', 200, 'g', .7), ingredient('Rolled oats', 70, 'g', .25), ingredient('Berries', 100, 'g', .9)], instructions: 'Spoon yogurt over oats and top with washed berries.' },
  { id: 'microwave', name: 'Microwave potato & beans', minutes: 15, equipment: [['microwave']], allergens: [], diet: 'vegan', ingredients: [ingredient('Potatoes', 250, 'g', .4), ingredient('Canned white beans', 180, 'g', .8), ingredient('Tomatoes', 100, 'g', .45)], instructions: 'Prick and microwave the potato until tender. Heat drained beans separately in a microwave-safe bowl, then serve with chopped tomatoes.' },
  { id: 'smoothie', name: 'Banana oat smoothie bowl', minutes: 5, equipment: [['blender']], allergens: ['gluten'], diet: 'vegan', ingredients: [ingredient('Banana', 1, 'item', .3), ingredient('Rolled oats', 80, 'g', .25), ingredient('Oat drink', 200, 'ml', .4)], instructions: 'Blend the ingredients until smooth. Add a little water if needed.' },
];
const number = (a: SetupAnswers, key: string, fallback: number) => Number(String(a[key] || fallback).replace(',', '.'));
export const samplePriceFactor = (currency: string) => ({ BAM: 2, EUR: 1, USD: 1.1, GBP: .9 }[currency] ?? 1);
export function recipeCost(recipe: SampleRecipe, servings: number, currency: string) {
  return recipe.ingredients.reduce((sum, i) => sum + i.cost, 0) * servings * samplePriceFactor(currency);
}
export function matchingRecipes(answers: SetupAnswers): SampleRecipe[] {
  const appliances = Array.isArray(answers.appliances) ? answers.appliances : [];
  const allergies = Array.isArray(answers.allergies) ? answers.allergies : [];
  // Custom allergens cannot be reliably mapped from free text by a dummy
  // catalogue: do not claim that these recipes have been checked against them.
  if (typeof answers.otherAllergies === 'string' && answers.otherAllergies.trim()) return [];
  const dislikes = String(answers.dislikes || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return SAMPLE_RECIPES.filter(recipe => {
    if (recipe.minutes > number(answers, 'minutes', 120)) return false;
    if (allergies.some(a => recipe.allergens.includes(a))) return false;
    if (dislikes.some(word => recipe.ingredients.some(i => i.name.toLowerCase().includes(word)))) return false;
    if (answers.diet === 'vegan' && recipe.diet !== 'vegan') return false;
    if (answers.diet === 'vegetarian' && !['vegan', 'vegetarian'].includes(recipe.diet)) return false;
    if (answers.diet === 'pescatarian' && recipe.diet === 'any') return false;
    return !appliances.length || !recipe.equipment.length || recipe.equipment.some(option => option.every(item => appliances.includes(item)));
  });
}
export function makeSamplePlan(answers: SetupAnswers, offset = 0) {
  const servings = Math.max(1, Math.min(12, number(answers, 'servings', 1)));
  const days = Math.max(1, Math.min(7, number(answers, 'days', 7)));
  const currency = String(answers.currency || 'EUR');
  const budget = number(answers, 'budget', Infinity);
  const eligible = matchingRecipes(answers).filter(recipe => recipeCost(recipe, servings, currency) * days <= budget);
  const meals = eligible.length ? Array.from({ length: days }, (_, i) => eligible[(Math.floor(i / (answers.leftovers === 'yes' ? 2 : 1)) + offset) % eligible.length]) : [];
  return { meals, servings, currency, total: meals.reduce((sum, meal) => sum + recipeCost(meal, servings, currency), 0), eligible };
}
export function planIngredients(meals: SampleRecipe[], servings: number, currency: string) {
  const items = new Map<string, SampleIngredient>();
  for (const meal of meals) for (const ingredient of meal.ingredients) {
    const key = `${ingredient.name}:${ingredient.unit}`;
    const old = items.get(key);
    items.set(key, { ...ingredient, amount: (old?.amount ?? 0) + ingredient.amount * servings, cost: (old?.cost ?? 0) + ingredient.cost * servings * samplePriceFactor(currency) });
  }
  return [...items.values()];
}
