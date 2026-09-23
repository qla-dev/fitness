export interface DailyGoals {
  steps?: number;
  stand_hours?: number;
  /**
   * Hours asleep a night. Hours rather than minutes because that is the unit
   * the goal is thought in and set in; the readings it is compared against are
   * seconds, and convert at the edge.
   */
  sleep_goal_hours?: number;
  /**
   * Target weight in KILOGRAMS, like every other weight the app stores. The
   * editors convert to and from the user's unit, so someone on pounds sets it
   * in pounds and it lands here in kg.
   */
  target_weight?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  trans_fat?: number;
  cholesterol?: number;
  sodium?: number;
  potassium?: number;
  dietary_fiber: number;
  sugars?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  calcium?: number;
  iron?: number;
  water_goal_ml?: number;
  target_exercise_calories_burned?: number;
  target_exercise_duration_minutes?: number;
  protein_percentage?: number;
  carbs_percentage?: number;
  fat_percentage?: number;
  breakfast_percentage?: number;
  lunch_percentage?: number;
  dinner_percentage?: number;
  snacks_percentage?: number;
  custom_nutrients?: Record<string, string | number>;
  custom_meal_percentages?: Record<string, number>;
}
