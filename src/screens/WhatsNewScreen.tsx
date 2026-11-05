import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import CoverFact from '../components/CoverFact';
import Icon, { type IconName } from '../components/Icon';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import type { RootStackScreenProps } from '../types/navigation';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type WhatsNewScreenProps = RootStackScreenProps<'WhatsNew'>;

type Feature = {
  eyebrow: string;
  headline: string;
  body: string;
  hero: React.ReactNode;
  cta?: { label: string; onPress: () => void };
};

const WidgetMockup: React.FC = () => {
  const { t } = useTranslation();
  const [
    calorieColor,
    catViolet,
    macroProtein,
    macroCarbs,
    macroFat,
    hydration,
    exercise,
    catPink,
    catOrange,
  ] = useCSSVariable([
    '--color-calories',
    '--color-cat-violet',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
    '--color-hydration',
    '--color-exercise',
    '--color-cat-pink',
    '--color-cat-orange',
  ]) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const iconPositions: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    color: string;
  }[] = [
    { top: 14, left: 24, color: macroProtein },
    { top: 14, left: 68, color: macroCarbs },
    { top: 14, right: 68, color: macroFat },
    { top: 14, right: 24, color: hydration },
    { top: 75, left: 18, color: exercise },
    { top: 75, right: 18, color: catPink },
    { bottom: 14, left: 24, color: catOrange },
    { bottom: 14, left: 68, color: hydration },
    { bottom: 14, right: 68, color: macroProtein },
    { bottom: 14, right: 24, color: macroCarbs },
  ];

  return (
    <View
      className="h-44 items-center justify-center overflow-hidden"
      style={{ backgroundColor: `${catViolet}20` }}
    >
      {iconPositions.map((pos, i) => (
        <View
          key={i}
          className="absolute rounded-md"
          style={{
            width: 22,
            height: 22,
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            right: pos.right,
            backgroundColor: pos.color,
            opacity: 0.5,
          }}
        />
      ))}

      <View
        className="bg-surface rounded-2xl shadow-md justify-center px-4"
        style={{ width: 140, height: 124 }}
      >
        <Text className="text-xs font-semibold tracking-wider text-text-secondary mb-0.5">
          {t('whatsNewPage.mockup.today', { defaultValue: 'TODAY' })}
        </Text>
        <Text
          className="text-2xl font-bold text-text-primary"
          style={{ color: calorieColor }}
        >
          {t('whatsNewPage.mockup.caloriesLeftValue', {
            defaultValue: '1,515',
          })}
        </Text>
        <Text className="text-xs text-text-secondary mb-2">
          {t('whatsNewPage.mockup.kcalLeft', { defaultValue: 'kcal left' })}
        </Text>
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-xs text-text-secondary">
              {t('whatsNewPage.mockup.in', { defaultValue: 'In' })}
            </Text>
            <Text className="text-xs font-medium text-text-primary">
              {t('whatsNewPage.mockup.caloriesInValue', {
                defaultValue: '1,540',
              })}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-text-secondary">
              {t('whatsNewPage.mockup.out', { defaultValue: 'Out' })}
            </Text>
            <Text className="text-xs font-medium text-text-primary">
              {t('whatsNewPage.mockup.caloriesOutValue', {
                defaultValue: '255',
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const ChatMockup: React.FC = () => {
  const { t } = useTranslation();
  const [catViolet, accentPrimary, accentText] = useCSSVariable([
    '--color-cat-violet',
    '--color-accent-primary',
    '--color-accent-text',
  ]) as [string, string, string];

  return (
    <View
      className="h-44 justify-center px-6"
      style={{ backgroundColor: `${catViolet}20` }}
    >
      <View className="self-end bg-surface rounded-2xl rounded-tr-md shadow-sm px-3.5 py-2.5 mb-3 max-w-[75%]">
        <Text className="text-[13px] text-text-primary">
          {t('whatsNewPage.mockup.chatQuestion', {
            defaultValue: 'What can I have for dinner with 500 calories left?',
          })}
        </Text>
      </View>

      <View className="flex-row items-end self-start max-w-[82%]">
        <View
          className="rounded-full items-center justify-center mr-2 shadow-sm"
          style={{ width: 28, height: 28, backgroundColor: accentPrimary }}
        >
          <Icon
            name="sparkles"
            size={14}
            color={accentText}
            weight="semibold"
          />
        </View>
        <View
          className="rounded-2xl rounded-bl-md shadow-sm px-3.5 py-2.5"
          style={{ backgroundColor: accentPrimary }}
        >
          <Text className="text-[13px]" style={{ color: accentText }}>
            {t('whatsNewPage.mockup.chatAnswer', {
              defaultValue:
                'Grilled salmon with a side salad keeps you right around 480 kcal.',
            })}
          </Text>
        </View>
      </View>
    </View>
  );
};

const PhotoMockup: React.FC = () => {
  const { t } = useTranslation();
  const [catOrange, macroProtein, macroCarbs, macroFat, textPrimary] =
    useCSSVariable([
      '--color-cat-orange',
      '--color-macro-protein',
      '--color-macro-carbs',
      '--color-macro-fat',
      '--color-text-primary',
    ]) as [string, string, string, string, string];

  return (
    <View
      className="h-44 items-center justify-center"
      style={{ backgroundColor: `${catOrange}20` }}
    >
      <View
        className="bg-surface rounded-2xl shadow-md overflow-hidden"
        style={{ width: 200, height: 132, transform: [{ rotate: '-3deg' }] }}
      >
        <View
          className="absolute"
          style={{
            left: 60,
            top: 22,
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: `${textPrimary}12`,
          }}
        />
        <View
          className="absolute"
          style={{
            left: 70,
            top: 32,
            width: 42,
            height: 36,
            borderRadius: 18,
            backgroundColor: macroProtein,
          }}
        />
        <View
          className="absolute"
          style={{
            left: 96,
            top: 56,
            width: 46,
            height: 36,
            borderRadius: 18,
            backgroundColor: macroCarbs,
          }}
        />
        <View
          className="absolute"
          style={{
            left: 62,
            top: 68,
            width: 32,
            height: 30,
            borderRadius: 15,
            backgroundColor: macroFat,
          }}
        />
        <View
          className="absolute rounded-full items-center justify-center"
          style={{
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            backgroundColor: catOrange,
          }}
        >
          <Icon name="whats-new" size={12} color="#FFFFFF" weight="semibold" />
        </View>
      </View>

      <View
        className="bg-surface rounded-full px-3 py-1.5 shadow-md flex-row items-center"
        style={{
          position: 'absolute',
          bottom: 22,
          right: 28,
          transform: [{ rotate: '2deg' }],
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: catOrange,
            marginRight: 6,
          }}
        />
        <Text className="text-xs font-semibold text-text-primary">
          {t('whatsNewPage.mockup.estimatedCalories', {
            defaultValue: '~412 kcal',
          })}
        </Text>
      </View>
    </View>
  );
};

const CycleMockup: React.FC = () => {
  const { t } = useTranslation();
  const [catPink, textSecondary] = useCSSVariable([
    '--color-cat-pink',
    '--color-text-secondary',
  ]) as [string, string];

  return (
    <View
      className="h-44 items-center justify-center overflow-hidden"
      style={{ backgroundColor: `${catPink}20` }}
    >
      <View
        className="bg-surface rounded-2xl shadow-md justify-center px-4 py-3 border border-border-subtle"
        style={{ width: 220, height: 110 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <View
              className="w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: `${catPink}30` }}
            >
              <Icon name="sparkles" size={14} color={catPink} />
            </View>
            <Text className="text-xs font-bold text-text-primary">
              {t('whatsNewPage.mockup.lutealPhase', {
                defaultValue: 'Luteal Phase',
              })}
            </Text>
          </View>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${catPink}25` }}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{ color: catPink }}
            >
              {t('whatsNewPage.mockup.day18', { defaultValue: 'Day 18' })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-1 pt-2 border-t border-border-subtle">
          <Text className="text-[11px]" style={{ color: textSecondary }}>
            {t('whatsNewPage.mockup.symptomFlowLog', {
              defaultValue: 'Symptom & Flow Log',
            })}
          </Text>
          <Text className="text-[11px] font-medium text-text-primary">
            {t('whatsNewPage.mockup.mildNormal', {
              defaultValue: 'Mild • Normal',
            })}
          </Text>
        </View>
      </View>
    </View>
  );
};

type MockupRowProps = {
  color: string;
  icon: IconName;
  title: string;
  badge: string;
  detail: string;
  value: string;
};

/** The small card every feature hero here draws: a titled row over a detail line. */
const MockupCard: React.FC<MockupRowProps> = ({
  color,
  icon,
  title,
  badge,
  detail,
  value,
}) => {
  const textSecondary = useCSSVariable('--color-text-secondary') as string;
  return (
    <View
      className="h-44 items-center justify-center overflow-hidden"
      style={{ backgroundColor: `${color}20` }}
    >
      <View
        className="bg-surface rounded-2xl shadow-md justify-center px-4 py-3 border border-border-subtle"
        style={{ width: 220, height: 110 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2 flex-1 mr-2">
            <View
              className="w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: `${color}30` }}
            >
              <Icon name={icon} size={14} color={color} />
            </View>
            <Text
              className="text-xs font-bold text-text-primary flex-1"
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}25` }}
          >
            <Text className="text-[10px] font-semibold" style={{ color }}>
              {badge}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-1 pt-2 border-t border-border-subtle">
          <Text className="text-[11px]" style={{ color: textSecondary }}>
            {detail}
          </Text>
          <Text className="text-[11px] font-medium text-text-primary">
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
};

const ProgramsMockup: React.FC = () => {
  const { t } = useTranslation();
  const exercise = useCSSVariable('--color-exercise') as string;
  return (
    <MockupCard
      color={exercise}
      icon="exercise-weights"
      title={t('whatsNewPage.mockup.programName', {
        defaultValue: 'Strength Foundations',
      })}
      badge={t('whatsNewPage.mockup.programWeeks', {
        defaultValue: '8 weeks',
      })}
      detail={t('whatsNewPage.mockup.programSessions', {
        defaultValue: '3 sessions a week',
      })}
      value={t('whatsNewPage.mockup.programNutrition', {
        defaultValue: '+ Nutrition plan',
      })}
    />
  );
};

const RunRideMockup: React.FC = () => {
  const { t } = useTranslation();
  const catOrange = useCSSVariable('--color-cat-orange') as string;
  return (
    <MockupCard
      color={catOrange}
      icon="exercise-running"
      title={t('whatsNewPage.mockup.morningRun', {
        defaultValue: 'Morning run',
      })}
      badge={t('whatsNewPage.mockup.runDistance', {
        defaultValue: '5.2 km',
      })}
      detail={t('whatsNewPage.mockup.runPace', {
        defaultValue: '5\'12" /km • 148 bpm',
      })}
      value={t('whatsNewPage.mockup.runTime', { defaultValue: '27:04' })}
    />
  );
};

const MedicationsMockup: React.FC = () => {
  const { t } = useTranslation();
  const [catTeal, textSecondary] = useCSSVariable([
    '--color-cat-teal',
    '--color-text-secondary',
  ]) as [string, string];

  return (
    <View
      className="h-44 items-center justify-center overflow-hidden"
      style={{ backgroundColor: `${catTeal}20` }}
    >
      <View
        className="bg-surface rounded-2xl shadow-md justify-center px-4 py-3 border border-border-subtle"
        style={{ width: 220, height: 110 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <View
              className="w-7 h-7 rounded-full items-center justify-center"
              style={{ backgroundColor: `${catTeal}30` }}
            >
              <Icon name="medication" size={14} color={catTeal} />
            </View>
            <Text className="text-xs font-bold text-text-primary">
              {t('whatsNewPage.mockup.fauxprofen', {
                defaultValue: 'Fauxprofen',
              })}
            </Text>
          </View>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${catTeal}25` }}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{ color: catTeal }}
            >
              {t('whatsNewPage.mockup.eightAm', { defaultValue: '8:00 AM' })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-1 pt-2 border-t border-border-subtle">
          <Text className="text-[11px]" style={{ color: textSecondary }}>
            {t('whatsNewPage.mockup.dailyDose', {
              defaultValue: '200 mg • Daily',
            })}
          </Text>
          <Text className="text-[11px] font-medium text-text-primary">
            {t('whatsNewPage.mockup.taken', { defaultValue: 'Taken' })}
          </Text>
        </View>
      </View>
    </View>
  );
};

const WhatsNewScreen: React.FC<WhatsNewScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();

  // Added or changed a card below? Bump WHATS_NEW_CONTENT_VERSION in
  // services/whatsNewBanner.ts so the banner re-appears for existing users.
  const features: Feature[] = [
    {
      eyebrow: t('whatsNewPage.features.medications.eyebrow', {
        defaultValue: 'MEDICATIONS',
      }),
      headline: t('whatsNewPage.features.medications.headline', {
        defaultValue: 'Track your medications',
      }),
      body: t('whatsNewPage.features.medications.body', {
        defaultValue:
          'Add your medications, set dose schedules, and log each dose from the dashboard with optional reminders.',
      }),
      hero: <MedicationsMockup />,
      cta: {
        label: t('whatsNewPage.features.medications.cta', {
          defaultValue: 'Set up medications',
        }),
        onPress: () => navigation.navigate('MedicationsList'),
      },
    },
    {
      eyebrow: t('whatsNewPage.features.cycle.eyebrow', {
        defaultValue: 'CYCLE & PREGNANCY',
      }),
      headline: t('whatsNewPage.features.cycle.headline', {
        defaultValue: 'Track your cycle & pregnancy',
      }),
      body: t('whatsNewPage.features.cycle.body', {
        defaultValue:
          'Comprehensive tracking for cycle phases, symptoms, flow, and pregnancy progress with tailored insights and goal adjustments.',
      }),
      hero: <CycleMockup />,
    },
    {
      eyebrow: t('whatsNewPage.features.programs.eyebrow', {
        defaultValue: 'TRAINING PROGRAMS',
      }),
      headline: t('whatsNewPage.features.programs.headline', {
        defaultValue: 'Ready-made programs',
      }),
      body: t('whatsNewPage.features.programs.body', {
        defaultValue:
          'Browse 21 training programs in the Exercises tab, each with its sessions and a nutrition plan, and start one in a tap.',
      }),
      hero: <ProgramsMockup />,
      cta: {
        label: t('whatsNewPage.features.programs.cta', {
          defaultValue: 'Browse programs',
        }),
        onPress: () => navigation.navigate('Tabs', { screen: 'Exercises' }),
      },
    },
    {
      eyebrow: t('whatsNewPage.features.runRide.eyebrow', {
        defaultValue: 'RUNNING & CYCLING',
      }),
      headline: t('whatsNewPage.features.runRide.headline', {
        defaultValue: 'Record runs and rides',
      }),
      body: t('whatsNewPage.features.runRide.body', {
        defaultValue:
          'Track distance, pace, speed and your GPS route live, with Bluetooth heart-rate and cadence sensors. Every session lands in your diary.',
      }),
      hero: <RunRideMockup />,
    },
    {
      eyebrow: t('whatsNewPage.features.chat.eyebrow', {
        defaultValue: 'ASK MARKAI',
      }),
      headline: t('whatsNewPage.features.chat.headline', {
        defaultValue: 'Chat with your AI coach',
      }),
      body: t('whatsNewPage.features.chat.body', {
        defaultValue:
          'Ask MarkAI to log meals, plan what to eat, and answer questions about your day through chat.',
      }),
      hero: <ChatMockup />,
      cta: {
        label: t('whatsNewPage.features.chat.cta', {
          defaultValue: 'Start chatting',
        }),
        onPress: () => navigation.navigate('MarkAI'),
      },
    },
    {
      eyebrow: t('whatsNewPage.features.widget.eyebrow', {
        defaultValue: 'HOME SCREEN WIDGET',
      }),
      headline: t('whatsNewPage.features.widget.headline', {
        defaultValue: 'Calories on your home screen',
      }),
      body: t('whatsNewPage.features.widget.body', {
        defaultValue:
          "See where your day stands at a glance. Add qla.fit from your home screen's widget gallery.",
      }),
      hero: <WidgetMockup />,
    },
    {
      eyebrow: t('whatsNewPage.features.photo.eyebrow', {
        defaultValue: 'AI PHOTO SCAN',
      }),
      headline: t('whatsNewPage.features.photo.headline', {
        defaultValue: 'Snap a meal, log the macros',
      }),
      body: t('whatsNewPage.features.photo.body', {
        defaultValue:
          "Estimate nutrition from a photo when you're short on time.",
      }),
      hero: <PhotoMockup />,
      cta: {
        label: t('whatsNewPage.features.photo.cta', {
          defaultValue: 'Try it out',
        }),
        // Logging from a photo happens in MarkAI, where the meal photo is one
        // attachment away, the same place the Add hub sends it.
        onPress: () => navigation.navigate('MarkAI'),
      },
    },
  ];

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('whatsNewPage.title', { defaultValue: "What's New" }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16 + activeWorkoutBarPadding,
        }}
      >
        {features.map((feature) => (
          <CoverFact
            key={feature.headline}
            title={feature.headline}
            body={feature.body}
            eyebrow={feature.eyebrow}
            hero={feature.hero}
            cta={feature.cta}
          />
        ))}
      </NativeHeaderScrollView>
    </View>
  );
};

export default WhatsNewScreen;
