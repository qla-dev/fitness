import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, Pressable, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';
import PromptScreen from '../components/ui/PromptScreen';
import SuccessHero from '../components/SuccessHero';
import ProgramCover from '../components/ProgramCover';
import Icon from '../components/Icon';
import { useProgramAccents } from '../components/ProgramStore';
import { useExternalProviders } from '../hooks/useExternalProviders';
import {
  installedProgramsQueryKey,
  useInstalledPrograms,
} from '../hooks/useInstalledPrograms';
import { getProgramById } from '../constants/exercisePrograms';
import { countProgramExercises } from '../types/exerciseProgram';
import {
  installProgramAsPresets,
  type ProgramInstallProgress,
  type ProgramInstallResult,
} from '../services/programToPresets';
import { fireSuccessHaptic } from '../services/haptics';
import { formatLocalizedNumber } from '../localization';
import type { RootStackScreenProps } from '../types/navigation';

export default function ProgramPurchaseScreen({
  route,
  navigation,
}: RootStackScreenProps<'ProgramPurchase'>) {
  const { t } = useTranslation();
  const program = getProgramById(route.params.programId);
  const accents = useProgramAccents();
  const tint = useCSSVariable('--color-accent-primary') as string;
  const queryClient = useQueryClient();
  const { providers } = useExternalProviders({ category: 'exercise' });
  const alreadyInstalled = useInstalledPrograms().has(route.params.programId);
  const locked = useRef(false);
  const [progress, setProgress] = useState<ProgramInstallProgress | null>(null);
  const [result, setResult] = useState<ProgramInstallResult | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = progress !== null;
  usePreventRemove(busy, () => {});
  useEffect(() => {
    if (result?.preset) fireSuccessHaptic();
  }, [result]);

  const install = async () => {
    if (!program || locked.current) return;
    locked.current = true;
    setFailed(false);
    setProgress({
      resolved: 0,
      total: countProgramExercises(program),
      session: 1,
      sessions: program.sessions.length,
    });
    try {
      const provider = providers[0];
      const installed = await installProgramAsPresets(
        program,
        provider
          ? { id: provider.id, provider_type: provider.provider_type }
          : null,
        setProgress
      );
      if (!installed.preset) {
        setFailed(true);
        return;
      }
      setResult(installed);
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          String(queryKey[0]).startsWith('workoutPreset') ||
          queryKey[0] === installedProgramsQueryKey[0],
      });
    } catch {
      setFailed(true);
    } finally {
      locked.current = false;
      setProgress(null);
    }
  };
  const openProgram = () => {
    if (result?.preset)
      navigation.replace('WorkoutPresetDetail', { preset: result.preset });
  };
  return (
    <PromptScreen
      headerTitle={t('programs.title', { defaultValue: 'Program' })}
      title={program?.name ?? t('programs.title', { defaultValue: 'Program' })}
      description={
        result
          ? undefined
          : t('programs.purchase.singleExplainer', {
              defaultValue:
                'All sessions and exercises are saved together as one program in My Programs. Nothing is charged.',
            })
      }
      dismissDisabled={busy}
      footerLabel={
        result ? (
          <View className="flex-row items-center gap-2">
            <Icon name="exercise" size={20} color="white" />
            <Text className="text-white font-semibold">
              {t('programs.purchase.openProgram', {
                defaultValue: 'Open program',
              })}
            </Text>
          </View>
        ) : (
          t('programs.purchase.confirm', { defaultValue: 'Add to my programs' })
        )
      }
      onFooterPress={result ? openProgram : () => void install()}
      footerLoading={busy}
      footerDisabled={busy || !program}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingVertical: 16,
        }}
      >
        {result ? (
          <>
            <SuccessHero
              celebrate
              title={t('programs.purchase.success', {
                defaultValue: 'Program added',
              })}
              description={program?.name}
            />
            {result.skipped.length > 0 && (
              <Text className="text-text-secondary text-center mb-4">
                {t('programs.purchase.skipped', {
                  count: result.skipped.length,
                  defaultValue_one:
                    "{{count}} exercise couldn't be matched and was left out",
                  defaultValue_other:
                    "{{count}} exercises couldn't be matched and were left out",
                  defaultValue:
                    "{{count}} exercises couldn't be matched and were left out",
                })}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.replace('WorkoutPresetsLibrary')}
              className="flex-row items-center justify-center gap-2 py-4"
            >
              <Icon name="list" size={22} color={tint} />
              <Text style={{ color: tint }} className="font-semibold">
                {t('programs.purchase.myPrograms', {
                  defaultValue: 'My Programs',
                })}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {program && (
              <View className="items-center mb-6">
                <ProgramCover
                  program={program}
                  size={112}
                  iconSize={50}
                  accent={accents[program.accentVar]}
                />
                <Text className="text-text-secondary mt-3">
                  {program.coach}
                </Text>
              </View>
            )}
            {program && (
              <View className="bg-surface rounded-2xl p-4 gap-3">
                <Text className="text-text-primary">
                  {t('programs.purchase.contents', {
                    defaultValue:
                      '{{sessions}} sessions · {{exercises}} exercises',
                    sessions: formatLocalizedNumber(program.sessions.length),
                    exercises: formatLocalizedNumber(
                      countProgramExercises(program)
                    ),
                  })}
                </Text>
                <Text className="text-text-secondary">
                  {t('programs.purchase.free', { defaultValue: 'Free' })}
                </Text>
              </View>
            )}
            {busy && (
              <Text
                accessibilityLiveRegion="polite"
                className="text-text-secondary mt-4"
              >
                {t('programs.purchase.progress', {
                  defaultValue:
                    'Adding exercises… {{resolved}} of {{total}}, workout {{session}} of {{sessions}}',
                  ...progress,
                })}
              </Text>
            )}
            {failed && (
              <Text
                accessibilityRole="alert"
                className="text-text-primary mt-4"
              >
                {t('programs.purchase.failed', {
                  defaultValue: 'Could not add this program. Please try again.',
                })}
              </Text>
            )}
            {alreadyInstalled && !busy && (
              <Text className="text-text-secondary mt-4">
                {t('programs.purchase.singleAlreadyAdded', {
                  defaultValue:
                    'This program is already in My Programs. Adding it again creates one additional copy.',
                })}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </PromptScreen>
  );
}
