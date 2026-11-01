import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import Button from '../components/ui/Button';
import Animated, { LinearTransition } from 'react-native-reanimated';
import FadeView from '../components/FadeView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import Icon from '../components/Icon';
import StepperInput from '../components/StepperInput';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import BottomSheetPicker from '../components/BottomSheetPicker';
import EntryImageOverride from '../components/EntryImageOverride';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import MarkdownNotesField from '../components/MarkdownNotesField';
import { NoteMarkdown } from '../components/NoteMarkdown';
import { toHourMinute } from '@workspace/shared';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import { usableFoodImages } from '../utils/foodImages';
import { normalizeDate, formatDateLabel } from '../utils/dateUtils';
import { getLocalizedMealLabel } from '../constants/meals';
import {
  useMealTypes,
  usePreferences,
  useSetFoodEntryImages,
  useClearFoodEntryImage,
} from '../hooks';
import { useFoodVariants } from '../hooks/useFoodVariants';
import { useDeleteFoodEntry } from '../hooks/useDeleteFoodEntry';
import { useUpdateFoodEntry } from '../hooks/useUpdateFoodEntry';
import { useProfile } from '../hooks/useProfile';
import type { UpdateFoodEntryPayload } from '../services/api/foodEntriesApi';
import type { FoodFormData } from '../components/FoodForm';
import { toFormString, parseOptional } from '../types/foodInfo';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import type { FoodVariantDetail } from '../types/foods';
import type { FoodEntry } from '../types/foodEntries';
import type {
  FoodUnitSelectionResult,
  FoodUnitVariant,
} from '../types/foodUnitVariants';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
import EntryContextCard from '../components/EntryContextCard';
import {
  FoodNutrientBreakdown,
  FoodNutritionHeader,
} from '../components/FoodNutritionSummary';
import { useQuery } from '@tanstack/react-query';
import { goalsQueryKey } from '../hooks/queryKeys';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  buildLocalUnitVariants,
  convertEquivalentVariantQuantity,
  formatServingSizeDisplay,
  buildLocalVariantOptions,
  formatServingUnit,
  formatVariantLabel,
  resolveLocalPickerVariantId,
  unitVariantToDisplayValues,
  nextQuantity,
} from '../utils/foodDetails';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';

type FoodEntryViewScreenProps = RootStackScreenProps<'FoodEntryView'>;

const foodEntryToUnitVariant = (entry: FoodEntry): FoodUnitVariant => ({
  id: entry.variant_id,
  food_id: entry.food_id,
  serving_size: entry.serving_size,
  serving_unit: entry.unit,
  calories: entry.calories,
  protein: entry.protein ?? 0,
  carbs: entry.carbs ?? 0,
  fat: entry.fat ?? 0,
  saturated_fat: entry.saturated_fat,
  polyunsaturated_fat: entry.polyunsaturated_fat,
  monounsaturated_fat: entry.monounsaturated_fat,
  trans_fat: entry.trans_fat,
  cholesterol: entry.cholesterol,
  sodium: entry.sodium,
  potassium: entry.potassium,
  dietary_fiber: entry.dietary_fiber,
  sugars: entry.sugars,
  vitamin_a: entry.vitamin_a,
  vitamin_c: entry.vitamin_c,
  calcium: entry.calcium,
  iron: entry.iron,
  glycemic_index: entry.glycemic_index,
  custom_nutrients: entry.custom_nutrients ?? null,
});

const entryToDisplayValues = (entry: FoodEntry) => ({
  servingSize: entry.serving_size,
  servingUnit: entry.unit,
  calories: entry.calories,
  protein: entry.protein ?? 0,
  carbs: entry.carbs ?? 0,
  fat: entry.fat ?? 0,
  fiber: entry.dietary_fiber,
  saturatedFat: entry.saturated_fat,
  transFat: entry.trans_fat,
  sodium: entry.sodium,
  sugars: entry.sugars,
  potassium: entry.potassium,
  calcium: entry.calcium,
  iron: entry.iron,
  cholesterol: entry.cholesterol,
  vitaminA: entry.vitamin_a,
  vitaminC: entry.vitamin_c,
});

const FoodEntryViewScreen: React.FC<FoodEntryViewScreenProps> = ({
  navigation,
  route,
}) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const [entry, setEntry] = useState(route.params.entry);
  const [createdVariantOverride, setCreatedVariantOverride] =
    useState<FoodUnitVariant | null>(null);

  // Per-entry override photo. Writes land on the entry only — the parent food
  // keeps its own images, which is what an entry without an override falls
  // back to.
  // Both paths sync the locally held entry so the control reflects what was
  // saved without waiting for the diary query to round-trip. The clear path
  // needs it as much as the save path: leaving a stale `images` behind would
  // keep the override UI showing instead of falling back to the food's photos.
  const { setImages: setEntryImages, isPending: isSettingEntryImage } =
    useSetFoodEntryImages(entry.id, entry.entry_date, {
      onSuccess: (updated) => {
        if (updated) setEntry((current) => ({ ...current, ...updated }));
      },
    });
  const { clearImage: clearEntryImage, isPending: isClearingEntryImage } =
    useClearFoodEntryImage(entry.id, entry.entry_date, {
      onSuccess: () => setEntry((current) => ({ ...current, images: [] })),
    });
  const isEntryImagePending = isSettingEntryImage || isClearingEntryImage;
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const { profile } = useProfile();
  const calendarRef = useRef<CalendarSheetRef>(null);
  const timeSheetRef = useRef<TimeSheetRef>(null);

  useEffect(() => {
    if (entry.food_entry_meal_id) {
      navigation.replace('EditLoggedMeal', {
        foodEntryMealId: entry.food_entry_meal_id,
      });
    }
  }, [entry.food_entry_meal_id, navigation]);

  const canEdit = !!(
    entry.user_id &&
    profile?.id === entry.user_id &&
    !entry.food_entry_meal_id
  );

  interface EditState {
    isEditing: boolean;
    selectedDate: string;
    entryTime: string;
    /** Per-occurrence note draft; independent of the food's own note. */
    entryNotes: string;
    selectedMealId: string | undefined;
    selectedVariantId: string | undefined;
    quantityText: string;
    adjustedValues: FoodFormData | null;
    // Custom-nutrient overrides returned from the adjust screen. `undefined`
    // means "not adjusted" (fall back to the variant/entry snapshot).
    adjustedCustomNutrients: Record<string, string | number> | null | undefined;
  }

  const initialDate = normalizeDate(entry.entry_date);
  const initialEntryTime = toHourMinute(entry.entry_time) || '';
  const [editState, setEditState] = useState<EditState>({
    isEditing: false,
    selectedDate: initialDate,
    entryTime: initialEntryTime,
    entryNotes: entry.notes ?? '',
    selectedMealId: entry.meal_type_id,
    selectedVariantId: entry.variant_id,
    quantityText: String(entry.quantity),
    adjustedValues: null,
    adjustedCustomNutrients: undefined,
  });

  const {
    isEditing,
    selectedDate,
    entryTime,
    entryNotes,
    selectedMealId,
    selectedVariantId,
    quantityText,
    adjustedValues,
    adjustedCustomNutrients,
  } = editState;
  const updateEdit = useCallback(
    (patch: Partial<EditState>) =>
      setEditState((prev) => ({ ...prev, ...patch })),
    []
  );

  const { mealTypes, defaultMealTypeId } = useMealTypes();
  const effectiveMealId = selectedMealId ?? defaultMealTypeId;
  const selectedMealType = mealTypes.find((mt) => mt.id === effectiveMealId);
  const mealTypeLabel = (mealType: (typeof mealTypes)[number]) =>
    mealType.user_id == null
      ? getLocalizedMealLabel(
          t,
          mealType.name.toLowerCase() === 'snack'
            ? 'snacks'
            : mealType.name.toLowerCase()
        )
      : mealType.name;

  const entryMealTypeLabel = (() => {
    const resolve = (mealType: (typeof mealTypes)[number] | undefined) =>
      mealType ? mealTypeLabel(mealType) : undefined;
    if (entry.meal_type_id) {
      return (
        resolve(
          mealTypes.find((mealType) => mealType.id === entry.meal_type_id)
        ) ??
        entry.meal_type?.trim() ??
        t('mealTypes.other', { defaultValue: 'Other' })
      );
    }
    const historicalName = entry.meal_type?.trim();
    if (!historicalName) return t('mealTypes.other', { defaultValue: 'Other' });
    return (
      resolve(
        mealTypes.find(
          (mealType) =>
            mealType.name.toLowerCase() === historicalName.toLowerCase()
        )
      ) ?? historicalName
    );
  })();

  const { variants } = useFoodVariants(entry.food_id!, {
    enabled: !!entry.food_id,
  });

  const selectorVariants = useMemo(() => {
    if (!entry.food_id) return [];
    const loadedVariants = buildLocalUnitVariants(variants);
    if (
      createdVariantOverride?.id &&
      !loadedVariants.some(
        (variant) => variant.id === createdVariantOverride.id
      )
    ) {
      return [createdVariantOverride, ...loadedVariants];
    }
    return loadedVariants.length > 0
      ? loadedVariants
      : [foodEntryToUnitVariant(entry)];
  }, [createdVariantOverride, entry, variants]);

  const variantPickerOptions = useMemo(() => {
    const baseOptions = buildLocalVariantOptions(variants);

    if (!createdVariantOverride?.id) {
      return baseOptions;
    }

    if (
      baseOptions.some((variant) => variant.id === createdVariantOverride.id)
    ) {
      return baseOptions;
    }

    return [
      {
        id: createdVariantOverride.id,
        label: formatVariantLabel(
          unitVariantToDisplayValues(createdVariantOverride)
        ),
        ...unitVariantToDisplayValues(createdVariantOverride),
      },
      ...baseOptions,
    ];
  }, [createdVariantOverride, variants]);

  const resolvedLocalPickerVariantId = useMemo(
    () =>
      createdVariantOverride
        ? undefined
        : resolveLocalPickerVariantId(variants, selectedVariantId),
    [createdVariantOverride, selectedVariantId, variants]
  );

  const selectedUnitSelection = useMemo<
    FoodUnitSelectionResult | undefined
  >(() => {
    if (
      createdVariantOverride &&
      createdVariantOverride.id === selectedVariantId
    ) {
      return {
        kind: 'existing',
        variant: createdVariantOverride,
      };
    }

    const selectedVariant = selectorVariants.find(
      (variant) => variant.id === selectedVariantId
    );
    return selectedVariant
      ? { kind: 'existing', variant: selectedVariant }
      : undefined;
  }, [createdVariantOverride, selectedVariantId, selectorVariants]);

  const activeVariant = useMemo(() => {
    if (
      createdVariantOverride &&
      createdVariantOverride.id === selectedVariantId
    ) {
      return unitVariantToDisplayValues(createdVariantOverride);
    }

    if (
      variants &&
      selectedVariantId &&
      selectedVariantId !== entry.variant_id
    ) {
      const variant = variants.find(
        (candidate: FoodVariantDetail) => candidate.id === selectedVariantId
      );
      if (variant) {
        return {
          servingSize: variant.serving_size,
          servingUnit: variant.serving_unit,
          calories: variant.calories,
          protein: variant.protein,
          carbs: variant.carbs,
          fat: variant.fat,
          fiber: variant.dietary_fiber,
          saturatedFat: variant.saturated_fat,
          transFat: variant.trans_fat,
          sodium: variant.sodium,
          sugars: variant.sugars,
          potassium: variant.potassium,
          calcium: variant.calcium,
          iron: variant.iron,
          cholesterol: variant.cholesterol,
          vitaminA: variant.vitamin_a,
          vitaminC: variant.vitamin_c,
        };
      }
    }

    return entryToDisplayValues(entry);
  }, [createdVariantOverride, entry, selectedVariantId, variants]);

  const selectedCustomNutrients = useMemo(() => {
    // Edits from the adjust screen take priority over the stored snapshot.
    if (adjustedCustomNutrients !== undefined) {
      return adjustedCustomNutrients;
    }

    if (
      createdVariantOverride &&
      createdVariantOverride.id === selectedVariantId
    ) {
      return createdVariantOverride.custom_nutrients ?? null;
    }

    if (variants && selectedVariantId) {
      const selectedVariant = variants.find(
        (candidate: FoodVariantDetail) => candidate.id === selectedVariantId
      );
      if (selectedVariant) {
        return selectedVariant.custom_nutrients ?? null;
      }
    }

    if ((selectedVariantId ?? null) === (entry.variant_id ?? null)) {
      return entry.custom_nutrients ?? null;
    }

    return undefined;
  }, [
    adjustedCustomNutrients,
    createdVariantOverride,
    entry,
    selectedVariantId,
    variants,
  ]);

  const displayValues = useMemo(() => {
    if (!adjustedValues) return activeVariant;
    return {
      servingSize:
        parseDecimalInput(adjustedValues.servingSize) ||
        activeVariant.servingSize,
      servingUnit: adjustedValues.servingUnit || activeVariant.servingUnit,
      calories: parseDecimalInput(adjustedValues.calories) || 0,
      protein: parseDecimalInput(adjustedValues.protein) || 0,
      carbs: parseDecimalInput(adjustedValues.carbs) || 0,
      fat: parseDecimalInput(adjustedValues.fat) || 0,
      fiber: parseOptional(adjustedValues.fiber),
      saturatedFat: parseOptional(adjustedValues.saturatedFat),
      sodium: parseOptional(adjustedValues.sodium),
      sugars: parseOptional(adjustedValues.sugars),
      transFat: parseOptional(adjustedValues.transFat),
      potassium: parseOptional(adjustedValues.potassium),
      calcium: parseOptional(adjustedValues.calcium),
      iron: parseOptional(adjustedValues.iron),
      cholesterol: parseOptional(adjustedValues.cholesterol),
      vitaminA: parseOptional(adjustedValues.vitaminA),
      vitaminC: parseOptional(adjustedValues.vitaminC),
    };
  }, [adjustedValues, activeVariant]);

  const quantity = parseDecimalInput(quantityText) || 0;
  const editServings =
    displayValues.servingSize > 0 ? quantity / displayValues.servingSize : 0;
  const servingSizeRef = useRef(displayValues.servingSize);

  const mealPickerOptions = mealTypes.map((mealType) => ({
    label: mealTypeLabel(mealType),
    value: mealType.id,
  }));

  const adjustedFromNav = route.params?.adjustedValues;
  const adjustedUnitSelectionFromNav = route.params?.adjustedUnitSelection;
  const adjustedCustomNutrientsFromNav = route.params?.adjustedCustomNutrients;
  useEffect(() => {
    servingSizeRef.current = displayValues.servingSize;
  }, [displayValues.servingSize]);

  useEffect(() => {
    if (
      !adjustedFromNav &&
      !adjustedUnitSelectionFromNav &&
      adjustedCustomNutrientsFromNav === undefined
    ) {
      return;
    }

    const previousServingSize = servingSizeRef.current;
    const nextServingSize =
      parseDecimalInput(adjustedFromNav?.servingSize ?? '') ||
      adjustedUnitSelectionFromNav?.variant.serving_size ||
      previousServingSize;

    if (adjustedUnitSelectionFromNav) {
      const isKnownVariant = (variants ?? []).some(
        (variant) => variant.id === adjustedUnitSelectionFromNav.variant.id
      );
      // Reacting to a unit selection returned via navigation params; a
      // multi-state effect that can't collapse to a render-time derive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreatedVariantOverride(
        isKnownVariant ? null : adjustedUnitSelectionFromNav.variant
      );
      // For local foods, only update selectedVariantId when the returned selection
      // is an existing saved variant. Draft IDs are never persisted to the database
      // and must not be written into the save payload via handleSave().
      const isLocalFood = !!entry.food_id;
      const isDraft = adjustedUnitSelectionFromNav.kind === 'draft';
      if (
        adjustedUnitSelectionFromNav.variant.id &&
        !(isLocalFood && isDraft)
      ) {
        updateEdit({
          selectedVariantId: adjustedUnitSelectionFromNav.variant.id,
        });
      }
    }

    updateEdit({
      ...(adjustedFromNav ? { adjustedValues: adjustedFromNav } : {}),
      ...(adjustedCustomNutrientsFromNav !== undefined
        ? { adjustedCustomNutrients: adjustedCustomNutrientsFromNav }
        : {}),
      ...(nextServingSize !== previousServingSize
        ? { quantityText: String(nextServingSize) }
        : {}),
    });
    navigation.setParams({
      adjustedValues: undefined,
      adjustedUnitSelection: undefined,
      adjustedCustomNutrients: undefined,
    });
  }, [
    adjustedFromNav,
    adjustedUnitSelectionFromNav,
    adjustedCustomNutrientsFromNav,
    entry.food_id,
    navigation,
    updateEdit,
    variants,
  ]);

  useEffect(() => {
    if (
      !resolvedLocalPickerVariantId ||
      resolvedLocalPickerVariantId === selectedVariantId
    ) {
      return;
    }

    // Keep old saved reference/sibling IDs out of the display picker. The
    // canonical ID is an in-memory edit state until the user explicitly saves.
    const selectedVariant = selectorVariants.find(
      (variant) => variant.id === selectedVariantId
    );
    const resolvedVariant = variantPickerOptions.find(
      (variant) => variant.id === resolvedLocalPickerVariantId
    );
    const convertedQuantity = convertEquivalentVariantQuantity(
      parseDecimalInput(quantityText) || 0,
      selectedVariant?.serving_size,
      resolvedVariant?.servingSize
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateEdit({
      selectedVariantId: resolvedLocalPickerVariantId,
      ...(convertedQuantity !== undefined
        ? { quantityText: formatServingSizeDisplay(convertedQuantity) }
        : {}),
    });
  }, [
    quantityText,
    resolvedLocalPickerVariantId,
    selectedVariantId,
    selectorVariants,
    updateEdit,
    variantPickerOptions,
  ]);

  const handleVariantChange = useCallback(
    (variantId: string) => {
      const variant = variants?.find(
        (candidate: FoodVariantDetail) => candidate.id === variantId
      );
      setCreatedVariantOverride(null);
      updateEdit({
        selectedVariantId: variantId,
        adjustedValues: null,
        adjustedCustomNutrients: undefined,
        ...(variant ? { quantityText: String(variant.serving_size) } : {}),
      });
    },
    [updateEdit, variants]
  );

  const updateQuantityText = (text: string) => {
    if (DECIMAL_INPUT_REGEX.test(text)) {
      updateEdit({ quantityText: text });
    }
  };

  const clampQuantity = () => {
    if (quantity <= 0) {
      const minQuantity = displayValues.servingSize * 0.5 || 1;
      updateEdit({ quantityText: String(minQuantity) });
    }
  };

  const adjustQuantity = (delta: number) => {
    updateEdit({
      quantityText: String(
        nextQuantity(quantity, delta, displayValues.servingSize)
      ),
    });
  };

  const navigateToNutritionForm = () => {
    // Build selectedUnitSelection from displayValues so FoodForm's variant-sync
    // effect uses the entry's actual stored nutrition rather than overwriting
    // initialValues with the DB variant's defaults.
    // Use createdVariantOverride as the metadata base when it exists ??? it holds
    // AI provenance, custom_nutrients, and other draft metadata that
    // selectedUnitSelection?.variant may not have (the memo falls back to the
    // DB variant when createdVariantOverride.id !== selectedVariantId, which is
    // always true for local-food drafts after the P1 guard). Fall back to the
    // selectedUnitSelection variant for non-draft cases.
    const metadataBase =
      createdVariantOverride ?? selectedUnitSelection?.variant ?? {};
    const displayVariant: FoodUnitVariant = {
      ...metadataBase,
      id: selectedVariantId,
      serving_size: displayValues.servingSize,
      serving_unit: displayValues.servingUnit,
      calories: displayValues.calories,
      protein: displayValues.protein,
      carbs: displayValues.carbs,
      fat: displayValues.fat,
      dietary_fiber: displayValues.fiber,
      saturated_fat: displayValues.saturatedFat,
      sodium: displayValues.sodium,
      sugars: displayValues.sugars,
      trans_fat: displayValues.transFat,
      potassium: displayValues.potassium,
      calcium: displayValues.calcium,
      iron: displayValues.iron,
      cholesterol: displayValues.cholesterol,
      vitamin_a: displayValues.vitaminA,
      vitamin_c: displayValues.vitaminC,
    };
    const displayUnitSelection: FoodUnitSelectionResult | undefined =
      selectedUnitSelection
        ? { kind: selectedUnitSelection.kind, variant: displayVariant }
        : undefined;
    navigation.navigate('FoodForm', {
      mode: 'adjust-entry-nutrition',
      returnTo: 'FoodEntryView',
      returnKey: route.key,
      foodId: entry.food_id ?? undefined,
      variantId: selectedVariantId,
      customNutrients: selectedCustomNutrients ?? null,
      availableUnitVariants: selectorVariants,
      selectedUnitSelection: displayUnitSelection,
      initialValues: {
        name: adjustedValues?.name || entry.food_name || '',
        brand: adjustedValues?.brand ?? entry.brand_name ?? '',
        servingSize: String(displayValues.servingSize),
        servingUnit: displayValues.servingUnit,
        calories: String(displayValues.calories),
        protein: String(displayValues.protein),
        carbs: String(displayValues.carbs),
        fat: String(displayValues.fat),
        fiber: toFormString(displayValues.fiber),
        saturatedFat: toFormString(displayValues.saturatedFat),
        sodium: toFormString(displayValues.sodium),
        sugars: toFormString(displayValues.sugars),
        transFat: toFormString(displayValues.transFat),
        potassium: toFormString(displayValues.potassium),
        calcium: toFormString(displayValues.calcium),
        iron: toFormString(displayValues.iron),
        cholesterol: toFormString(displayValues.cholesterol),
        vitaminA: toFormString(displayValues.vitaminA),
        vitaminC: toFormString(displayValues.vitaminC),
      },
    });
  };

  const {
    updateEntry,
    isPending: isUpdatePending,
    invalidateCache: invalidateUpdateCache,
  } = useUpdateFoodEntry({
    entryId: entry.id,
    entryDate: entry.entry_date,
    onSuccess: (updatedEntry) => {
      invalidateUpdateCache(selectedDate);
      const mergedEntry = { ...entry, ...updatedEntry };
      if (
        updatedEntry.meal_type_id &&
        updatedEntry.meal_type_id !== entry.meal_type_id
      ) {
        const mealType = mealTypes.find(
          (candidate) => candidate.id === updatedEntry.meal_type_id
        );
        if (mealType) mergedEntry.meal_type = mealType.name;
      }
      setCreatedVariantOverride(null);
      setEntry(mergedEntry);
      setEditState({
        isEditing: false,
        selectedDate: normalizeDate(mergedEntry.entry_date),
        entryTime: toHourMinute(mergedEntry.entry_time) || '',
        entryNotes: mergedEntry.notes ?? '',
        selectedMealId: mergedEntry.meal_type_id,
        selectedVariantId: mergedEntry.variant_id,
        quantityText: String(mergedEntry.quantity),
        adjustedValues: null,
        adjustedCustomNutrients: undefined,
      });
    },
  });

  const handleSave = () => {
    const payload: UpdateFoodEntryPayload = {};
    if (quantity !== entry.quantity) payload.quantity = quantity;
    if (displayValues.servingUnit !== entry.unit)
      payload.unit = displayValues.servingUnit;
    if ((entryTime || null) !== (toHourMinute(entry.entry_time) || null)) {
      payload.entry_time = entryTime || null;
    }
    // Key presence is the update signal: send `notes` only when it changed, so
    // an unrelated edit can never wipe the note.
    if (entryNotes.trim() !== (entry.notes ?? '').trim()) {
      payload.notes = entryNotes.trim() || null;
    }
    if (selectedVariantId !== entry.variant_id) {
      payload.variant_id = selectedVariantId;
      payload.unit = displayValues.servingUnit;
    }
    if (selectedDate !== initialDate) payload.entry_date = selectedDate;
    if (effectiveMealId && effectiveMealId !== entry.meal_type_id) {
      payload.meal_type_id = effectiveMealId;
    }

    if (adjustedValues) {
      payload.food_name = adjustedValues.name;
      payload.brand_name = adjustedValues.brand;
      payload.serving_size = displayValues.servingSize;
      payload.serving_unit = displayValues.servingUnit;
      payload.calories = displayValues.calories;
      payload.protein = displayValues.protein;
      payload.carbs = displayValues.carbs;
      payload.fat = displayValues.fat;
      payload.saturated_fat = displayValues.saturatedFat;
      payload.sodium = displayValues.sodium;
      payload.dietary_fiber = displayValues.fiber;
      payload.sugars = displayValues.sugars;
      payload.trans_fat = displayValues.transFat;
      payload.potassium = displayValues.potassium;
      payload.calcium = displayValues.calcium;
      payload.iron = displayValues.iron;
      payload.cholesterol = displayValues.cholesterol;
      payload.vitamin_a = displayValues.vitaminA;
      payload.vitamin_c = displayValues.vitaminC;
    }

    // Persist custom-nutrient edits made on the adjust screen.
    if (adjustedCustomNutrients !== undefined) {
      payload.custom_nutrients = adjustedCustomNutrients ?? null;
    }

    if (Object.keys(payload).length === 0) {
      updateEdit({ isEditing: false });
      return;
    }

    updateEntry(payload);
  };

  const {
    confirmAndDelete,
    isPending: isDeletePending,
    invalidateCache: invalidateDeleteCache,
  } = useDeleteFoodEntry({
    entryId: entry.id,
    entryDate: entry.entry_date,
    onSuccess: () => {
      invalidateDeleteCache();
      navigation.goBack();
    },
  });

  const textPrimary = useCSSVariable('--color-text-primary') as string;

  const { preferences } = usePreferences();
  const showNetCarbs = preferences?.show_net_carbs === true;
  // Per-mode gates: each mode reads from a different source (view = entry,
  // edit = displayValues), so each needs its own fiber check.
  const viewUseNetCarbs = showNetCarbs && entry.dietary_fiber != null;
  const editUseNetCarbs = showNetCarbs && displayValues.fiber !== undefined;
  const useNetCarbsInList = isEditing ? editUseNetCarbs : viewUseNetCarbs;

  const servings = entry.serving_size
    ? entry.quantity / entry.serving_size
    : entry.quantity;
  const servingsCount =
    servings % 1 === 0 ? servings : parseFloat(servings.toFixed(2));
  const formattedEntryUnit = formatServingUnit(entry.unit || '');
  const servingsDisplay = `${servingsCount} ${t('foodEntryAdd.labels.serving', {
    defaultValue: 'servings',
    defaultValue_one: 'serving',
    defaultValue_other: 'servings',
    count: servings,
  })} · ${entry.serving_size} ${formattedEntryUnit} ${t(
    'foodEntryAdd.labels.perServing',
    {
      defaultValue: 'per serving',
    }
  )}`;

  // The shared header and breakdown scale per-serving values by this many
  // servings: the entry's own while viewing, the edited amount while editing.
  const shownServings = isEditing
    ? editServings
    : entry.serving_size
      ? entry.quantity / entry.serving_size
      : 1;
  const { data: goals, isLoading: isGoalsLoading } = useQuery({
    queryKey: goalsQueryKey(normalizeDate(entry.entry_date)),
    queryFn: () => fetchDailyGoals(normalizeDate(entry.entry_date)),
    staleTime: 1000 * 60 * 5,
  });
  const carbsForGoal =
    useNetCarbsInList && displayValues.fiber !== undefined
      ? getNetCarbsValue(displayValues.carbs, displayValues.fiber)
      : displayValues.carbs;
  const goalPercent = (
    value: number,
    key: 'calories' | 'protein' | 'carbs' | 'fat' = 'calories'
  ) => {
    const goal = goals?.[key];
    return goal ? Math.round(((value * shownServings) / goal) * 100) : null;
  };
  const startEditing = () => {
    if (canEdit) updateEdit({ isEditing: true });
  };

  // View mode: back + owner-gated Edit. Edit mode: 'Done' (not 'Save') commits
  // the changes — the entry stays on screen, so Done reads as "finish editing".
  const header = useScreenHeader({
    // The log sheet's header: transparent, with the name in the content.
    variant: 'transparent',
    nativeTitle: '',
    borderless: true,
    animateKey: isEditing ? 'edit' : 'view',
    left: { kind: 'back' },
    right: canEdit
      ? isEditing
        ? {
            kind: 'primary',
            label: t('common.done', { defaultValue: 'Done' }),
            disabled: isUpdatePending || quantity <= 0,
            onPress: handleSave,
            accessibilityLabel: t('foodEntryView.saveChanges', {
              defaultValue: 'Save food entry changes',
            }),
            identifier: 'food-entry-view-done',
          }
        : {
            kind: 'text',
            label: t('common.edit', { defaultValue: 'Edit' }),
            role: 'secondary',
            onPress: () => updateEdit({ isEditing: true }),
            accessibilityLabel: t('foodEntryView.editEntry', {
              defaultValue: 'Edit food entry',
            }),
            identifier: 'food-entry-view-edit',
          }
      : null,
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-4 gap-4"
        // The transparent bar reserves no space, so the content starts below
        // it by hand, as on the log sheet.
        contentContainerStyle={{
          paddingTop: usesNativeHeader ? headerOffset : 0,
          paddingBottom: insets.bottom + 16 + activeWorkoutBarPadding,
        }}
      >
        {/* The same header as the log sheet: name, brand, the calorie ring
            and macro bars. While editing it opens the nutrition form. */}
        <Animated.View layout={LinearTransition.duration(300)}>
          <Pressable
            onPress={isEditing ? navigateToNutritionForm : undefined}
            disabled={!isEditing}
            accessibilityRole={isEditing ? 'button' : undefined}
            accessibilityLabel={
              isEditing
                ? t('foodEntryView.nutritionEditHint', {
                    defaultValue: 'Opens nutrition editing',
                  })
                : undefined
            }
          >
            <FoodNutritionHeader
              name={
                (isEditing && adjustedValues?.name) ||
                entry.food_name ||
                t('foodEntryView.unknownFood', {
                  defaultValue: 'Unknown food',
                })
              }
              brand={(isEditing && adjustedValues?.brand) || entry.brand_name}
              values={displayValues}
              servings={shownServings}
              goalPercentages={{
                calories: goalPercent(displayValues.calories),
                protein: goalPercent(displayValues.protein, 'protein'),
                carbs: goalPercent(carbsForGoal, 'carbs'),
                fat: goalPercent(displayValues.fat, 'fat'),
              }}
              goalsLoading={isGoalsLoading}
              showNetCarbs={useNetCarbsInList}
              provider_verified={entry.provider_verified}
            />
            {isEditing && (
              <FadeView>
                <Text className="text-text-secondary text-xs text-center mt-2">
                  {t('foodEntryView.tapToEditNutrition', {
                    defaultValue: 'Tap to edit nutrition',
                  })}
                </Text>
              </FadeView>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(300)}>
          <View className="mt-4">
            <EntryImageOverride
              images={entry.images}
              inheritedImages={entry.food_images}
              onSave={setEntryImages}
              onClear={clearEntryImage}
              isPending={isEntryImagePending}
              canEdit={canEdit}
            />
          </View>
          {isEditing ? (
            <FadeView key="edit-serving">
              <View className="mt-3">
                <View className="flex-row items-center">
                  <StepperInput
                    value={quantityText}
                    onChangeText={updateQuantityText}
                    onBlur={clampQuantity}
                    onIncrement={() => adjustQuantity(1)}
                    onDecrement={() => adjustQuantity(-1)}
                    keyboardType="decimal-pad"
                  />
                  <Text className="text-text-primary text-base font-medium ml-2">
                    {formatServingUnit(displayValues.servingUnit)}
                  </Text>
                </View>
                <View className="flex-row items-center mt-2">
                  <Text className="text-text-secondary text-sm">
                    {formatLocalizedNumber(editServings, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    {t('foodEntryAdd.labels.serving', {
                      defaultValue: 'servings',
                      defaultValue_one: 'serving',
                      defaultValue_other: 'servings',
                      count: editServings,
                    })}
                  </Text>
                  {variantPickerOptions.length > 1 ? (
                    <BottomSheetPicker
                      value={selectedVariantId ?? variantPickerOptions[0]?.id}
                      options={variantPickerOptions.map((variant) => ({
                        label: variant.label,
                        value: variant.id,
                      }))}
                      onSelect={handleVariantChange}
                      title={t('foodEntryView.selectServing', {
                        defaultValue: 'Select Serving',
                      })}
                      renderTrigger={({ onPress }) => (
                        <TouchableOpacity
                          onPress={onPress}
                          activeOpacity={0.7}
                          className="flex-row items-center ml-1"
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            'foodEntryView.servingOptionsLabel',
                            {
                              defaultValue: 'Serving options: {{serving}}',
                              serving: `${displayValues.servingSize} ${formatServingUnit(displayValues.servingUnit)} ${t('foodEntryAdd.labels.perServing', { defaultValue: 'per serving' })}`,
                            }
                          )}
                        >
                          <Text className="text-text-secondary text-sm">
                            {' - '}
                            {displayValues.servingSize}{' '}
                            {formatServingUnit(displayValues.servingUnit)}{' '}
                            {t('foodEntryAdd.labels.perServing', {
                              defaultValue: 'per serving',
                            })}
                          </Text>
                          <Icon
                            name="chevron-down"
                            size={12}
                            color={textPrimary}
                            style={{ marginLeft: 4 }}
                            weight="medium"
                          />
                        </TouchableOpacity>
                      )}
                    />
                  ) : (
                    <Text className="text-text-secondary text-sm">
                      {' - '}
                      {displayValues.servingSize}{' '}
                      {formatServingUnit(displayValues.servingUnit)}{' '}
                      {t('foodEntryAdd.labels.perServing', {
                        defaultValue: 'per serving',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </FadeView>
          ) : (
            <FadeView key="view-serving">
              <Text className="text-text-secondary text-sm mt-3">
                {servingsDisplay}
              </Text>
            </FadeView>
          )}
        </Animated.View>

        {/* The three facts the entry is filed under, as the log sheet shows
            them. Viewing, a tap starts editing; editing, it opens the picker. */}
        <Animated.View
          layout={LinearTransition.duration(300)}
          className="flex-row"
          style={{ gap: 8 }}
        >
          <EntryContextCard
            label={t('common.date', { defaultValue: 'Date' })}
            value={formatDateLabel(
              isEditing ? selectedDate : normalizeDate(entry.entry_date),
              t,
              dateLocale
            )}
            onPress={() =>
              isEditing ? calendarRef.current?.present() : startEditing()
            }
          />
          <EntryContextCard
            label={t('foodEntryView.time', { defaultValue: 'Time' })}
            value={
              (isEditing
                ? formatTimeLabel(entryTime, preferences?.time_format)
                : formatTimeLabel(
                    entry.entry_time,
                    preferences?.time_format
                  )) ?? t('common.none', { defaultValue: 'None' })
            }
            onPress={() =>
              isEditing ? timeSheetRef.current?.present() : startEditing()
            }
          />
          {isEditing && selectedMealType ? (
            <BottomSheetPicker
              value={effectiveMealId!}
              options={mealPickerOptions}
              onSelect={(id) => updateEdit({ selectedMealId: id })}
              title={t('foodEntryView.selectMeal', {
                defaultValue: 'Select Meal',
              })}
              renderTrigger={({ onPress }) => (
                <EntryContextCard
                  label={t('foodEntryView.meal', { defaultValue: 'Meal' })}
                  value={mealTypeLabel(selectedMealType)}
                  onPress={onPress}
                />
              )}
            />
          ) : (
            <EntryContextCard
              label={t('foodEntryView.meal', { defaultValue: 'Meal' })}
              value={entryMealTypeLabel}
              onPress={startEditing}
            />
          )}
        </Animated.View>
        {isEditing && entryTime !== '' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            className="self-start"
            onPress={() => updateEdit({ entryTime: '' })}
            accessibilityRole="button"
            accessibilityLabel={t('foodEntryView.clearTimeLabel', {
              defaultValue: 'Clear entry time',
            })}
          >
            <Text className="text-text-link text-base font-medium">
              {t('foodEntryView.clearTime', { defaultValue: 'Clear time' })}
            </Text>
          </TouchableOpacity>
        ) : null}

        <FoodNutrientBreakdown
          values={displayValues}
          servings={shownServings}
          showNetCarbs={useNetCarbsInList}
          customNutrients={selectedCustomNutrients}
        />

        <Animated.View layout={LinearTransition.duration(300)} className="mt-3">
          {isEditing ? (
            <MarkdownNotesField
              images={[
                ...usableFoodImages(entry.images),
                ...usableFoodImages(entry.food_images),
              ]}
              value={entryNotes}
              onCommit={(text) => updateEdit({ entryNotes: text })}
              label={t('foodEntryView.entryNotes', {
                defaultValue: 'Note for this entry',
              })}
            />
          ) : entry.notes ? (
            <>
              <Text className="text-xs font-semibold uppercase text-text-muted mb-1">
                {t('foodEntryView.entryNotes', {
                  defaultValue: 'Note for this entry',
                })}
              </Text>
              <View className="rounded-lg border border-border-subtle bg-raised px-3 py-2">
                <NoteMarkdown
                  text={entry.notes}
                  fontSize={14}
                  images={[
                    ...usableFoodImages(entry.images),
                    ...usableFoodImages(entry.food_images),
                  ]}
                />
              </View>
            </>
          ) : null}
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(300)}>
          <Button
            variant="destructive"
            onPress={confirmAndDelete}
            disabled={isDeletePending}
            accessibilityRole="button"
            accessibilityLabel={t('foodEntryView.deleteEntry', {
              defaultValue: 'Delete Entry',
            })}
            className="mt-2"
          >
            {isDeletePending
              ? t('common.deleting', { defaultValue: 'Deleting...' })
              : t('foodEntryView.deleteEntry', {
                  defaultValue: 'Delete Entry',
                })}
          </Button>
        </Animated.View>
      </ScrollView>

      {isEditing && (
        <CalendarSheet
          ref={calendarRef}
          selectedDate={selectedDate}
          onSelectDate={(date) => updateEdit({ selectedDate: date })}
        />
      )}
      {isEditing && (
        <TimeSheet
          ref={timeSheetRef}
          value={entryTime}
          onSelectTime={(time) => updateEdit({ entryTime: time })}
        />
      )}
    </View>
  );
};

export default FoodEntryViewScreen;
