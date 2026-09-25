export interface WorkoutGoalSheetProps {
  open: boolean;
  kind: 'time' | 'distance' | 'calories';
  value: number;
  distanceUnit: 'km' | 'miles';
  onChange: (value: number) => void;
  onClose: () => void;
}
