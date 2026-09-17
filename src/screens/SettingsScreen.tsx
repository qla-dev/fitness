import ProfileSummary from '../components/ProfileSummary';
import ProfileSetup from '../components/ProfileSetup';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCSSVariable } from 'uniwind';
import {
  useServerConnection,
  useServerConfigs,
  usePreferences,
  queryClient,
} from '../hooks';
import DevTools from '../components/DevTools';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import FitPassConnectSheet, {
  type FitPassConnectSheetRef,
} from '../components/FitPassConnectSheet';
import { SectionErrorBoundary } from '../components/ScreenErrorBoundary';
import {
  shareDiagnosticReport,
  sanitizeQueryKey,
} from '../services/diagnosticReportService';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { loadLastSyncedTime } from '../services/storage';
import { formatRelativeTime } from '../utils/dateUtils';
import type { DiagnosticQueryState } from '../types/diagnosticReport';
import Constants from 'expo-constants';
import { isLocalDataMode } from '../services/dataMode';
import { useDiscreetMode } from '../hooks/useDiscreetMode';

import type { RootStackScreenProps } from '../types/navigation';

type SettingsScreenProps = RootStackScreenProps<'Profile'>;

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);

  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const fitPassSheet = React.useRef<FitPassConnectSheetRef>(null);

  const { isConnected } = useServerConnection();
  const { activeConfig } = useServerConfigs();
  const { preferences: userPreferences } = usePreferences({
    enabled: isConnected,
  });
  const { discreetMode } = useDiscreetMode();
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadLastSyncedTime().then((time) => {
        if (!cancelled) setLastSyncedTime(time);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const syncSubtitle = lastSyncedTime
    ? t('settings.lastSynced', {
        defaultValue: 'Last synced {{time}}',
        time: formatRelativeTime(new Date(lastSyncedTime), t, dateLocale),
      })
    : t('date.neverSynced', { defaultValue: 'Never synced' });

  const [
    success,
    danger,
    catSlate,
    catPink,
    catViolet,
    catOrange,
    catCalories,
    hydration,
    macroGreen,
    catTeal,
    catBlue,
  ] = useCSSVariable([
    '--color-icon-success',
    '--color-bg-danger',
    '--color-cat-slate',
    '--color-cat-pink',
    '--color-cat-violet',
    '--color-cat-orange',
    '--color-calories',
    '--color-hydration',
    '--color-cat-green',
    '--color-cat-teal',
    '--color-cat-blue',
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
    string,
    string,
  ];

  const serverSubtitle = activeConfig ? (
    <View className="flex-row items-center">
      <View
        className="w-2 h-2 rounded-full mr-2"
        style={{ backgroundColor: isConnected ? success : danger }}
      />
      <Text
        className="text-sm text-text-secondary flex-1"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {activeConfig.url}
      </Text>
    </View>
  ) : (
    t('settings.addServer', { defaultValue: 'Tap to add a server' })
  );

  const handleShareDiagnosticReport = async (): Promise<void> => {
    setIsSharing(true);
    try {
      const queryStates: DiagnosticQueryState[] = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => ({
          queryKey: JSON.stringify(sanitizeQueryKey(query.queryKey)),
          status: query.state.status,
          fetchStatus: query.state.fetchStatus,
          isStale: query.isStale(),
          errorMessage:
            query.state.error instanceof Error
              ? query.state.error.message
              : query.state.error
                ? String(query.state.error)
                : null,
        }));

      await shareDiagnosticReport({
        isServerConnected: isConnected,
        userPreferences: userPreferences ?? null,
        queryStates,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Toast.show({
        type: 'error',
        text1: t('common.error', { defaultValue: 'Error' }),
        text2: t('settings.shareReportFailed', {
          defaultValue: 'Failed to share diagnostic report: {{error}}',
          error: errorMessage,
        }),
      });
    } finally {
      setIsSharing(false);
    }
  };

  const header = useScreenHeader({
    title: t('profile.title', { defaultValue: 'Profile' }),
    nativeTitle: showHeaderTitle
      ? t('profile.title', { defaultValue: 'Profile' })
      : '',
    left: { kind: 'back' },
    borderless: true,
    nativeOptions: {
      headerLargeTitleEnabled: false,
      headerLargeTitleShadowVisible: false,
      headerTransparent: true,
      headerShadowVisible: false,
    },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          ...(!usesNativeHeader ? { paddingTop: 0 } : null),
          paddingBottom: 16 + activeWorkoutBarPadding,
        }}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const offset =
            nativeEvent.contentOffset.y + nativeEvent.contentInset.top;
          setShowHeaderTitle(offset > 16);
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        automaticallyAdjustsScrollIndicatorInsets={usesNativeHeader}
      >
        <View className={usesNativeHeader ? 'px-4' : 'flex-1 px-4 pt-4'}>
          <ProfileSummary enabled={isConnected} />
          <ProfileSetup enabled={isConnected} />

          {!isLocalDataMode() && (
            <SettingsRow
              icon="server"
              title={t('settings.rows.server', { defaultValue: 'Server' })}
              subtitle={serverSubtitle}
              onPress={() => navigation.navigate('ServerSettings')}
              iconColor={catSlate}
              accessibilityLabel={
                activeConfig
                  ? isConnected
                    ? t('settings.serverConnected', {
                        defaultValue: 'Server settings. Connected.',
                      })
                    : t('settings.serverConnectionFailed', {
                        defaultValue: 'Server settings. Connection failed.',
                      })
                  : t('settings.serverNotConfigured', {
                      defaultValue: 'Server settings. No server configured.',
                    })
              }
            />
          )}

          <SectionErrorBoundary
            sectionName={t('settings.title', { defaultValue: 'Settings' })}
          >
            {/* Connectors open the same modal the startup protocol presents,
                rather than pushing an inner settings screen: connecting a data
                source is a self-contained task you finish and dismiss. */}
            <SettingsRowGroup
              title={t('settings.connectors', { defaultValue: 'Connectors' })}
            >
              <SettingsRow
                icon="health-data-sync"
                title={t('settings.rows.appleHealthSync', {
                  defaultValue: 'Apple Health Data Sync',
                })}
                subtitle={syncSubtitle}
                onPress={() => navigation.navigate('AppleHealthCheck')}
                iconColor={catPink}
              />
              <SettingsRow
                icon="exercise-weights"
                title={t('settings.rows.fitPassSync', {
                  defaultValue: 'FitPass Sync',
                })}
                subtitle={t('fitPass.rowSubtitle', {
                  defaultValue: 'Bring your gym visits into the diary',
                })}
                onPress={() => fitPassSheet.current?.present()}
                iconColor={catSlate}
              />
            </SettingsRowGroup>

            <SettingsRowGroup
              title={t('profile.preferences', { defaultValue: 'Preferences' })}
            >
              <SettingsRow
                icon="app-settings"
                title={t('settings.rows.app', { defaultValue: 'App Settings' })}
                subtitle={t('profile.appSubtitle', {
                  defaultValue: 'Appearance, language, and notifications',
                })}
                onPress={() => navigation.navigate('AppSettings')}
                iconColor={catViolet}
              />
              {isConnected && (
                <SettingsRow
                  icon="people"
                  title={t('familyDiary.title', {
                    defaultValue: 'Family Diaries',
                  })}
                  onPress={() => navigation.navigate('FamilyMembers')}
                  iconColor={catTeal}
                />
              )}
              {isConnected && (
                <SettingsRow
                  icon="calorie-settings"
                  title={t('settings.rows.calories', {
                    defaultValue: 'Calories & BMR',
                  })}
                  subtitle={t('profile.caloriesSubtitle', {
                    defaultValue: 'Energy balance and calorie calculations',
                  })}
                  onPress={() => navigation.navigate('CalorieSettings')}
                  iconColor={catCalories}
                />
              )}
              {isConnected && (
                <SettingsRow
                  icon="food-search-settings"
                  title={t('settings.rows.food', { defaultValue: 'Food' })}
                  subtitle={t('profile.foodSubtitle', {
                    defaultValue: 'Search providers and food preferences',
                  })}
                  onPress={() => navigation.navigate('FoodSettings')}
                  iconColor={catOrange}
                />
              )}
              {isConnected && (
                <SettingsRow
                  icon="dashboard-settings"
                  title={t('settings.rows.dashboard', {
                    defaultValue: 'Activities',
                  })}
                  subtitle={t('profile.dashboardSubtitle', {
                    defaultValue: 'Cards, nutrients, and health trends',
                  })}
                  onPress={() => navigation.navigate('DashboardSettings')}
                  iconColor={macroGreen}
                />
              )}
              {isConnected && (
                <SettingsRow
                  icon="diary-settings"
                  title={t('settings.rows.diary', {
                    defaultValue: 'Nutrition',
                  })}
                  subtitle={t('profile.diarySubtitle', {
                    defaultValue: 'Meal types and diary layout',
                  })}
                  onPress={() => navigation.navigate('DiarySettings')}
                  iconColor={catTeal}
                />
              )}
              {isConnected && (
                <SettingsRow
                  icon="wellness"
                  title={
                    discreetMode
                      ? t('settings.rows.wellness', {
                          defaultValue: 'Wellness',
                        })
                      : t('settings.rows.cyclePregnancy', {
                          defaultValue: 'Cycle & Pregnancy',
                        })
                  }
                  onPress={() => navigation.navigate('CycleSettings')}
                  iconColor={catPink}
                />
              )}
              <SettingsRow
                icon="workout-settings"
                title={t('settings.rows.workout', { defaultValue: 'Workout' })}
                subtitle={t('profile.workoutSubtitle', {
                  defaultValue: 'Rest timers and workout preferences',
                })}
                onPress={() => navigation.navigate('WorkoutSettings')}
                iconColor={catBlue}
              />
            </SettingsRowGroup>

            <SettingsRowGroup
              title={t('profile.support', {
                defaultValue: 'Support & Information',
              })}
            >
              <SettingsRow
                icon="whats-new"
                title={t('settings.rows.whatsNew', {
                  defaultValue: "What's New",
                })}
                subtitle={t('profile.whatsNewSubtitle', {
                  defaultValue: 'Latest features and improvements',
                })}
                onPress={() => navigation.navigate('WhatsNew')}
                iconColor={catPink}
              />
              <SettingsRow
                icon="document-text"
                title={t('settings.rows.logs', { defaultValue: 'View Logs' })}
                subtitle={t('profile.logsSubtitle', {
                  defaultValue: 'Activity and troubleshooting logs',
                })}
                onPress={() => navigation.navigate('Logs')}
                iconColor={catSlate}
              />
              <SettingsRow
                icon="info-circle"
                title={t('settings.rows.about', { defaultValue: 'About' })}
                subtitle={t('profile.aboutSubtitle', {
                  defaultValue: 'App details and version information',
                })}
                onPress={() => navigation.navigate('About')}
                iconColor={hydration}
              />
            </SettingsRowGroup>

            <SettingsRow
              icon="share"
              title={t('settings.rows.shareReport', {
                defaultValue: 'Share Diagnostic Report',
              })}
              onPress={handleShareDiagnosticReport}
              disabled={isSharing}
              iconColor={catSlate}
              rightAccessory={
                isSharing ? <ActivityIndicator size="small" /> : undefined
              }
            />
            <Text className="text-text-secondary text-sm px-2 mb-4 mt-2">
              {t('settings.shareReportDescription', {
                defaultValue:
                  'Exports a local diagnostic report (app version, sync status, logs). No personal health or food data is included. Nothing is sent automatically.',
              })}
            </Text>

            {__DEV__ &&
              (Constants.expoConfig?.extra?.APP_VARIANT === 'development' ||
                Constants.expoConfig?.extra?.APP_VARIANT === 'dev') && (
                <DevTools />
              )}
          </SectionErrorBoundary>
        </View>
      </ScrollView>

      <FitPassConnectSheet ref={fitPassSheet} />
      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </View>
  );
};

export default SettingsScreen;
