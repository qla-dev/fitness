import React, { useRef } from 'react';
import { View, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNativeHeaderOffset,
  useScreenHeader,
  SAVE_LABEL,
  SAVING_LABEL,
} from '../hooks/useScreenHeader';
import { useCycleMode } from '../hooks/useCycleMode';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { RootStackScreenProps } from '../types/navigation';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import CycleTodayView from '../components/wellness/CycleTodayView';
import PregnancyLogView from '../components/wellness/pregnancy/PregnancyLogView';
import FertilityCard from '../components/wellness/ttc/FertilityCard';
import TestQuickLog from '../components/wellness/ttc/TestQuickLog';
import DateSelectRow from '../components/DateSelectRow';
import RingCalendarSheet, {
  type RingCalendarSheetRef,
} from '../components/RingCalendarSheet';
import { FooterSaveBar } from '../components/FormScreenChrome';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import FooterCTA from '../components/ui/FooterCTA';
import CycleStartSheet from '../components/wellness/CycleStartSheet';
import { getAppLocale } from '../localization';
import { useTranslation } from 'react-i18next';
import {
  ScrollEdgeEffectProvider,
  useScrollEdgeEffectRef,
} from '@bsky.app/expo-scroll-edge-effect';

import { useDiscreetMode } from '../hooks/useDiscreetMode';

type CycleLogModalScreenProps = RootStackScreenProps<'CycleLogModal'>;

// Ties the scroll view to the floating footer, so with Liquid Glass the
// action sits over the scroll edge effect instead of a filled band.
const CycleLogModalScreen: React.FC<CycleLogModalScreenProps> = (props) => (
  <ScrollEdgeEffectProvider>
    <CycleLogModalContent {...props} />
  </ScrollEdgeEffectProvider>
);

const CycleLogModalContent: React.FC<CycleLogModalScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const headerOffset = useNativeHeaderOffset();
  const { mode } = useCycleMode();
  const { discreetMode } = useDiscreetMode();
  const calendarRef = useRef<RingCalendarSheetRef>(null);
  const [selectedDate, setSelectedDate] = React.useState(
    route.params?.date || getTodayDate()
  );

  // The footer logs a cycle starting on this entry's date, in its own sheet.
  // Cycle tracking only: pregnancy has no cycle to start.
  const offersCycleStart = mode !== 'pregnant';
  const [startSheetOpen, setStartSheetOpen] = React.useState(false);
  const [footerHeight, setFooterHeight] = React.useState(88);
  const edgeEffectRef = useScrollEdgeEffectRef();

  // Save lives in CycleTodayView; the header/footer buttons trigger it here.
  const saveRequestRef = useRef<(() => void) | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const headerTitle = React.useMemo(() => {
    if (discreetMode) return 'Log Entry';
    if (mode === 'pregnant') return 'Log Pregnancy Entry';
    if (mode === 'ttc') return 'Log Fertility & Test';
    return 'Log Daily Entry';
  }, [discreetMode, mode]);

  const header = useScreenHeader({
    variant: 'transparent',
    title: headerTitle,
    nativeTitle: headerTitle,
    left: { kind: 'dismiss', onPress: () => navigation.goBack() },
    right: {
      kind: 'primary',
      label: SAVE_LABEL,
      busyLabel: SAVING_LABEL,
      busy: isSaving,
      disabled: isSaving,
      placement: 'native-only',
      onPress: () => saveRequestRef.current?.(),
      identifier: 'cycle-log-save',
    },
  });

  return (
    <View
      className="flex-1 bg-background"
      // iOS keeps no top inset even without the native header: this modal
      // sheet already starts below the status bar.
      style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}
    >
      {header}

      <KeyboardAwareScrollView
        ref={edgeEffectRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          // KeyboardAwareScrollView ignores contentInsetAdjustmentBehavior,
          // so the content starts below the transparent bar by hand.
          paddingTop: usesNativeHeader ? headerOffset : 0,
          // The floating footer covers the end of the entry, so it ends above.
          paddingBottom:
            offersCycleStart && usesNativeHeader
              ? footerHeight + 16
              : insets.bottom + 40,
        }}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          {/* Date card; pregnancy mode shows the date inside its weight card instead */}
          {mode !== 'pregnant' && (
            <View className="bg-surface rounded-xl p-4 border-0">
              <DateSelectRow
                date={selectedDate}
                onPress={() => calendarRef.current?.present()}
              />
            </View>
          )}

          {/* Mode-aware entry view */}
          {mode === 'pregnant' && (
            <PregnancyLogView
              date={selectedDate}
              onSaveSuccess={() => navigation.goBack()}
              saveRequestRef={saveRequestRef}
              onSavingChange={setIsSaving}
              onDatePress={() => calendarRef.current?.present()}
              hideSaveButton
            />
          )}

          {mode === 'ttc' && (
            <>
              <FertilityCard date={selectedDate} />
              <TestQuickLog date={selectedDate} />
              <CycleTodayView
                date={selectedDate}
                onSaveSuccess={() => navigation.goBack()}
                saveRequestRef={saveRequestRef}
                onSavingChange={setIsSaving}
                hideSaveButton
              />
            </>
          )}

          {mode !== 'pregnant' && mode !== 'ttc' && (
            <>
              <FertilityCard date={selectedDate} />
              <CycleTodayView
                date={selectedDate}
                onSaveSuccess={() => navigation.goBack()}
                saveRequestRef={saveRequestRef}
                onSavingChange={setIsSaving}
                hideSaveButton
              />
            </>
          )}
        </View>

        <View className="mt-6 px-2">
          <MedicalDisclaimer />
        </View>
      </KeyboardAwareScrollView>

      {offersCycleStart ? (
        <>
          <FooterCTA
            // Floats over the entry when Save is in the native bar; above the
            // sticky Save bar otherwise, so the two never overlap.
            absolute={usesNativeHeader}
            glass
            edgeEffect={usesNativeHeader}
            onHeightChange={setFooterHeight}
            label={t('cycleHub.logStart', {
              defaultValue: 'Log the cycle start · {{date}}',
              date: formatDate(selectedDate, getAppLocale()),
            })}
            onPress={() => setStartSheetOpen(true)}
          />
          <CycleStartSheet
            open={startSheetOpen}
            date={selectedDate}
            onClose={() => setStartSheetOpen(false)}
          />
        </>
      ) : null}

      {/* Sticky footer save; the native-header path shows Save in the nav bar */}
      {!usesNativeHeader && (
        <FooterSaveBar
          onPress={() => saveRequestRef.current?.()}
          disabled={isSaving}
          busy={isSaving}
        />
      )}

      {/* The Activities calendar in its plain-picker mode: same month pager
          and round day cells, no rings, no future days. */}
      <RingCalendarSheet
        ref={calendarRef}
        rings={false}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    </View>
  );
};

export default CycleLogModalScreen;
