import { forwardRef, useImperativeHandle, useRef } from 'react';
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment } from '@expo/ui/swift-ui/modifiers';
import { useTranslation } from 'react-i18next';
import CalendarModal, { type CalendarModalRef } from './CalendarModal';
import type { CalendarSheetRef } from './CalendarSheet';
import { toLocalDateString } from '../utils/dateUtils';
import { useAppLocale } from '../localization';

const FoodEntryCalendar = forwardRef<
  CalendarSheetRef,
  {
    selectedDate: string;
    onSelectDate: (date: string) => void;
  }
>(({ selectedDate, onSelectDate }, ref) => {
  const sheet = useRef<CalendarModalRef>(null);
  const { t } = useTranslation();
  const locale = useAppLocale();
  useImperativeHandle(ref, () => ({
    present: () => sheet.current?.present(),
    dismiss: () => sheet.current?.dismiss(),
  }));
  const [year, month, day] = selectedDate.split('-').map(Number);
  return (
    <CalendarModal
      ref={sheet}
      title={t('common.date', { defaultValue: 'Date' })}
    >
      <Host style={{ height: 360, width: '100%' }}>
        <DatePicker
          selection={new Date(year, month - 1, day, 12)}
          displayedComponents={['date']}
          modifiers={[
            datePickerStyle('graphical'),
            environment('locale', locale),
          ]}
          onDateChange={(date) => {
            onSelectDate(toLocalDateString(date));
            sheet.current?.dismiss();
          }}
        />
      </Host>
    </CalendarModal>
  );
});
FoodEntryCalendar.displayName = 'FoodEntryCalendar';
export default FoodEntryCalendar;
