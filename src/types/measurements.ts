export interface CheckInMeasurement {
  entry_date: string;
  weight?: number | null;
  neck?: number | null;
  waist?: number | null;
  hips?: number | null;
  steps?: number | null;
  /** Walking + running distance for the day, in metres as both providers report it. */
  distance_m?: number | null;
  /** Hours of the day that contained standing, as the Stand ring counts them. */
  stand_hours?: number | null;
  height?: number | null;
  body_fat_percentage?: number | null;
  muscle_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  body_water_percentage?: number | null;
  bmr?: number | null;
}

export interface CheckInMeasurementRange {
  /** Provider hourly steps for the same source as this day's count, when available. */
  hourly_steps?: number[];
  id: string;
  user_id: string;
  entry_date: string;
  weight?: number | null;
  neck?: number | null;
  waist?: number | null;
  hips?: number | null;
  steps?: number | null;
  /** Walking + running distance for the day, in metres as both providers report it. */
  distance_m?: number | null;
  /** Hours of the day that contained standing, as the Stand ring counts them. */
  stand_hours?: number | null;
  height?: number | null;
  body_fat_percentage?: number | null;
  muscle_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  body_water_percentage?: number | null;
  bmr?: number | null;
  updated_at: string;
}

export interface WaterIntake {
  water_ml: number;
  /** Manually-logged subtotal; servers predating per-record water sync omit it. */
  manual_ml?: number;
}

export interface WaterContainer {
  id: number;
  name: string;
  volume: number;
  unit: string;
  is_primary: boolean;
  servings_per_container: number;
}

export interface WaterIntakeResponse {
  id: string;
  water_ml: number;
  entry_date: string;
}
