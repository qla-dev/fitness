import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import FooterCTA, { footerCtaKeyboardTrim } from '../components/ui/FooterCTA';
import PillInput from '../components/ui/PillInput';
import Icon from '../components/Icon';
import { fireSelectionHaptic, fireSuccessHaptic } from '../services/haptics';
import { formatLocalizedNumber } from '../localization';
import {
  useNativeHeaderOffset,
  useScreenHeader,
} from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  clearSetupWizardSession,
  answerValues,
  getSetupWizardSession,
  visibleFields,
  type SetupField,
  type SetupStep,
} from '../services/setupWizardSession';
import type { SetupAnswers } from '../services/personalSetup';
import type { RootStackScreenProps } from '../types/navigation';

function isFieldValid(field: SetupField, answers: SetupAnswers) {
  const value = answers[field.id];
  if (!field.numeric || typeof value !== 'string' || !value.trim()) return true;
  const n = Number(value.replace(',', '.'));
  return (
    Number.isFinite(n) &&
    (!field.integer || Number.isInteger(n)) &&
    n >= (field.min ?? 0) &&
    n <= (field.max ?? Infinity)
  );
}

function isStepValid(step: SetupStep, answers: SetupAnswers) {
  return visibleFields(step, answers).every((field) =>
    isFieldValid(field, answers)
  );
}

function fieldUnit(field: SetupField, answers: SetupAnswers) {
  return typeof field.unit === 'function' ? field.unit(answers) : field.unit;
}

function fieldSuggestion(field: SetupField, answers: SetupAnswers) {
  return typeof field.suggestion === 'function'
    ? field.suggestion(answers)
    : field.suggestion;
}

// The single spacing step this screen repeats: header to progress bar,
// progress bar to title, title to its supporting line.
const WIZARD_GAP = 12;

export default function SetupWizardScreen({
  navigation,
}: RootStackScreenProps<'SetupWizard'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const accentColor =
    (useCSSVariable('--color-accent-primary') as string) || '#0A84FF';
  const [session] = useState(getSetupWizardSession);
  const allSteps = session?.steps ?? [];
  const initial = session?.initial ?? {};
  const singleStep = session?.singleStep;
  const [answers, setAnswers] = useState(initial);
  const [index, setIndex] = useState(() => {
    if (singleStep) {
      const at = allSteps
        .filter((candidate) => visibleFields(candidate, initial).length > 0)
        .findIndex((candidate) => candidate.id === singleStep);
      if (at >= 0) return at;
    }
    return Math.max(
      0,
      Math.min(allSteps.length, Number(initial.__step) || 0)
    );
  });
  // A step whose only question is hidden by an earlier answer (target weight
  // when the sole focus is "Just track") is skipped rather than shown empty.
  const steps = allSteps.filter(
    (candidate) => visibleFields(candidate, answers).length > 0
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const leaving = useRef(false);
  const step = steps[index];
  const fields = step ? visibleFields(step, answers) : [];
  const valid = !step || isStepValid(step, answers);
  // Multiple-choice steps show how many choices are picked on Continue.
  const selectedCount = fields
    .filter((field) => field.multiple)
    .reduce(
      (total, field) => total + answerValues(answers, field.id).length,
      0
    );
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  // Measured so the scroll content clears the footer and a focused input is
  // kept this far above the keyboard, i.e. above the footer riding on it.
  const [footerHeight, setFooterHeight] = useState(88);
  // Only steps that start with a typed field; option-first steps keep the
  // keyboard down so their choices stay visible.
  const firstInputId =
    fields[0] && !fields[0].options ? fields[0].id : undefined;

  // A step that asks for typed values opens on its first input, so the
  // keyboard is up without an extra tap. Waits for the step's layout to settle
  // so KeyboardAwareScrollView can scroll the field into view.
  useEffect(() => {
    if (!firstInputId) return;
    const timer = setTimeout(
      () => inputRefs.current[firstInputId]?.focus(),
      350
    );
    return () => clearTimeout(timer);
  }, [index, firstInputId]);

  const fieldError = (field: SetupField) => {
    if (isFieldValid(field, answers)) return undefined;
    const range = {
      min: formatLocalizedNumber(field.min ?? 0),
      max: formatLocalizedNumber(field.max ?? 0),
    };
    return field.integer
      ? t('setup.rangeErrorWhole', {
          defaultValue: 'Enter a whole number from {{min}} to {{max}}.',
          ...range,
        })
      : t('setup.rangeError', {
          defaultValue: 'Enter a number from {{min}} to {{max}}.',
          ...range,
        });
  };

  const close = () => {
    leaving.current = true;
    clearSetupWizardSession(session);
    session?.onClose();
    navigation.goBack();
  };

  const persist = async (
    next: SetupAnswers,
    done: boolean,
    shouldClose: boolean
  ) => {
    if (lock.current || !session) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await session.onSave(
        {
          ...next,
          // Editing one answer leaves the tour where it was.
          __step: singleStep
            ? (initial.__step ?? '')
            : done
              ? ''
              : String(index + 1),
        },
        done
      );
      if (done && !step) fireSuccessHaptic();
      if (shouldClose) close();
      else setIndex((i) => i + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };

  const later = () => {
    // Keep already-saved steps, but do not save an invalid draft on dismissal.
    const next = { ...answers };
    if (step && !valid)
      step.fields.forEach((field) => {
        next[field.id] = initial[field.id] ?? '';
      });
    void persist(next, true, true);
  };

  const back = () => {
    if (busy) return;
    // One step, nothing behind it: Back leaves without saving.
    if (singleStep) {
      close();
      return;
    }
    if (index > 0) {
      setError(false);
      setIndex((i) => i - 1);
    } else later();
  };

  const skip = () => {
    if (!step) return;
    const next = { ...answers };
    step.fields.forEach((f) => {
      next[f.id] = initial[f.id] ?? '';
    });
    setAnswers(next);
    void persist(next, false, false);
  };

  // Hardware back and any other pop step back through the wizard instead of
  // dropping it without saving.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current || !getSetupWizardSession()) return;
        event.preventDefault();
        backRef.current();
      }),
    [navigation]
  );
  useEffect(() => {
    if (!session) navigation.goBack();
    return () => clearSetupWizardSession(session);
  }, [navigation, session]);

  const progressTitle = t('setup.progress', {
    defaultValue: 'Step {{current}} of {{total}}',
    current: formatLocalizedNumber(index + 1),
    total: formatLocalizedNumber(steps.length + 1),
  });
  const header = useScreenHeader({
    variant: 'transparent',
    title: progressTitle,
    nativeTitle: progressTitle,
    left: {
      kind: 'icon',
      sfSymbol: 'chevron.left',
      ionicon: 'chevron-back',
      accessibilityLabel: t('common.back', { defaultValue: 'Back' }),
      onPress: back,
      disabled: busy,
    },
    right:
      step && !singleStep
        ? {
          kind: 'text',
          label: t('common.skip', { defaultValue: 'Skip' }),
          onPress: skip,
          disabled: busy,
        }
      : null,
    accessory: (
      <View
        className="h-1 mx-5 bg-raised rounded-full"
        style={{ marginTop: 13 }}
      >
        <View
          className="h-1 bg-accent-primary rounded-full"
          style={{ width: `${((index + 1) / (steps.length + 1)) * 100}%` }}
        />
      </View>
    ),
    nativeOptions: { headerBackVisible: false, gestureEnabled: false },
  });

  // Footer bottom padding dropped while the keyboard is up; the scroll view
  // below gives that space back so a focused field is not left riding high.
  const keyboardTrim = footerCtaKeyboardTrim(insets.bottom);

  if (!session) return null;

  // Presented as a native modal, which does not reliably receive the root
  // KeyboardProvider's events (same as FoodPhotoFlow), so it carries its own.
  return (
    <KeyboardProvider>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: usesNativeHeader ? 0 : insets.top }}
      >
        {header}
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          // No automatic inset: the header accessory above already carries the
          // offset the transparent bar does not reserve. Asking for it here too
          // pushed this content up under the accessory.
          contentInsetAdjustmentBehavior="never"
          key={step?.id ?? 'review'}
          keyboardShouldPersistTaps="handled"
          // Keyboard up, the footer loses keyboardTrim of its bottom padding,
          // so the list gives that space back and keeps a focused field just
          // 12 above the (shorter) footer instead of leaving an empty band.
          bottomOffset={footerHeight - keyboardTrim + 12}
          extraKeyboardSpace={-keyboardTrim}
          contentContainerStyle={{
            padding: 20,
            // KeyboardAwareScrollView ignores contentInsetAdjustmentBehavior,
            // so a transparent bar's offset is spelled out: the measured bar,
            // then the accessory's own gap, its hairline, and the same gap
            // again — the three gaps around the progress bar are one value.
            paddingTop: usesNativeHeader
              ? headerOffset + WIZARD_GAP * 4 + 4
              : WIZARD_GAP * 3,
            paddingBottom: footerHeight + 12,
          }}
        >
          {/* Each step asks one question, so its heading is the question and
              the field's icon sits beside it instead of a separate label. */}
          <View className="flex-row items-center gap-3 mb-3">
            {fields[0]?.icon && (
              <Icon name={fields[0].icon} size={28} color={accentColor} />
            )}
            <Text className="flex-1 text-text-primary text-3xl font-bold">
              {step?.heading ??
                t('setup.ready', { defaultValue: 'Ready when you are' })}
            </Text>
          </View>
          <Text className="text-text-secondary text-base mb-7">
            {step?.hint ??
              t('setup.reviewHint', {
                defaultValue:
                  'Review your choices. You can change them any time.',
              })}
          </Text>
          {step
            ? fields.map((field) => (
                <View
                  key={field.id}
                  className={field.options ? 'mb-6' : 'mb-2'}
                >
                  {field.options ? (
                    <View className="flex-row flex-wrap gap-2">
                      {field.options.map((option) => {
                        const selected = answerValues(
                          answers,
                          field.id
                        ).includes(option.value);
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole={
                              field.multiple ? 'checkbox' : 'radio'
                            }
                            accessibilityState={{ checked: selected }}
                            onPress={() => {
                              fireSelectionHaptic();
                              setAnswers((a) => {
                                const old = answerValues(a, field.id);
                                const value = field.multiple
                                  ? option.value === 'none'
                                    ? selected
                                      ? []
                                      : ['none']
                                    : selected
                                      ? old.filter((v) => v !== option.value)
                                      : [
                                          ...old.filter((v) => v !== 'none'),
                                          option.value,
                                        ]
                                  : option.value;
                                return { ...a, [field.id]: value };
                              });
                            }}
                            // Tight horizontal padding so short pairs such as "Often moving" /
                            // "Physically demanding" share a row on ~390pt phones.
                            className={`flex-row items-center gap-1.5 rounded-2xl px-3.5 py-3.5 border ${selected ? 'bg-accent-primary border-accent-primary' : 'bg-surface border-border'}`}
                          >
                            {option.icon && (
                              <Icon
                                name={option.icon}
                                size={18}
                                color={selected ? '#FFFFFF' : accentColor}
                              />
                            )}
                            {/* Same weight in both states: a bolder selected label
                              would widen the chip and reflow the row. */}
                            <Text
                              className={`font-medium ${selected ? 'text-white' : 'text-text-primary'}`}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <PillInput
                      ref={(input) => {
                        inputRefs.current[field.id] = input;
                      }}
                      accessibilityLabel={field.label}
                      value={
                        typeof answers[field.id] === 'string'
                          ? (answers[field.id] as string)
                          : ''
                      }
                      onChangeText={(value) =>
                        setAnswers((a) => ({ ...a, [field.id]: value }))
                      }
                      unit={fieldUnit(field, answers)}
                      error={fieldError(field)}
                      reserveErrorSpace={!!field.numeric}
                      placeholder={
                        field.placeholder ??
                        (field.numeric
                          ? fieldSuggestion(field, answers) !== undefined
                            ? formatLocalizedNumber(
                                fieldSuggestion(field, answers) as number
                              )
                            : t('setup.rangePlaceholder', {
                                defaultValue: '{{min}}–{{max}}',
                                min: formatLocalizedNumber(field.min ?? 0),
                                max: formatLocalizedNumber(field.max ?? 0),
                              })
                          : undefined)
                      }
                      keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                      maxLength={field.numeric ? 8 : 160}
                      editable={!busy}
                    />
                  )}
                </View>
              ))
            : allSteps
                .flatMap((s) => visibleFields(s, answers))
                .map((field) => {
                  const value = answers[field.id];
                  const values = Array.isArray(value)
                    ? value
                    : value
                      ? [value]
                      : [];
                  return (
                    <View
                      key={field.id}
                      className="bg-surface rounded-2xl p-4 mb-2"
                    >
                      <Text className="text-text-secondary text-sm">
                        {field.label}
                      </Text>
                      <Text className="text-text-primary text-lg">
                        {values.length
                          ? values
                              .map((v) => {
                                const option = field.options?.find(
                                  (o) => o.value === v
                                );
                                if (option) return option.label;
                                const unit = fieldUnit(field, answers);
                                return unit ? `${v} ${unit}` : v;
                              })
                              .join(', ')
                          : t('setup.skipped', { defaultValue: 'Skipped' })}
                      </Text>
                    </View>
                  );
                })}
          {error && (
            <Text accessibilityRole="alert" className="text-icon-danger">
              {t('setup.saveError', {
                defaultValue:
                  'Could not save. Your answers are still here. Please try again.',
              })}
            </Text>
          )}
        </KeyboardAwareScrollView>
        <FooterCTA
          absolute
          loading={busy}
          disabled={!valid}
          onHeightChange={setFooterHeight}
          onPress={() => {
            fireSelectionHaptic();
            if (singleStep) void persist(answers, true, true);
            else void persist(answers, !step, !step);
          }}
          label={
            singleStep
              ? t('common.save', { defaultValue: 'Save' })
              : step
              ? selectedCount > 0
                ? t('setup.continueCount', {
                    defaultValue: 'Continue ({{count}})',
                    defaultValue_one: 'Continue ({{count}})',
                    defaultValue_other: 'Continue ({{count}})',
                    count: selectedCount,
                  })
                : t('common.continue', { defaultValue: 'Continue' })
              : t('setup.finish', { defaultValue: 'Save and start' })
          }
        />
      </View>
    </KeyboardProvider>
  );
}
