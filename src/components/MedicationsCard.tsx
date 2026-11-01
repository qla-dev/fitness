import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ActivityIndicator } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SectionIntro from './SectionIntro';
import MealLogCard from './MealLogCard';
import { medicationTypeIcon } from '../constants/medicationSteps';
import { CARD_GAP } from '../constants/layout';
import { formatLocalizedNumber } from '../localization';
import {
  useMedications,
  useMedicationEntries,
  useLogDose,
} from '../hooks/useMedications';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import { getDueDosesForDate, formatDose } from '@workspace/shared';
import { getDeviceTimezone } from '../utils/dateUtils';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { formatLocalizedTimeOfDay } from '../utils/medicationScheduleLocalization';
import { medicationTypeLabel } from '../utils/medicationLocalization';
import { doseSlotStatus } from '../utils/medications';

type MedicationsCardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Diary'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MedicationsCardProps {
  navigation: MedicationsCardNavigation;
}

const typeLabelFor = (
  typeId: string | null,
  t: Parameters<typeof medicationTypeLabel>[1]
): string => medicationTypeLabel(typeId, t);

const MedicationsCard: React.FC<MedicationsCardProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);

  const { data: medications, isLoading: isLoadingMeds } = useMedications({
    activeOnly: true,
  });
  const { data: entries, isLoading: isLoadingEntries } = useMedicationEntries({
    fromDate: selectedDate,
    toDate: selectedDate,
  });
  const { entryForDue, logDose, toggleTaken, logPrn } = useLogDose(
    selectedDate,
    entries
  );

  const [accentPrimary] = useCSSVariable(['--color-accent-primary']) as [
    string,
  ];

  const dueDoses = useMemo(() => {
    if (!medications) return [];
    return getDueDosesForDate(medications, selectedDate, getDeviceTimezone());
  }, [medications, selectedDate]);

  const prnMeds = useMemo(() => {
    if (!medications) return [];
    return medications.filter((med) => {
      if (!med.is_active) return false;
      if (!med.schedules || med.schedules.length === 0) return true;
      return med.schedules.some((s) => s.schedule_type_id === 'prn');
    });
  }, [medications]);

  // The Tracker's section title, with the same "More" link the meals carry.
  const intro = (
    <SectionIntro
      testID="medications-intro"
      subtitle={t('medications.card.title', { defaultValue: 'Medications' })}
      actionLabel={t('measurements.more', { defaultValue: 'More' })}
      onPress={() => navigation.navigate('MedicationsList')}
    />
  );

  if (isLoadingMeds || isLoadingEntries) {
    return (
      <>
        {intro}
        <View className="bg-surface rounded-xl p-4 items-center">
          <ActivityIndicator size="small" color={accentPrimary} />
        </View>
      </>
    );
  }

  if (dueDoses.length === 0 && prnMeds.length === 0) return null;

  const openMedication = (medicationId: string) =>
    navigation.navigate('MedicationDetail', { medicationId });

  // One card per dose, the same card every meal gets: the dose is the thing
  // logged, so it carries the Log pill where a meal does.
  return (
    <>
      {intro}
      <View style={{ gap: CARD_GAP }}>
        {dueDoses.map((due) => {
          const med = due.medication;
          const status = doseSlotStatus(entryForDue(due));
          const subtitle = [
            due.schedule.time_of_day
              ? formatLocalizedTimeOfDay(due.schedule.time_of_day)
              : null,
            typeLabelFor(med.type_id, t),
            formatDose(med, due.schedule),
          ]
            .filter(Boolean)
            .join(' · ');
          const pending = status === 'pending';
          return (
            <MealLogCard
              key={`${med.id}-${due.schedule.id}`}
              icon={medicationTypeIcon(med.type_id)}
              label={med.name}
              subtitle={subtitle}
              onOpen={() => openMedication(med.id)}
              hideOverflow
              badge={
                pending
                  ? undefined
                  : status === 'taken'
                    ? t('medications.dose.taken', { defaultValue: 'Taken' })
                    : t('medications.dose.skipped', { defaultValue: 'Skipped' })
              }
              secondaryAction={
                pending
                  ? {
                      label: t('medications.dose.skip', {
                        defaultValue: 'Skip',
                      }),
                      accessibilityLabel: t('medications.dose.skipTitle', {
                        defaultValue: 'Skip {{title}}',
                        title: med.name,
                      }),
                      onPress: () => logDose(due, 'skipped'),
                    }
                  : undefined
              }
              // A logged dose keeps its pill as the undo, the way the circle
              // used to toggle it back.
              onLog={
                pending ? () => logDose(due, 'taken') : () => toggleTaken(due)
              }
              logLabel={
                pending
                  ? t('medications.dose.log', { defaultValue: 'Log' })
                  : t('medications.dose.undo', { defaultValue: 'Undo' })
              }
              logAccessibilityLabel={
                pending
                  ? t('medications.dose.logTaken', {
                      defaultValue: 'Log {{title}} as taken',
                      title: med.name,
                    })
                  : t('medications.dose.unmark', {
                      defaultValue: 'Unmark {{title}}',
                      title: med.name,
                    })
              }
            />
          );
        })}

        {prnMeds.map((med) => {
          const prnCount =
            entries?.filter(
              (e) =>
                e.medication_id === med.id &&
                e.status === 'prn_taken' &&
                e.entry_date === selectedDate
            ).length ?? 0;
          const subtitle = [typeLabelFor(med.type_id, t), formatDose(med)]
            .filter(Boolean)
            .join(' · ');
          return (
            <MealLogCard
              key={med.id}
              icon={medicationTypeIcon(med.type_id)}
              label={med.name}
              subtitle={subtitle}
              onOpen={() => openMedication(med.id)}
              hideOverflow
              // The day's count alone: the pill beside Log already says what
              // it counts.
              badge={prnCount > 0 ? formatLocalizedNumber(prnCount) : undefined}
              onLog={() => logPrn(med)}
              logLabel={t('medications.dose.log', { defaultValue: 'Log' })}
              logAccessibilityLabel={t('medications.dose.logTitle', {
                defaultValue: 'Log {{title}}',
                title: med.name,
              })}
            />
          );
        })}
      </View>
    </>
  );
};

export default MedicationsCard;
