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
import {
  purchasesQueryKey,
  useOwnedPrograms,
  useProgramPrice,
} from '../hooks/usePurchases';
import {
  buyProgram,
  purchasesAvailable,
  PurchaseCancelledError,
  restoreProgram,
} from '../services/purchases/revenueCat';
import { OnlineError, useOnlineAccount } from '../services/online/account';
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
  const owned = useOwnedPrograms().has(route.params.programId);
  const signedIn = useOnlineAccount((state) => !!state.session);
  const price = useProgramPrice(program?.priceTier ?? 'program499');
  // A build without a RevenueCat key cannot sell. Development builds still
  // install, so programs can be worked on; release builds say so and stop.
  const canSell = purchasesAvailable();
  const free = owned || alreadyInstalled || (!canSell && __DEV__);
  const [buying, setBuying] = useState(false);
  // The store took the money but the unlock did not come back (closed app,
  // lost network): restoring asks the backend to grant it again.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const locked = useRef(false);
  const [progress, setProgress] = useState<ProgramInstallProgress | null>(null);
  const [result, setResult] = useState<ProgramInstallResult | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = progress !== null || buying;
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
        t,
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
  // Buys the program at its price, has the backend verify and unlock it,
  // then installs it as before.
  const purchase = async (restore = false) => {
    if (!program || locked.current) return;
    if (!signedIn) {
      navigation.navigate('OnlineAccount');
      return;
    }
    setBuying(true);
    setFailed(false);
    try {
      const state = await (restore
        ? restoreProgram(program.id, program.priceTier)
        : buyProgram(program.id, program.priceTier));
      queryClient.setQueryData(purchasesQueryKey, state);
      setUnconfirmed(false);
      setBuying(false);
      await install();
    } catch (error) {
      setBuying(false);
      if (error instanceof PurchaseCancelledError) return;
      setUnconfirmed(error instanceof OnlineError && error.status === 402);
      setFailed(true);
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
          : t('programs.purchase.weeklyExplainerPaid', {
              defaultValue:
                'Each week is saved as a separate program in My Programs, with all its sessions and exercises.',
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
        ) : free ? (
          t('programs.purchase.confirm', { defaultValue: 'Add to my programs' })
        ) : unconfirmed ? (
          t('programs.purchase.restore', { defaultValue: 'Restore purchase' })
        ) : (
          t('programs.purchase.buy', {
            defaultValue: 'Buy for {{price}}',
            price,
          })
        )
      }
      onFooterPress={
        result
          ? openProgram
          : free
            ? () => void install()
            : () => void purchase(unconfirmed)
      }
      footerLoading={busy}
      footerDisabled={busy || !program || (!free && !canSell)}
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
                  {owned
                    ? t('programs.purchase.owned', {
                        defaultValue: 'Bought on your account',
                      })
                    : free
                      ? t('programs.purchase.free', { defaultValue: 'Free' })
                      : !canSell
                        ? t('programs.purchase.unavailable', {
                            defaultValue:
                              'Purchases are not available in this version yet.',
                          })
                        : t('programs.purchase.oneTime', {
                            defaultValue:
                              '{{price}}, once. Yours on every device you sign in on.',
                            price,
                          })}
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
                {unconfirmed
                  ? t('programs.purchase.unconfirmed', {
                      defaultValue:
                        'Your purchase has not been confirmed yet. Restore it to unlock the program; you will not be charged again.',
                    })
                  : t('programs.purchase.failed', {
                      defaultValue:
                        'Could not add this program. Please try again.',
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
