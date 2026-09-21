import { isLocalDataMode } from '../services/dataMode';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';

import Icon, { type IconName } from './Icon';
import AppWordmark from './AppWordmark';
import CustomModal, { type CustomModalRef } from './CustomModal';
import Button from './ui/Button';

export interface AddSheetRef {
  present: (options?: { initialMenu?: 'exercise' }) => void;
  dismiss: () => void;
}

export const addSheetRef = React.createRef<AddSheetRef>();

interface AddSheetProps {
  onAddFood: () => void;
  onStartWorkout: () => void;
  onAddActivity: () => void;
  onLogWorkout: () => void;
  onSyncHealthData: () => void;
  onBarcodeScan: () => void;
  onAiMealScan: () => void;
  onGroceryList: () => void;
  onAddProgressPhotos: () => void;
  onAskSparky: () => void;
  onOpenCycle?: () => void;
  showCycleCard?: boolean;
  cycleLabel?: string;
  cycleIcon?: IconName;
  onDismissWithoutAction?: () => void;
}

interface ActionCard {
  label: string;
  icon: IconName;
  iconSize?: number;
  onPress: () => void;
}

const AddSheet = React.forwardRef<AddSheetRef, AddSheetProps>(
  (
    {
      onAddFood,
      onStartWorkout,
      onAddActivity,
      onLogWorkout,
      onSyncHealthData,
      onBarcodeScan,
      onAiMealScan,
      onGroceryList,
      onAddProgressPhotos,
      onAskSparky,
      onOpenCycle,
      showCycleCard,
      cycleLabel,
      cycleIcon,
      onDismissWithoutAction,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const bottomSheetRef = useRef<CustomModalRef>(null);
    const isDismissingRef = useRef(false);
    const isOpenRef = useRef(false);
    const isPresentingRef = useRef(false);
    const selectedActionRef = useRef(false);
    const pendingPresentRef = useRef(false);
    const pendingInitialMenuRef = useRef<'exercise' | null>(null);
    const presentFrameRef = useRef<number | null>(null);
    const [showExerciseMenu, setShowExerciseMenu] = useState(false);

    const [accentPrimary, raisedBg, textSecondary] = useCSSVariable([
      '--color-accent-primary',
      '--color-raised',
      '--color-text-secondary',
    ]) as [string, string, string];

    const clearScheduledPresent = useCallback(() => {
      if (presentFrameRef.current != null) {
        cancelAnimationFrame(presentFrameRef.current);
        presentFrameRef.current = null;
      }
    }, []);

    const schedulePresent = useCallback(() => {
      clearScheduledPresent();
      isPresentingRef.current = true;
      presentFrameRef.current = requestAnimationFrame(() => {
        presentFrameRef.current = null;
        bottomSheetRef.current?.present();
      });
    }, [clearScheduledPresent]);

    useImperativeHandle(
      ref,
      () => ({
        present: (options) => {
          const initialMenu = options?.initialMenu ?? null;
          if (isDismissingRef.current) {
            pendingPresentRef.current = true;
            pendingInitialMenuRef.current = initialMenu;
            setShowExerciseMenu(initialMenu === 'exercise');
            return;
          }

          if (isOpenRef.current || isPresentingRef.current) {
            return;
          }

          pendingPresentRef.current = false;
          pendingInitialMenuRef.current = null;
          selectedActionRef.current = false;
          setShowExerciseMenu(initialMenu === 'exercise');
          schedulePresent();
        },
        dismiss: () => {
          pendingPresentRef.current = false;
          pendingInitialMenuRef.current = null;
          isPresentingRef.current = false;
          isDismissingRef.current = true;
          clearScheduledPresent();
          bottomSheetRef.current?.dismiss();
        },
      }),
      [clearScheduledPresent, schedulePresent]
    );

    useEffect(() => {
      const sheetRef = bottomSheetRef.current;
      return () => {
        clearScheduledPresent();
        sheetRef?.dismiss();
      };
    }, [clearScheduledPresent]);

    const handleAction = useCallback(
      (action?: () => void) => {
        pendingPresentRef.current = false;
        pendingInitialMenuRef.current = null;
        selectedActionRef.current = true;
        isPresentingRef.current = false;
        isDismissingRef.current = true;
        clearScheduledPresent();
        bottomSheetRef.current?.dismiss();
        action?.();
      },
      [clearScheduledPresent]
    );

    const handleDismiss = useCallback(() => {
      isDismissingRef.current = false;
      isOpenRef.current = false;
      if (pendingPresentRef.current) {
        const initialMenu = pendingInitialMenuRef.current;
        pendingPresentRef.current = false;
        pendingInitialMenuRef.current = null;
        selectedActionRef.current = false;
        setShowExerciseMenu(initialMenu === 'exercise');
        schedulePresent();
      } else {
        if (!selectedActionRef.current) {
          onDismissWithoutAction?.();
        }
        selectedActionRef.current = false;
        isPresentingRef.current = false;
        pendingInitialMenuRef.current = null;
      }
    }, [onDismissWithoutAction, schedulePresent]);

    const handleAnimate = useCallback(
      (fromIndex: number, toIndex: number) => {
        if (fromIndex >= 0 && toIndex === -1) {
          isDismissingRef.current = true;
          isOpenRef.current = false;
          isPresentingRef.current = false;
          return;
        }

        if (toIndex >= 0) {
          isDismissingRef.current = false;
          isOpenRef.current = true;
          isPresentingRef.current = false;
          pendingPresentRef.current = false;
          pendingInitialMenuRef.current = null;
          clearScheduledPresent();
        }
      },
      [clearScheduledPresent]
    );

    // The three ways into a meal, as the tiles across the top of the sheet.
    const cards: ActionCard[] = [
      {
        label: t('addSheet.logFood', { defaultValue: 'Log Food' }),
        icon: 'food',
        onPress: onAddFood,
      },
      {
        label: t('addSheet.scanBarcode', { defaultValue: 'Scan Barcode' }),
        icon: 'scan',
        onPress: onBarcodeScan,
      },
      {
        label: t('addSheet.aiMeal', { defaultValue: 'AI meal' }),
        icon: 'sparkles',
        onPress: onAiMealScan,
      },
    ];

    const renderCard = (card: ActionCard) => (
      <Button
        key={card.label}
        variant="primary"
        className="flex-1 py-5 mx-1.5"
        style={{ backgroundColor: raisedBg }}
        onPress={() => handleAction(card.onPress)}
      >
        <View className="h-9 items-center justify-center">
          <Icon
            name={card.icon}
            size={card.iconSize ?? 32}
            color={accentPrimary}
          />
        </View>
        <Text
          className="text-text-primary text-sm font-medium mt-2 text-center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {card.label}
        </Text>
      </Button>
    );

    const renderSecondaryRow = (
      label: string,
      icon: IconName,
      onPress: () => void
    ) => (
      <Button
        variant="primary"
        className="flex-row items-center justify-center py-3 mx-1.5 mt-3"
        style={{ backgroundColor: raisedBg }}
        onPress={() => handleAction(onPress)}
      >
        <Icon name={icon} size={20} color={accentPrimary} />
        <Text className="text-text-primary text-sm font-medium ml-2">
          {label}
        </Text>
      </Button>
    );

    const renderExerciseOption = (
      label: string,
      subtitle: string,
      icon: IconName,
      onPress: () => void
    ) => (
      <Button
        key={label}
        variant="primary"
        className="flex-1 py-5 mx-1.5"
        style={{ backgroundColor: raisedBg }}
        onPress={() => handleAction(onPress)}
      >
        <View className="h-10 items-center justify-center">
          <Icon name={icon} size={32} color={accentPrimary} />
        </View>
        <Text
          className="text-text-primary text-sm font-medium mt-2 text-center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
        <Text
          className="text-xs mt-1 text-center"
          numberOfLines={2}
          style={{ color: textSecondary, minHeight: 32 }}
        >
          {subtitle}
        </Text>
      </Button>
    );

    const content = (
      <View className="px-2.5">
        {showExerciseMenu ? (
          <>
            <Pressable
              className="flex-row items-center mb-3 px-1.5"
              accessibilityRole="button"
              accessibilityLabel={t('common.back', {
                defaultValue: 'Back',
              })}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut
                );
                setShowExerciseMenu(false);
              }}
            >
              <Icon name="chevron-back" size={20} color={accentPrimary} />
              <Text
                className="text-sm font-medium ml-1"
                style={{ color: accentPrimary }}
              >
                {t('common.back', { defaultValue: 'Back' })}
              </Text>
            </Pressable>
            <View className="flex-row">
              {renderExerciseOption(
                t('addSheet.workout', { defaultValue: 'Workout' }),
                t('addSheet.liveSets', {
                  defaultValue: 'Live sets & reps',
                }),
                'exercise-weights',
                onStartWorkout
              )}
              {renderExerciseOption(
                t('addSheet.activity', { defaultValue: 'Activity' }),
                t('addSheet.durationDistance', {
                  defaultValue: 'Duration & distance',
                }),
                'exercise-running-filled',
                onAddActivity
              )}
              {renderExerciseOption(
                t('addSheet.logWorkout', { defaultValue: 'Log Workout' }),
                t('addSheet.pastSets', {
                  defaultValue: 'Past sets & reps',
                }),
                'pencil',
                onLogWorkout
              )}
            </View>
          </>
        ) : (
          <>
            <View className="flex-row">{cards.map(renderCard)}</View>
            {renderSecondaryRow(
              t('addSheet.groceryList', { defaultValue: 'Grocery list' }),
              'cart',
              onGroceryList
            )}
            {renderSecondaryRow(
              t('addSheet.progressPhotos', { defaultValue: 'Progress Photos' }),
              'camera-filled',
              onAddProgressPhotos
            )}
            {!isLocalDataMode() && showCycleCard && onOpenCycle
              ? renderSecondaryRow(
                  cycleLabel ??
                    t('addSheet.wellness', { defaultValue: 'Wellness' }),
                  cycleIcon ?? 'wellness-filled',
                  onOpenCycle
                )
              : null}
            {!isLocalDataMode() &&
              renderSecondaryRow(
                t('addSheet.askSparky', { defaultValue: 'Ask Sparky' }),
                'sparkles',
                onAskSparky
              )}
            {!isLocalDataMode() &&
              renderSecondaryRow(
                t('addSheet.syncHealth', {
                  defaultValue: 'Sync Health Data',
                }),
                'sync',
                onSyncHealthData
              )}
          </>
        )}
      </View>
    );

    return (
      <>
        <CustomModal
          ref={bottomSheetRef}
          // Only the name is branded: the lead-in stays in the normal UI
          // face, and the wordmark carries its own face and accent.
          title={
            <>
              {t('addSheet.title', { defaultValue: 'Log data into' })}{' '}
              <AppWordmark />
            </>
          }
          onAnimate={handleAnimate}
          onDismiss={handleDismiss}
          onClose={() => {
            pendingPresentRef.current = false;
            pendingInitialMenuRef.current = null;
            isPresentingRef.current = false;
            isDismissingRef.current = true;
            clearScheduledPresent();
            bottomSheetRef.current?.dismiss();
          }}
        >
          {content}
        </CustomModal>
      </>
    );
  }
);

AddSheet.displayName = 'AddSheet';

export default AddSheet;
