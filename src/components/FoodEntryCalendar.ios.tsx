import { forwardRef } from 'react';
import RingCalendarSheet from './RingCalendarSheet';
import type { CalendarSheetRef } from './CalendarSheet';

/**
 * The date picker behind every entry form's Date field (food, meals,
 * workouts, measurements, doses): the Activities calendar in its plain
 * mode, so picking a date looks the same everywhere. It replaced a SwiftUI
 * graphical DatePicker hosted in the sheet, which drew an empty sheet.
 * Days later this month stay pickable, for logging ahead.
 */
const FoodEntryCalendar = forwardRef<
  CalendarSheetRef,
  {
    selectedDate: string;
    onSelectDate: (date: string) => void;
  }
>(({ selectedDate, onSelectDate }, ref) => (
  <RingCalendarSheet
    ref={ref}
    rings={false}
    allowFuture
    selectedDate={selectedDate}
    onSelectDate={onSelectDate}
  />
));
FoodEntryCalendar.displayName = 'FoodEntryCalendar';
export default FoodEntryCalendar;
