import { bmi, bmiCategory } from '../../src/utils/bmi';

it('works out BMI from kg and cm, to one decimal', () => {
  expect(bmi(70, 175)).toBe(22.9);
  expect(bmi(70, 0)).toBeNull();
  expect(bmi(Number.NaN, 175)).toBeNull();
});

it('puts a BMI in its WHO band', () => {
  expect(bmiCategory(18.4)).toBe('underweight');
  expect(bmiCategory(18.5)).toBe('healthy');
  expect(bmiCategory(25)).toBe('overweight');
  expect(bmiCategory(30)).toBe('obese');
});
