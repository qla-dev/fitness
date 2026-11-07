import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { StackActions } from '@react-navigation/native';
import FoodForm, { type FoodFormData } from '../../components/FoodForm';
import FoodImagePicker from '../../components/FoodImagePicker';
import { usableFoodImages } from '../../utils/foodImages';
import { splitPickerImages, type PickerImage } from '../../utils/pickerImages';
import { setPendingMealIngredientSelection } from '../../services/mealBuilderSelection';
import {
  buildMealPlanFoodAssignment,
  setPendingMealPlanSelection,
} from '../../services/mealPlanSelection';
import { usePreferences } from '../../hooks';
import { useSaveFood } from '../../hooks/useSaveFood';
import { foodItemToFoodInfo, parseOptional } from '../../types/foodInfo';
import { createFoodVariant } from '../../services/api/foodsApi';
import type { FoodFormScreenProps } from '../FoodFormScreen';
import type {
  EquivalentUnit,
  FoodUnitSelectionResult,
} from '../../types/foodUnitVariants';
import { buildMealIngredientDraftFromSavedFood } from '../../utils/mealBuilderDraft';
import { parseDecimalInput } from '../../utils/numericInput';
import { useNativeIOSHeadersActive } from '../../services/nativeTabBarPreference';
import {
  useNativeHeaderOffset,
  useScreenHeader,
} from '../../hooks/useScreenHeader';
import { BarcodeField, BARCODE_REGEX } from './BarcodeField';
import {
  buildVariantFromFormData,
  buildVariantFromInitialValues,
  confirmDiscardEquivalents,
  equivalentsDiffer,
  isBlankEquivalent,
} from './persistence';

type CreateFoodParams = Extract<
  FoodFormScreenProps['route']['params'],
  { mode: 'create-food' }
>;

const CREATE_FORM_SOURCE_VARIANT_ID = '__create-form-source-variant__';

export function CreateFoodMode({
  params,
  navigation,
  routeKey,
}: {
  params: CreateFoodParams;
  navigation: FoodFormScreenProps['navigation'];
  routeKey: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const textSecondary = useCSSVariable('--color-text-secondary') as string;
  const pickerMode = params.pickerMode ?? 'log-entry';
  const returnDepth = params.returnDepth ?? 1;
  const isMealBuilderMode = pickerMode === 'meal-builder';
  const isMealPlanMode = pickerMode === 'meal-plan';
  const isSelectionMode = isMealBuilderMode || isMealPlanMode;
  const isLibraryMode = pickerMode === 'library';
  const showBarcodeField = !isMealBuilderMode;
  const initialFood = params.initialFood;
  const hasImportedInitialFood = !!initialFood;
  const showAutoScaleNutrition = isSelectionMode || hasImportedInitialFood;
  const { preferences } = usePreferences({ enabled: showAutoScaleNutrition });
  const initialAutoScaleNutritionEnabled =
    preferences?.auto_scale_online_imports ?? false;

  const providerType = params.providerType;
  const [barcodeInput, setBarcodeInput] = useState(params.barcode ?? '');
  const { pendingScannedBarcode, scannedBarcodeNonce } = params;

  useEffect(() => {
    if (scannedBarcodeNonce == null || pendingScannedBarcode == null) return;
    // Consume a one-shot navigation param: guarded by the nonce and paired with
    // clearing the param via setParams, so it can't move to a render-time derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBarcodeInput(pendingScannedBarcode);
    navigation.setParams({
      pendingScannedBarcode: undefined,
      scannedBarcodeNonce: undefined,
    });
  }, [scannedBarcodeNonce, pendingScannedBarcode, navigation]);
  const importedSourceVariant = useMemo(
    () =>
      buildVariantFromInitialValues(initialFood, CREATE_FORM_SOURCE_VARIANT_ID),
    [initialFood]
  );
  const [pendingUnitSelection, setPendingUnitSelection] =
    useState<FoodUnitSelectionResult | null>(() =>
      importedSourceVariant
        ? {
            kind: 'existing',
            variant: importedSourceVariant,
          }
        : null
    );

  const [equivalentDraft, setEquivalentDraft] = useState<EquivalentUnit[]>([]);
  // Baseline is always empty for a new food — use a stable ref so it doesn't
  // need to be listed as a useEffect dependency.
  const equivalentBaselineRef = useRef<EquivalentUnit[]>([]);
  const isSavingRef = useRef(false);
  // FoodForm assigns its submit handler here; the native header Save invokes it
  // (the body submit button is hidden on the native path).
  const submitRequestRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (isSavingRef.current) return;
      if (!equivalentsDiffer(equivalentDraft, equivalentBaselineRef.current))
        return;
      e.preventDefault();
      void confirmDiscardEquivalents().then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, equivalentDraft]);

  const handleImportedUnitSelectionChange = useCallback(
    async (
      selection: FoodUnitSelectionResult
    ): Promise<FoodUnitSelectionResult> => {
      setPendingUnitSelection(selection);
      return selection;
    },
    []
  );

  const [customNutrientValues, setCustomNutrientValues] = useState<
    Record<string, number>
  >({});

  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const imageArgs =
    pickerImages.length > 0 ? splitPickerImages(pickerImages) : undefined;

  const { saveFoodAsync, isPending: isSavePending } = useSaveFood();

  // Only already-saved photos can be embedded in a note: a staged file exists
  // solely on the device until the food is saved, so it has no path to link to.
  const savedNoteImages = useMemo(
    () =>
      usableFoodImages(
        pickerImages
          .filter((image) => image.kind === 'saved')
          .map((image) => image.path)
      ),
    [pickerImages]
  );
  const isSubmitting = isSavePending;

  const handleSubmit = async (data: FoodFormData) => {
    if (!data.name.trim()) {
      Toast.show({
        type: 'error',
        text1: t('createFood.errors.missingName', {
          defaultValue: 'Missing name',
        }),
        text2: t('createFood.errors.nameRequired', {
          defaultValue: 'Please enter a food name.',
        }),
      });
      return;
    }
    if (!parseDecimalInput(data.servingSize)) {
      Toast.show({
        type: 'error',
        text1: t('createFood.errors.invalidServingSize', {
          defaultValue: 'Invalid serving size',
        }),
        text2: t('createFood.errors.servingSizeRequired', {
          defaultValue: 'Serving size must be greater than zero.',
        }),
      });
      return;
    }
    const trimmedBarcode = barcodeInput.trim();
    if (
      showBarcodeField &&
      trimmedBarcode !== '' &&
      !BARCODE_REGEX.test(trimmedBarcode)
    ) {
      Toast.show({
        type: 'error',
        text1: t('createFood.errors.invalidBarcode', {
          defaultValue: 'Invalid barcode',
        }),
        text2: t('createFood.errors.barcodeRequired', {
          defaultValue: 'Barcode must be 8-14 digits.',
        }),
      });
      return;
    }
    const resolvedBarcode = showBarcodeField
      ? trimmedBarcode || null
      : (params.barcode ?? null);
    const saveFoodPayload = {
      name: data.name,
      brand: data.brand || null,
      notes: (data.notes ?? '').trim() || null,
      serving_size: parseDecimalInput(data.servingSize) || 0,
      serving_unit: data.servingUnit || 'serving',
      calories: parseDecimalInput(data.calories) || 0,
      protein: parseDecimalInput(data.protein) || 0,
      carbs: parseDecimalInput(data.carbs) || 0,
      fat: parseDecimalInput(data.fat) || 0,
      dietary_fiber: parseOptional(data.fiber),
      saturated_fat: parseOptional(data.saturatedFat),
      sodium: parseOptional(data.sodium),
      sugars: parseOptional(data.sugars),
      trans_fat: parseOptional(data.transFat),
      potassium: parseOptional(data.potassium),
      calcium: parseOptional(data.calcium),
      iron: parseOptional(data.iron),
      cholesterol: parseOptional(data.cholesterol),
      vitamin_a: parseOptional(data.vitaminA),
      vitamin_c: parseOptional(data.vitaminC),
      is_custom: true,
      is_quick_food: false,
      is_default: true,
      barcode: resolvedBarcode,
      provider_type: providerType ?? null,
      custom_nutrients:
        Object.keys(customNutrientValues).length > 0
          ? customNutrientValues
          : undefined,
    };

    const cleanEquivalents = equivalentDraft.filter(
      (eq) => !isBlankEquivalent(eq)
    );

    // Schedules equivalent-variant creation after the food is saved. Fires
    // and forgets — navigation has already occurred. Any failures are shown
    // via toast; missing equivalents can be added later via the food detail
    // edit screen (same recovery path as EditFoodMode).
    const saveEquivalentsAsync = (foodId: string) => {
      if (cleanEquivalents.length === 0) return;
      const groupNutrition = buildVariantFromFormData(data);
      void Promise.all(
        cleanEquivalents.map((eq) =>
          createFoodVariant({
            food_id: foodId,
            serving_size: eq.serving_size,
            serving_unit: eq.serving_unit,
            calories: groupNutrition.calories,
            protein: groupNutrition.protein,
            carbs: groupNutrition.carbs,
            fat: groupNutrition.fat,
            dietary_fiber: groupNutrition.dietary_fiber,
            saturated_fat: groupNutrition.saturated_fat,
            sodium: groupNutrition.sodium,
            sugars: groupNutrition.sugars,
            trans_fat: groupNutrition.trans_fat,
            potassium: groupNutrition.potassium,
            calcium: groupNutrition.calcium,
            iron: groupNutrition.iron,
            cholesterol: groupNutrition.cholesterol,
            vitamin_a: groupNutrition.vitamin_a,
            vitamin_c: groupNutrition.vitamin_c,
          })
        )
      ).catch(() => {
        Toast.show({
          type: 'error',
          text1: t('createFood.errors.equivalentsSaveFailed', {
            defaultValue: 'Some equivalent units could not be saved',
          }),
        });
      });
    };

    if (isSelectionMode) {
      if (isMealPlanMode && !params.mealPlanTarget) {
        Toast.show({
          type: 'error',
          text1: t('createFood.errors.foodSaveFailed', {
            defaultValue: 'Failed to save food',
          }),
          text2: t('common.tryAgain', { defaultValue: 'Please try again.' }),
        });
        return;
      }
      try {
        const savedFood = await saveFoodAsync(saveFoodPayload, imageArgs);
        isSavingRef.current = true;
        saveEquivalentsAsync(savedFood.id);
        const ingredient = buildMealIngredientDraftFromSavedFood(
          savedFood,
          parseDecimalInput(data.servingSize) || 0,
          data.servingUnit || 'serving'
        );
        if (isMealPlanMode && params.mealPlanTarget) {
          setPendingMealPlanSelection({
            ...(params.mealPlanTarget.assignmentIndex === undefined
              ? {}
              : { assignmentIndex: params.mealPlanTarget.assignmentIndex }),
            assignment: buildMealPlanFoodAssignment(
              ingredient,
              params.mealPlanTarget,
              data.servingSize
            ),
          });
        } else {
          setPendingMealIngredientSelection({ ingredient });
        }
        navigation.dispatch(StackActions.pop(returnDepth));
      } catch {
        // Error toast is handled in the save hook.
      }
      return;
    }

    if (isLibraryMode) {
      try {
        const savedFood = await saveFoodAsync(saveFoodPayload, imageArgs);
        isSavingRef.current = true;
        saveEquivalentsAsync(savedFood.id);
        Toast.show({
          type: 'success',
          text1: t('createFood.success.foodSaved', {
            defaultValue: 'Food saved',
          }),
        });
        navigation.dispatch(StackActions.pop(returnDepth));
      } catch {
        // Error toast is handled in the save hook.
      }
      return;
    }

    // Logging: save the food, then hand it to the regular entry screen, which
    // already owns date, time, meal and amount. This screen used to carry its
    // own cut-down copy of those controls.
    try {
      const savedFood = await saveFoodAsync(saveFoodPayload, imageArgs);
      isSavingRef.current = true;
      saveEquivalentsAsync(savedFood.id);
      navigation.dispatch(
        StackActions.replace('FoodEntryAdd', {
          item: foodItemToFoodInfo(savedFood),
          ...(params.date ? { date: params.date } : {}),
        })
      );
    } catch {
      // Error toast is handled in the save hook.
    }
  };

  // Library mode saves a food record (a form Save); the diary/meal-builder
  // modes commit the food to the diary, so keep the "Add Food" verb there.
  const primaryLabel = isLibraryMode
    ? t('common.save', { defaultValue: 'Save' })
    : t('createFood.actions.addFood', { defaultValue: 'Add Food' });

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('createFood.title', { defaultValue: 'New Food' }),
    left: {
      kind: 'dismiss',
      onPress: () => navigation.goBack(),
      disabled: isSubmitting,
      identifier: 'food-create-cancel',
    },
    right: {
      kind: 'primary',
      label: primaryLabel,
      busyLabel: t('common.saving', { defaultValue: 'Saving…' }),
      busy: isSubmitting,
      disabled: isSubmitting,
      placement: 'native-only',
      onPress: () => submitRequestRef.current?.(),
      identifier: 'food-create-save',
    },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}
    >
      {header}

      <FoodForm
        onSubmit={(data) => {
          void handleSubmit(data);
        }}
        submitRequestRef={submitRequestRef}
        isSubmitting={isSubmitting}
        initialValues={initialFood}
        showNotes
        noteImages={savedNoteImages}
        submitLabel={primaryLabel}
        hideSubmitButton={usesNativeHeader}
        contentTopInset={usesNativeHeader ? headerOffset : 0}
        headerChildren={
          <View className="mb-4">
            <FoodImagePicker
              items={pickerImages}
              onItemsChange={setPickerImages}
              disabled={isSubmitting}
            />
          </View>
        }
        showAutoScaleNutrition={showAutoScaleNutrition}
        initialAutoScaleNutritionEnabled={initialAutoScaleNutritionEnabled}
        unitSelector={
          importedSourceVariant
            ? {
                variants: [importedSourceVariant],
                selectedSelection: pendingUnitSelection,
                onUnitSelectionChange: handleImportedUnitSelectionChange,
              }
            : undefined
        }
        equivalents={{ items: equivalentDraft, onChange: setEquivalentDraft }}
        onCustomNutrientsChange={setCustomNutrientValues}
      >
        {showBarcodeField ? (
          <BarcodeField
            value={barcodeInput}
            onChange={setBarcodeInput}
            onScan={() =>
              navigation.navigate('FoodScan', {
                mode: 'capture-barcode',
                returnKey: routeKey,
              })
            }
            textSecondary={textSecondary}
          />
        ) : null}
      </FoodForm>
    </View>
  );
}
