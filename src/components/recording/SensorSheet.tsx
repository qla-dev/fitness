import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';

import SensorPanel from './SensorPanel';
import { sheetContainer, useSheetBackdrop } from '../ui/sheetChrome';

/**
 * Bluetooth pairing, as a sheet over the setup screen.
 *
 * Pairing is something you do before a session, not during one: a strap goes
 * on with the kit, and mid-run the recorder should be a readout rather than a
 * settings page. It lives here for the same reason the wheel size does.
 */
export default function SensorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const backdrop = useSheetBackdrop();

  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      onDismiss={onClose}
      backdropComponent={backdrop}
      containerComponent={sheetContainer}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-text-primary text-lg font-semibold mb-2">
          {t('recording.sensors', { defaultValue: 'Bluetooth sensors' })}
        </Text>
        <SensorPanel />
        <View style={{ height: 16 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
