/** WHO adult BMI bands. */
export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese';

/**
 * Body mass index from a weight in kg and a height in cm, to one decimal,
 * or null when either is missing or out of any real range.
 */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm >= 50)) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'healthy';
  if (value < 30) return 'overweight';
  return 'obese';
}
