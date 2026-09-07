import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import { useProgramAccents } from './ProgramStore';
import { useExternalProviders } from '../hooks/useExternalProviders';
import {
  installProgramAsPresets,
  type ProgramInstallProgress,
  type ProgramInstallResult,
} from '../services/programToPresets';
import { countProgramExercises } from '../types/exerciseProgram';
import type { ExerciseProgram } from '../types/exerciseProgram';

interface ProgramPurchaseSheetProps {
  program: ExerciseProgram;
  onClose: () => void;
  onInstalled: (result: ProgramInstallResult) => void;
}

/**
 * The confirm-to-add sheet a program opens from Start, shaped like the system
 * purchase sheet people already know: what they are getting, what it costs,
 * one primary action.
 *
 * Nothing is actually charged — the price line says so rather than implying a
 * payment that does not happen. Confirming installs the program as one workout
 * preset per session.
 */
const ProgramPurchaseSheet: React.FC<ProgramPurchaseSheetProps> = ({
  program,
  onClose,
  onInstalled,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const accents = useProgramAccents();
  const queryClient = useQueryClient();
  const [accentPrimary, textSecondary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-secondary',
  ]) as [string, string];

  const { providers } = useExternalProviders({ category: 'exercise' });
  const provider = providers[0] ?? null;
  const [progress, setProgress] = useState<ProgramInstallProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const installing = useRef(false);

  const install = async () => {
    if (installing.current) return;
    installing.current = true;
    setFailed(false);
    setProgress({
      resolved: 0,
      total: countProgramExercises(program),
      session: 1,
      sessions: program.sessions.length,
    });
    try {
      const result = await installProgramAsPresets(
        program,
        provider
          ? { id: provider.id, provider_type: provider.provider_type }
          : null,
        setProgress
      );
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          String(queryKey[0]).startsWith('workoutPreset'),
      });
      onInstalled(result);
    } catch {
      setFailed(true);
    }
    installing.current = false;
    setProgress(null);
  };

  const busy = progress !== null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={() => {
          if (!busy) onClose();
        }}
      >
        <Pressable
          className="bg-chrome rounded-t-3xl px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 20 }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center mb-4">
            <View className="h-1 w-10 rounded-full bg-border-strong" />
          </View>

          <View className="flex-row items-center mb-5">
            <View
              className="rounded-2xl items-center justify-center mr-3"
              style={{
                width: 64,
                height: 64,
                backgroundColor: accents[program.accentVar],
              }}
            >
              <Icon name={program.icon} size={30} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text
                className="text-text-primary text-lg font-bold"
                numberOfLines={1}
              >
                {program.name}
              </Text>
              <Text className="text-text-secondary text-sm" numberOfLines={1}>
                {program.coach}
              </Text>
            </View>
          </View>

          <View className="bg-surface rounded-2xl overflow-hidden mb-4">
            {[
              {
                label: t('programs.purchase.sessions', {
                  defaultValue: 'Workouts added',
                }),
                value: String(program.sessions.length),
              },
              {
                label: t('programs.purchase.exercises', {
                  defaultValue: 'Exercises',
                }),
                value: String(countProgramExercises(program)),
              },
              {
                label: t('programs.purchase.price', { defaultValue: 'Price' }),
                value: t('programs.purchase.free', { defaultValue: 'Free' }),
              },
            ].map((row, index) => (
              <View
                key={row.label}
                className={`flex-row items-center px-4 py-3 ${
                  index > 0 ? 'border-t border-border-subtle' : ''
                }`}
              >
                <Text className="flex-1 text-text-primary text-sm font-medium">
                  {row.label}
                </Text>
                <Text className="text-text-secondary text-sm">{row.value}</Text>
              </View>
            ))}
          </View>

          <Text className="text-text-secondary text-xs mb-4">
            {t('programs.purchase.explainer', {
              defaultValue:
                'Each session is saved as its own workout, ready to start from Programs. Nothing is charged.',
            })}
          </Text>

          {busy && (
            <View className="flex-row items-center mb-4">
              <ActivityIndicator size="small" color={accentPrimary} />
              <Text className="text-text-secondary text-sm ml-3 flex-1">
                {t('programs.purchase.progress', {
                  defaultValue:
                    'Adding exercises… {{resolved}} of {{total}}, workout {{session}} of {{sessions}}',
                  resolved: progress.resolved,
                  total: progress.total,
                  session: progress.session,
                  sessions: progress.sessions,
                })}
              </Text>
            </View>
          )}

          {failed && (
            <Text
              accessibilityRole="alert"
              className="text-text-primary text-sm mb-4"
            >
              {t('programs.purchase.failed', {
                defaultValue: 'Could not add this program. Please try again.',
              })}
            </Text>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void install()}
            className="rounded-full items-center justify-center"
            style={{
              height: 50,
              backgroundColor: accentPrimary,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text className="text-accent-text text-base font-bold">
              {t('programs.purchase.confirm', {
                defaultValue: 'Add to my programs',
              })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            className="items-center justify-center mt-1"
            style={{ height: 46 }}
          >
            <Text
              className="text-base font-medium"
              style={{ color: textSecondary }}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default ProgramPurchaseSheet;
