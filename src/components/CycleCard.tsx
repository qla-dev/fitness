import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { View, Text, Pressable } from 'react-native';
import SectionIntro from './SectionIntro';
import { useCycleSettings } from '../hooks/useCycleSettings';
import { useDiscreetMode } from '../hooks/useDiscreetMode';
import {
  useCurrentPregnancy,
  usePregnancyOverview,
} from '../hooks/usePregnancy';
import { useCyclePredictionData } from '../hooks/useCyclePredictionData';
import { getPhaseColor } from '../utils/cycleDisplayUtils';
import { formatDate } from '../utils/dateUtils';
import { babyWeek } from '@workspace/shared';
import WombScene from './wellness/pregnancy/WombScene';
import { localizeBabyWeek } from '../utils/pregnancyContentLocalization';
import { formatLocalizedNumber } from '../localization';
import CycleBeads from './wellness/CycleBeads';
import { fireSelectionHaptic } from '../services/haptics';
import { useWellnessTokens } from './wellness/theme/wellnessTokens';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../types/navigation';

type CycleCardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Diary'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface CycleCardProps {
  navigation: CycleCardNavigation;
}

function getModeTitle(
  t: TFunction,
  mode?: string,
  discreetMode?: boolean
): string {
  if (discreetMode)
    return t('cycleCard.mode.wellness', { defaultValue: 'Wellness' });
  switch (mode) {
    case 'pregnant':
      return t('cycleCard.mode.pregnancy', {
        defaultValue: 'Pregnancy Tracking',
      });
    case 'ttc':
      return t('cycleCard.mode.fertility', {
        defaultValue: 'Fertility Tracking',
      });
    case 'postpartum':
      return t('cycleCard.mode.postpartum', {
        defaultValue: 'Postpartum Recovery',
      });
    case 'menopause':
      return t('cycleCard.mode.menopause', {
        defaultValue: 'Menopause Tracking',
      });
    case 'standard':
      return t('cycleCard.mode.cycle', { defaultValue: 'Cycle Tracking' });
    default:
      return t('cycleCard.mode.cyclePregnancy', {
        defaultValue: 'Cycle & Pregnancy',
      });
  }
}

interface CycleRingContentInfo {
  day: number;
  phase: string;
  avgCycleLength: number;
  avgPeriodLength: number;
  fertileStartDay: number | null;
  fertileEndDay: number | null;
  ovulationDay: number | null;
  nextPeriodStart?: string;
  daysLate: number;
}

// Cycle-state card body (phase readout and ring) for the
// non-discreet cycle layout. The title is the section intro above the card.
const CycleCardRingContent: React.FC<{
  info: CycleRingContentInfo;
}> = ({ info }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const tokens = useWellnessTokens();
  const phaseName = (() => {
    switch (info.phase) {
      case 'menstrual':
        return t('cycleCard.phase.period', { defaultValue: 'Period' });
      case 'follicular':
        return t('cycleCard.phase.follicular', {
          defaultValue: 'Follicular Phase',
        });
      case 'fertile':
        return t('cycleCard.phase.fertile', {
          defaultValue: 'Est. Fertile Window',
        });
      case 'ovulation':
        return t('cycleCard.phase.ovulation', {
          defaultValue: 'Est. Ovulation',
        });
      case 'luteal':
        return t('cycleCard.phase.luteal', { defaultValue: 'Luteal Phase' });
      default:
        return t('cycleCard.phase.active', { defaultValue: 'Cycle Active' });
    }
  })();
  const phaseColor = getPhaseColor(info.phase, tokens);
  // Days from today to a cycle day, wrapping into the next cycle once passed.
  const daysUntil = (
    target: number | null,
    { day, avgCycleLength }: CycleRingContentInfo
  ): string | null => {
    if (!target || day <= 0) return null;
    const count =
      target >= day
        ? target - day
        : Math.max(avgCycleLength, 14) - day + target;
    return t('cycleCard.inDays', { defaultValue: 'in {{count}}d', count });
  };

  return (
    <View className="flex-row items-center gap-3">
      {/* Details on Left: stretched to the ring's height so the phase block
          centers beside it */}
      <View className="flex-1 self-stretch">
        <View className="flex-1 justify-center">
          <Text
            className="text-base font-semibold"
            style={{ color: phaseColor }}
          >
            {phaseName}
          </Text>

          {info.daysLate > 0 ? (
            <Text className="text-sm font-semibold text-text-primary mt-0.5">
              {t('cycleCard.periodLate', {
                defaultValue: 'Period {{count}} day late',
                count: info.daysLate,
              })}
            </Text>
          ) : info.nextPeriodStart ? (
            <Text className="text-sm text-text-secondary mt-0.5">
              {t('cycleCard.nextPeriod', {
                defaultValue: 'Next period est. {{date}}',
                date: formatDate(info.nextPeriodStart, dateLocale),
              })}
            </Text>
          ) : null}

          {/* What is coming, as two small countdowns in their phase colours. */}
          {info.day > 0 && (
            <View className="flex-row mt-3" style={{ gap: 14 }}>
              {[
                {
                  key: 'fertile',
                  color: getPhaseColor('fertile', tokens),
                  label: t('cycleCard.fertile', { defaultValue: 'Fertile' }),
                  value:
                    info.fertileStartDay &&
                    info.fertileEndDay &&
                    info.day >= info.fertileStartDay &&
                    info.day <= info.fertileEndDay
                      ? t('cycleCard.now', { defaultValue: 'Now' })
                      : daysUntil(info.fertileStartDay, info),
                },
                {
                  key: 'ovulation',
                  color: getPhaseColor('ovulation', tokens),
                  label: t('cycleCard.ovulation', {
                    defaultValue: 'Ovulation',
                  }),
                  value:
                    info.ovulationDay === info.day
                      ? t('cycleCard.today', { defaultValue: 'Today' })
                      : daysUntil(info.ovulationDay, info),
                },
              ].map((stat) =>
                stat.value ? (
                  <View
                    key={stat.key}
                    accessible
                    accessibilityLabel={`${stat.label} ${stat.value}`}
                  >
                    <View className="flex-row items-center" style={{ gap: 5 }}>
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: stat.color,
                        }}
                      />
                      <Text className="text-xs text-text-secondary">
                        {stat.label}
                      </Text>
                    </View>
                    <Text
                      className="text-base font-bold"
                      style={{ color: stat.color }}
                    >
                      {stat.value}
                    </Text>
                  </View>
                ) : null
              )}
            </View>
          )}
        </View>
      </View>

      {/* The cycle as a bracelet of day beads on the right */}
      <CycleBeads
        cycleDay={info.day > 0 ? info.day : null}
        cycleLength={info.avgCycleLength}
        periodLength={info.avgPeriodLength}
        fertileStartDay={info.fertileStartDay}
        fertileEndDay={info.fertileEndDay}
        ovulationDay={info.ovulationDay}
        centerValue={
          info.day > 0
            ? t('cycleCard.day', { defaultValue: 'Day {{day}}', day: info.day })
            : t('cycleCard.active', { defaultValue: 'Active' })
        }
        size={98}
      />
    </View>
  );
};

const CycleCard: React.FC<CycleCardProps> = ({ navigation }) => {
  const { settings, isLoading: isSettingsLoading } = useCycleSettings();
  const { t } = useTranslation();
  const { discreetMode } = useDiscreetMode();
  const tokens = useWellnessTokens();

  // Pregnancy details (unconditional hook calls)
  const isPregnant = settings?.mode === 'pregnant';
  const { pregnancy } = useCurrentPregnancy();
  const hasActivePregnancy =
    isPregnant && !!pregnancy && pregnancy.status === 'active';
  const { overview } = usePregnancyOverview(undefined, hasActivePregnancy);

  // Extracted cycle statistics & predictions (unconditional hook call)
  const cycleInfo = useCyclePredictionData();

  // Hide while settings are loading to prevent layout flash (Issue 3)
  if (isSettingsLoading) {
    return null;
  }

  // Hide card if settings are null (un-opted user) or explicitly disabled (Issue 2)
  if (!settings || settings.enabled === false) {
    return null;
  }

  const isSetup = !!settings.onboarded_at && !!settings.enabled;
  const title = getModeTitle(t, settings.mode, discreetMode);
  // The Tracker's section title over the card, with the same "More" link the
  // meals and photos carry; the whole card still opens the same place.
  const intro = (onPress: () => void) => (
    <SectionIntro
      testID="cycle-intro"
      subtitle={title}
      actionLabel={t('measurements.more', { defaultValue: 'More' })}
      onPress={onPress}
    />
  );

  if (!isSetup) {
    const openSetup = () => {
      fireSelectionHaptic();
      navigation.navigate('CycleOnboarding');
    };
    return (
      <>
        {intro(openSetup)}
        <Pressable
          className="bg-surface rounded-xl p-4"
          onPress={openSetup}
          accessibilityRole="button"
          accessibilityLabel={t('cycleCard.setupA11y', {
            defaultValue: 'Set up cycle and pregnancy tracking',
          })}
        >
          <Text className="text-sm text-text-secondary">
            {discreetMode
              ? t('cycleCard.discreetDescription', {
                  defaultValue:
                    'Track your wellness parameters and predictions.',
                })
              : t('cycleCard.description', {
                  defaultValue:
                    'Track cycle phases, predictions, symptoms, and pregnancy milestones.',
                })}
          </Text>
        </Pressable>
      </>
    );
  }

  // Render Rich Content
  const renderCardContent = () => {
    if (discreetMode) {
      const activeDay =
        cycleInfo?.day && cycleInfo.day > 0 ? cycleInfo.day : null;
      return (
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-text-primary">
            {activeDay
              ? t('cycleCard.day', {
                  defaultValue: 'Day {{day}}',
                  day: activeDay,
                })
              : t('cycleCard.wellnessActive', {
                  defaultValue: 'Wellness Tracking Active',
                })}
          </Text>
        </View>
      );
    }

    if (isPregnant) {
      const ga = overview?.gestation;
      const baby = ga ? babyWeek(ga.week) : null;
      if (ga) {
        const localized = localizeBabyWeek(ga.week, t);
        return (
          <View className="flex-row items-center gap-3">
            {baby && <WombScene scene={baby.wombScene} size={72} />}
            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                {t('cycleCard.weekDay', {
                  defaultValue: 'Week {{week}}, Day {{day}}',
                  week: ga.week,
                  day: ga.day,
                })}
              </Text>
              {baby && (
                <Text
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: tokens.phasePregnant }}
                >
                  {t('cycleCard.sizeOf', {
                    defaultValue: 'Size of {{comparison}}',
                    comparison: localized?.comparison ?? baby.comparison,
                  })}
                </Text>
              )}
              <View className="flex-row items-center gap-3 mt-1.5">
                {baby?.lengthCm != null && (
                  <Text className="text-xs text-text-secondary">
                    <Text className="font-medium text-text-primary">
                      {t('cycleCard.cm', {
                        defaultValue: '{{value}} cm',
                        value: formatLocalizedNumber(baby.lengthCm),
                      })}
                    </Text>
                  </Text>
                )}
                {baby?.weightG != null && (
                  <Text className="text-xs text-text-secondary">
                    <Text className="font-medium text-text-primary">
                      {t('cycleCard.grams', {
                        defaultValue: '{{value}} g',
                        value: formatLocalizedNumber(baby.weightG),
                      })}
                    </Text>
                  </Text>
                )}
                <Text className="text-xs text-text-secondary">
                  {ga.daysRemaining > 0
                    ? t('cycleCard.daysToDue', {
                        defaultValue: '{{count}}d to due date',
                        count: ga.daysRemaining,
                      })
                    : t('cycleCard.dueNow', { defaultValue: 'Due now' })}
                </Text>
              </View>
            </View>
          </View>
        );
      }
      return (
        <View>
          <Text className="text-base font-semibold text-text-primary">
            {t('cycleCard.pregnancyActive', {
              defaultValue: 'Pregnancy Tracking Active',
            })}
          </Text>
          <Text className="text-sm text-text-secondary mt-0.5">
            {t('cycleCard.gestationalProgress', {
              defaultValue: 'Tap to view gestational progress.',
            })}
          </Text>
        </View>
      );
    }

    if (cycleInfo) {
      return <CycleCardRingContent info={cycleInfo} />;
    }

    return (
      <View>
        <Text className="text-base font-semibold text-text-primary capitalize">
          {getModeTitle(t, settings.mode, discreetMode)}
        </Text>
        <Text className="text-sm text-text-secondary mt-0.5">
          {t('cycleCard.hubProgress', {
            defaultValue: 'Tap to view cycle tracking hub.',
          })}
        </Text>
      </View>
    );
  };

  const openHub = () => {
    fireSelectionHaptic();
    navigation.navigate('CycleHub');
  };
  return (
    <>
      {intro(openHub)}
      <Pressable
        className="bg-surface rounded-xl p-4"
        onPress={openHub}
        accessibilityRole="button"
        accessibilityLabel={t('cycleCard.hubA11y', {
          defaultValue: 'Open cycle and pregnancy tracking hub',
        })}
      >
        {renderCardContent()}
      </Pressable>
    </>
  );
};

export default CycleCard;
