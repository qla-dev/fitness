import { forwardRef, useImperativeHandle, useState } from 'react';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import type { CalendarSheetRef } from './CalendarSheet';
import { toLocalDateString } from '../utils/dateUtils';

const FoodEntryCalendar = forwardRef<
  CalendarSheetRef,
  { selectedDate: string; onSelectDate: (date: string) => void }
>(({ selectedDate, onSelectDate }, ref) => {
  const [visible, setVisible] = useState(false);
  useImperativeHandle(ref, () => ({
    present: () => setVisible(true),
    dismiss: () => setVisible(false),
  }));
  const [year, month, day] = selectedDate.split('-').map(Number);
  return visible ? (
    <DateTimePicker
      value={new Date(year, month - 1, day, 12)}
      mode="date"
      presentation="dialog"
      onDismiss={() => setVisible(false)}
      onValueChange={(_event, date) => {
        onSelectDate(toLocalDateString(date));
        setVisible(false);
      }}
    />
  ) : null;
});
FoodEntryCalendar.displayName = 'FoodEntryCalendar';
export default FoodEntryCalendar;
