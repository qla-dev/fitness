import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import Button from './ui/Button';
import { useNavigation } from '@react-navigation/native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';
import { DeleteRowAction } from './SwipeableDeleteRow';
import { useRowCollapse } from '../hooks/useRowCollapse';
import { useDeleteFoodEntry } from '../hooks/useDeleteFoodEntry';
import { useDeleteFoodEntryMeal } from '../hooks/useDeleteFoodEntryMeal';
import { usePreferences } from '../hooks/usePreferences';
import type { FoodEntry } from '../types/foodEntries';
import type { EntryNutrition } from '../utils/mealNutrition';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import FoodThumbnail from './FoodThumbnail';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { diaryEntryImage, diaryEntryImages } from '../utils/foodImages';
import { useOpenLightbox } from './LightboxProvider';
import { fireSelectionHaptic } from '../services/haptics';
import { useCSSVariable } from 'uniwind';

interface SwipeableFoodRowProps {
  entry: FoodEntry;
  nutrition: EntryNutrition;
  onAdjustServing?: (entry: FoodEntry) => void;
  compact?: boolean;
  showDivider?: boolean;
}

const SwipeableFoodRow: React.FC<SwipeableFoodRowProps> = ({
  entry,
  nutrition,
  onAdjustServing,
  compact = false,
  showDivider = false,
}) => {
  const { t } = useTranslation();
  const [menuMuted, menuSeparator] = useCSSVariable([
    '--color-menu-muted',
    '--color-menu-separator',
  ]) as [string, string];
  const { preferences } = usePreferences();
  const navigation = useNavigation();
  const swipeableRef = useRef<any>(null);
  const invalidateCacheRef = useRef<() => void>(() => {});
  const { collapse, handleLayout, animatedStyle } = useRowCollapse(() =>
    invalidateCacheRef.current()
  );

  const isMealComponent = !!entry.food_entry_meal_id;
  const getImageSource = useFoodImageSourceContext();
  const entryImage = diaryEntryImage(entry);
  const openLightbox = useOpenLightbox();

  const onDeleteSuccess = () => {
    swipeableRef.current?.close();
    collapse();
  };

  const foodEntryDelete = useDeleteFoodEntry({
    entryId: entry.id,
    entryDate: entry.entry_date,
    onSuccess: onDeleteSuccess,
  });

  const mealDelete = useDeleteFoodEntryMeal({
    mealId: entry.food_entry_meal_id ?? '',
    entryDate: entry.entry_date,
    onSuccess: onDeleteSuccess,
  });

  const confirmAndDelete = isMealComponent
    ? mealDelete.confirmAndDelete
    : foodEntryDelete.confirmAndDelete;
  const deleteEntry = isMealComponent
    ? mealDelete.deleteEntry
    : foodEntryDelete.deleteEntry;

  // Keep the latest invalidateCache in a ref so the post-collapse callback
  // (run via runOnJS after the delete) always invokes the current one. Written
  // in an effect rather than during render so the value stays mutable to
  // React's compiler.
  useEffect(() => {
    invalidateCacheRef.current = isMealComponent
      ? mealDelete.invalidateCache
      : foodEntryDelete.invalidateCache;
  }, [
    isMealComponent,
    mealDelete.invalidateCache,
    foodEntryDelete.invalidateCache,
  ]);

  const renderRightActions = () => (
    <DeleteRowAction
      onPress={confirmAndDelete}
      className="ml-4"
      accessibilityLabel={t('foodRow.deleteFood', {
        defaultValue: 'Delete food',
      })}
    />
  );

  const canQuickAdjust =
    !isMealComponent && !!onAdjustServing && Number(entry.serving_size) > 0;
  const name =
    entry.food_name ||
    t('foodRow.unknownFood', { defaultValue: 'Unknown food' });
  const timeLabel = formatTimeLabel(entry.entry_time, preferences?.time_format);

  const handlePress = () => {
    if (compact) fireSelectionHaptic();
    if (isMealComponent && entry.food_entry_meal_id) {
      navigation.navigate('EditLoggedMeal', {
        foodEntryMealId: entry.food_entry_meal_id,
      });
      return;
    }
    navigation.navigate('FoodEntryView', { entry });
  };

  const handleLongPress = () => {
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [];
    if (canQuickAdjust) {
      buttons.push({
        text: t('foodRow.adjustServing', { defaultValue: 'Adjust serving' }),
        onPress: () => onAdjustServing!(entry),
      });
    }
    buttons.push({
      text: t('common.delete', { defaultValue: 'Delete' }),
      style: 'destructive',
      onPress: deleteEntry,
    });
    buttons.push({
      text: t('common.cancel', { defaultValue: 'Cancel' }),
      style: 'cancel',
    });
    Alert.alert(name, undefined, buttons);
  };

  return (
    <Animated.View style={animatedStyle} onLayout={handleLayout}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={40}
      >
        <View
          className="py-1.5 flex-row items-center bg-surface"
          style={
            compact
              ? {
                  minHeight: 66,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                  gap: 12,
                }
              : undefined
          }
        >
          {/* Compact menu rows always keep their image or fallback icon slot. */}
          {entryImage || compact ? (
            <FoodThumbnail
              image={entryImage}
              getImageSource={getImageSource}
              size={compact ? 39 : 56}
              menuStyle={compact}
              variant={isMealComponent ? 'meal' : 'food'}
              showFallback={compact}
              style={{ marginRight: compact ? 0 : 8 }}
              onPress={
                entryImage
                  ? () => openLightbox(diaryEntryImages(entry), 0, name)
                  : undefined
              }
            />
          ) : null}
          <TouchableOpacity
            className={compact ? 'flex-1 min-w-0' : 'flex-1 mr-2'}
            activeOpacity={0.7}
            onPress={handlePress}
            onLongPress={handleLongPress}
            accessibilityRole="button"
            accessibilityLabel={name}
          >
            <View
              className={compact ? '' : 'flex-row flex-wrap items-baseline'}
            >
              <Text
                className={
                  compact
                    ? 'text-base font-normal text-text-primary'
                    : 'text-md text-text-primary'
                }
                numberOfLines={1}
                style={
                  compact ? { fontSize: 16, fontWeight: '400' } : undefined
                }
              >
                {name}
              </Text>
              <View
                className="flex-row items-baseline"
                style={compact ? { marginTop: 3 } : undefined}
              >
                <Text
                  className="text-sm text-text-secondary"
                  numberOfLines={1}
                  style={
                    compact
                      ? { fontSize: 11, lineHeight: 15, color: menuMuted }
                      : undefined
                  }
                >
                  {!compact && ' · '}
                  {entry.quantity} {entry.unit}
                </Text>
                {timeLabel && (
                  <Text
                    className="text-xs text-text-link ml-1.5"
                    numberOfLines={1}
                    style={
                      compact
                        ? { fontSize: 11, lineHeight: 15, color: menuMuted }
                        : undefined
                    }
                  >
                    {timeLabel}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ alignSelf: 'center', justifyContent: 'center' }}>
            {canQuickAdjust ? (
              <Button
                variant="ghost"
                onPress={() => onAdjustServing!(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                className="py-0 px-0"
                style={{ paddingVertical: 0, paddingHorizontal: 0 }}
                textClassName="text-sm text-text-secondary font-medium"
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '500', color: menuMuted }}
                >
                  {`${Math.round(nutrition.calories)} ${t('foodRow.caloriesUnit', { defaultValue: 'Cal' })}${compact ? '' : ' ▾'}`}
                </Text>
              </Button>
            ) : (
              <Text
                className="text-sm text-text-secondary font-medium"
                style={compact ? { color: menuMuted } : { marginRight: 8 }}
              >
                {Math.round(nutrition.calories)}{' '}
                {t('foodRow.caloriesUnit', { defaultValue: 'Cal' })}
              </Text>
            )}
          </View>
        </View>
      </ReanimatedSwipeable>
      {showDivider && (
        <View
          className="bg-border-subtle"
          style={{
            height: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
            marginLeft: compact ? 64 : 0,
            ...(compact ? { backgroundColor: menuSeparator } : {}),
          }}
        />
      )}
    </Animated.View>
  );
};

export default SwipeableFoodRow;
