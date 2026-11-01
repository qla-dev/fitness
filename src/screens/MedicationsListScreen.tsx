import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import HapticRefreshControl from '../components/HapticRefreshControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import {
  useCreateMedication,
  useCreateMedicationSchedule,
  useMedications,
} from '../hooks/useMedications';
import {
  isSetupWizardOpen,
  openSetupWizardSession,
} from '../services/setupWizardSession';
import {
  MEDICATION_SETUP_INITIAL,
  medicationFromAnswers,
  scheduleFromAnswers,
  medicationSteps,
} from '../constants/medicationSteps';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { trackingMenu } from '../utils/trackingMenu';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import Icon from '../components/Icon';
import FeatureFacts from '../components/FeatureFacts';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import MedicationRow from '../components/medications/MedicationRow';
import type { RootStackScreenProps } from '../types/navigation';
import type { Medication } from '@workspace/shared';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type MedicationsListScreenProps = RootStackScreenProps<'MedicationsList'>;

const MedicationsListScreen: React.FC<MedicationsListScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const [accentColor, iconDecorative] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-decorative',
  ]) as [string, string];
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: medications, isLoading, isError, refetch } = useMedications();
  const createMedication = useCreateMedication();
  const createSchedule = useCreateMedicationSchedule();
  // Whether medications show on the Tracker: what "Stop tracking" turns off.
  const tracking = useAppPreferencesStore((s) => s.medicationsCardVisible);
  const setTracking = useAppPreferencesStore(
    (s) => s.setMedicationsCardVisible
  );

  // A new medication is asked for as a questionnaire in the setup wizard;
  // it is created once, from the review page, never from an early close.
  const addMedication = useCallback(() => {
    if (isSetupWizardOpen()) return;
    let created: string | null = null;
    openSetupWizardSession({
      steps: medicationSteps(t),
      initial: MEDICATION_SETUP_INITIAL,
      enforceRequired: true,
      finishLabel: t('medications.addMedicationTitle', {
        defaultValue: 'Add Medication',
      }),
      onSave: async (answers, _done, finished) => {
        if (!finished) return;
        const medication = await createMedication.mutateAsync(
          medicationFromAnswers(answers, t)
        );
        created = medication.id;
        const schedule = scheduleFromAnswers(answers);
        if (schedule)
          await createSchedule.mutateAsync({
            medicationId: medication.id,
            body: schedule,
          });
        // A new medication is a reason to track again.
        setTracking(true);
      },
      onClose: () => {
        if (created)
          navigation.navigate('MedicationDetail', { medicationId: created });
      },
    });
    navigation.navigate('SetupWizard');
  }, [createMedication, createSchedule, navigation, setTracking, t]);

  const { active, inactive } = useMemo(() => {
    const meds = medications ?? [];
    return {
      active: meds.filter((m) => m.is_active),
      inactive: meds.filter((m) => !m.is_active),
    };
  }, [medications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('medications.title', { defaultValue: 'Medications' }),
    left: { kind: 'back' },
    right: [
      trackingMenu({
        t,
        identifier: 'medications-list-tracking',
        title: tracking
          ? t('medications.trackingTitle', {
              defaultValue:
                'Every dose in its place. Stop any time; your list stays here.',
            })
          : t('medications.trackingOffTitle', {
              defaultValue:
                'Medications are off your Tracker. Start tracking to bring them back.',
            }),
        tracking,
        confirmTitle: t('medications.stopTitle', {
          defaultValue: 'Stop medication tracking?',
        }),
        confirmMessage: t('medications.stopMessage', {
          defaultValue:
            'Medications leave your Tracker. Your medications and logged doses are kept, and you can start tracking again from here.',
        }),
        onStop: () => {
          setTracking(false);
          navigation.goBack();
        },
        onStart: () => setTracking(true),
      }),
      {
        kind: 'icon',
        sfSymbol: 'plus',
        ionicon: 'add-outline',
        role: 'primary',
        separated: true,
        onPress: addMedication,
        accessibilityLabel: t('medications.addMedication', {
          defaultValue: 'Add medication',
        }),
        identifier: 'medications-list-add',
      },
    ],
  });

  const renderMedItem = ({ item }: { item: Medication }) => (
    <MedicationRow
      medication={item}
      onPress={() =>
        navigation.navigate('MedicationDetail', { medicationId: item.id })
      }
    />
  );

  // The inactive section always renders its disclosure header; its rows
  // only appear once expanded.
  const sections: { key: 'active' | 'inactive'; data: Medication[] }[] = [
    { key: 'active', data: active },
  ];
  if (inactive.length > 0) {
    sections.push({ key: 'inactive', data: showInactive ? inactive : [] });
  }

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-base">
            {t('medications.loading', {
              defaultValue: 'Loading medications...',
            })}
          </Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-text-muted text-base text-center">
            {t('medications.loadFailed', {
              defaultValue: 'Failed to load medications.',
            })}
          </Text>
          <TouchableOpacity onPress={() => void refetch()} className="mt-4">
            <Text className="text-accent-primary text-base font-medium">
              {t('medications.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : active.length === 0 && inactive.length === 0 ? (
        // Scrolls like the list, so the facts under the empty state are
        // reachable on a short screen.
        <NativeHeaderScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
          }}
        >
          <View className="items-center p-8">
            <Icon name="medication" size={48} color={iconDecorative} />
            <Text className="text-text-muted text-lg mt-4 text-center">
              {t('medications.noMedications', {
                defaultValue: 'No medications yet',
              })}
            </Text>
            <Text className="text-text-muted text-sm mt-2 text-center">
              {t('medications.emptyDescription', {
                defaultValue: 'Add your first medication to start tracking.',
              })}
            </Text>
            <TouchableOpacity
              className="mt-4 bg-accent-primary px-6 py-3 rounded-xl"
              onPress={addMedication}
            >
              <Text className="text-white font-semibold">
                {t('medications.addMedicationTitle', {
                  defaultValue: 'Add Medication',
                })}
              </Text>
            </TouchableOpacity>
          </View>
          <FeatureFacts feature="medications" className="px-4" />
          <View className="px-4">
            <MedicalDisclaimer />
          </View>
        </NativeHeaderScrollView>
      ) : (
        <SectionList
          showsVerticalScrollIndicator={false}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderMedItem}
          renderSectionHeader={({ section }) =>
            section.key === 'inactive' ? (
              <TouchableOpacity
                className="flex-row items-center px-4 pt-4 pb-1"
                onPress={() => setShowInactive((value) => !value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: showInactive }}
                accessibilityLabel={t('medications.inactiveA11y', {
                  defaultValue: 'Inactive medications ({{count}})',
                  count: inactive.length,
                })}
              >
                <Text className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  {t('medications.inactiveCount', {
                    defaultValue: 'Inactive ({{count}})',
                    count: inactive.length,
                  })}
                </Text>
                <Icon
                  name={showInactive ? 'chevron-down' : 'chevron-forward'}
                  size={12}
                  color={iconDecorative}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            ) : null
          }
          ListFooterComponent={
            <>
              <FeatureFacts feature="medications" className="px-4" />
              <View className="px-4">
                <MedicalDisclaimer />
              </View>
            </>
          }
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
          }}
          contentInsetAdjustmentBehavior={
            usesNativeHeader ? 'automatic' : 'never'
          }
          automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
          refreshControl={
            <HapticRefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
            />
          }
        />
      )}
    </View>
  );
};

export default MedicationsListScreen;
