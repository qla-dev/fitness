import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import { formatLocalizedNumber } from '../localization';
import type { SetupAnswers } from '../services/personalSetup';

export interface SetupField {
  id: string;
  label: string;
  options?: { value: string; label: string }[];
  multiple?: boolean;
  numeric?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  showWhen?: (answers: SetupAnswers) => boolean;
}
export interface SetupStep {
  id: string;
  heading: string;
  hint: string;
  fields: SetupField[];
}
export default function SetupWizard({
  title,
  steps,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  steps: SetupStep[];
  initial: SetupAnswers;
  onSave: (answers: SetupAnswers, done: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState(initial);
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(steps.length, Number(initial.__step) || 0))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const step = steps[index];
  const fields =
    step?.fields.filter(
      (field) => !field.showWhen || field.showWhen(answers)
    ) ?? [];
  const valid =
    !step ||
    fields.every((field) => {
      const value = answers[field.id];
      if (!field.numeric || typeof value !== 'string' || !value.trim())
        return true;
      const n = Number(value.replace(',', '.'));
      return (
        Number.isFinite(n) &&
        (!field.integer || Number.isInteger(n)) &&
        n >= (field.min ?? 0) &&
        n <= (field.max ?? Infinity)
      );
    });
  const persist = async (next: SetupAnswers, done: boolean, close: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await onSave({ ...next, __step: done ? '' : String(index + 1) }, done);
      if (close) onClose();
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
    if (!valid)
      step?.fields.forEach((field) => {
        next[field.id] = initial[field.id] ?? '';
      });
    void persist(next, true, true);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={later}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-between px-5 py-3">
          <Text className="text-text-secondary font-semibold">{title}</Text>
          <Button variant="ghost" disabled={busy} onPress={later}>
            {t('setup.later', { defaultValue: 'Set up later' })}
          </Button>
        </View>
        <View className="h-1 mx-6 bg-raised rounded-full">
          <View
            className="h-1 bg-accent-primary rounded-full"
            style={{ width: `${((index + 1) / (steps.length + 1)) * 100}%` }}
          />
        </View>
        <ScrollView
          key={step?.id ?? 'review'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
          <Text className="text-accent-primary font-semibold mb-4">
            {t('setup.progress', {
              defaultValue: 'Step {{current}} of {{total}}',
              current: formatLocalizedNumber(index + 1),
              total: formatLocalizedNumber(steps.length + 1),
            })}
          </Text>
          <Text className="text-text-primary text-3xl font-bold mb-3">
            {step?.heading ??
              t('setup.ready', { defaultValue: 'Ready when you are' })}
          </Text>
          <Text className="text-text-secondary text-base mb-7">
            {step?.hint ??
              t('setup.reviewHint', {
                defaultValue:
                  'Review your choices. You can change them any time.',
              })}
          </Text>
          {step
            ? fields.map((field) => (
                <View key={field.id} className="mb-6">
                  <Text className="text-text-primary font-semibold mb-3">
                    {field.label}
                  </Text>
                  {field.options ? (
                    <View className="flex-row flex-wrap gap-2">
                      {field.options.map((option) => {
                        const current = answers[field.id];
                        const selected = Array.isArray(current)
                          ? current.includes(option.value)
                          : current === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole={
                              field.multiple ? 'checkbox' : 'radio'
                            }
                            accessibilityState={{ checked: selected }}
                            onPress={() =>
                              setAnswers((a) => {
                                const old = Array.isArray(a[field.id])
                                  ? (a[field.id] as string[])
                                  : [];
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
                              })
                            }
                            className={`rounded-2xl px-5 py-4 border ${selected ? 'bg-accent-primary border-accent-primary' : 'bg-surface border-border'}`}
                          >
                            <Text
                              className={
                                selected
                                  ? 'text-white font-semibold'
                                  : 'text-text-primary'
                              }
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabel={field.label}
                      value={
                        typeof answers[field.id] === 'string'
                          ? (answers[field.id] as string)
                          : ''
                      }
                      onChangeText={(value) =>
                        setAnswers((a) => ({ ...a, [field.id]: value }))
                      }
                      keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                      maxLength={field.numeric ? 8 : 160}
                      className="bg-surface text-text-primary rounded-2xl px-5 py-4 text-xl"
                    />
                  )}
                </View>
              ))
            : steps
                .flatMap((s) => s.fields)
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
                              .map(
                                (v) =>
                                  field.options?.find((o) => o.value === v)
                                    ?.label ?? v
                              )
                              .join(', ')
                          : t('setup.skipped', { defaultValue: 'Skipped' })}
                      </Text>
                    </View>
                  );
                })}
          {!valid && (
            <Text accessibilityRole="alert" className="text-icon-danger">
              {t('setup.invalid', {
                defaultValue: 'Enter a valid value within the range shown.',
              })}
            </Text>
          )}
          {error && (
            <Text accessibilityRole="alert" className="text-icon-danger">
              {t('setup.saveError', {
                defaultValue:
                  'Could not save. Your answers are still here. Please try again.',
              })}
            </Text>
          )}
        </ScrollView>
        <View className="px-6 py-4 gap-2 border-t border-border">
          <Button
            loading={busy}
            disabled={!valid}
            onPress={() => void persist(answers, !step, !step)}
          >
            {step
              ? t('common.continue', { defaultValue: 'Continue' })
              : t('setup.finish', { defaultValue: 'Save and start' })}
          </Button>
          <View className="flex-row justify-between">
            <Button
              variant="ghost"
              disabled={busy || index === 0}
              onPress={() => setIndex((i) => i - 1)}
            >
              {t('common.back', { defaultValue: 'Back' })}
            </Button>
            {step && (
              <Button
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  const next = { ...answers };
                  step.fields.forEach((f) => {
                    next[f.id] = initial[f.id] ?? '';
                  });
                  setAnswers(next);
                  void persist(next, false, false);
                }}
              >
                {t('common.skip', { defaultValue: 'Skip' })}
              </Button>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
