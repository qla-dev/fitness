import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import HydrationGauge from './HydrationGauge';
import { useDailySummary } from '../hooks/useDailySummary';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { useSheetBackdrop, sheetContainer } from './ui/sheetChrome';

export default function HydrationSheet({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const backdrop = useSheetBackdrop();
  const [surface, muted] = useCSSVariable([
    '--color-surface',
    '--color-text-muted',
  ]) as [string, string];
  const { summary, isLoading, isError } = useDailySummary({ date });
  const water = useWaterIntakeMutation({ date });
  useEffect(() => {
    sheet.current?.present();
  }, []);
  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      backdropComponent={backdrop}
      containerComponent={sheetContainer}
      backgroundStyle={{ backgroundColor: surface }}
      handleIndicatorStyle={{ backgroundColor: muted }}
      onDismiss={onClose}
    >
      <BottomSheetView className="pb-safe-or-5">
        <View className="px-4 py-4 border-b border-border-subtle">
          <Text className="text-lg font-semibold text-center text-text-primary">
            {t('addSheet.hydration', { defaultValue: 'Hydration' })}
          </Text>
        </View>
        <View className="p-4">
          {isLoading ? (
            <ActivityIndicator />
          ) : isError || !summary ? (
            <Text className="text-text-secondary text-center">
              {t('addSheet.hydrationLoadFailed', {
                defaultValue: 'Could not load hydration. Please try again.',
              })}
            </Text>
          ) : (
            <HydrationGauge
              consumed={summary.waterConsumed}
              goal={summary.waterGoal}
              unit={water.unit || 'ml'}
              containerVolume={water.servingVolume}
              onIncrement={
                water.isContainersLoaded ? water.increment : undefined
              }
              onDecrement={
                water.isContainersLoaded ? water.decrement : undefined
              }
              disableDecrement={summary.waterConsumed <= 0}
              containers={water.containers}
              activeContainerId={water.activeContainer?.id}
              onSelectContainer={water.selectContainer}
            />
          )}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
