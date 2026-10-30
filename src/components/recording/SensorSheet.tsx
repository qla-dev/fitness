import { useTranslation } from 'react-i18next';
import SensorPanel from './SensorPanel';
import PromptSheet from '../ui/PromptSheet';

/**
 * Bluetooth pairing, as a sheet over the setup screen.
 *
 * Pairing is something you do before a session, not during one: a strap goes
 * on with the kit, and mid-run the recorder should be a readout rather than a
 * settings page. It lives here for the same reason the wheel size does.
 *
 * GoalEdit's sheet (PromptSheet) in its list layout.
 */
export default function SensorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PromptSheet
      open={open}
      onClose={onClose}
      headerTitle=""
      title={t('recording.sensors', { defaultValue: 'Bluetooth sensors' })}
      topAligned
    >
      <SensorPanel />
    </PromptSheet>
  );
}
