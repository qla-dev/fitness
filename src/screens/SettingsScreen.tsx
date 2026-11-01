import ProfileSummary from '../components/ProfileSummary';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
  type OnlineAccount,
} from '../services/online/account';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ActivityIndicator, Platform, Share } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { profileQueryKey } from '../hooks/queryKeys';
import { fetchProfile } from '../services/api/profileApi';
import { addLog } from '../services/LogService';
import { APP_LINK, profileLink } from '../utils/profileLink';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCSSVariable } from 'uniwind';
import { useServerConnection, usePreferences, queryClient } from '../hooks';
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
import { useDiscreetMode } from '../hooks/useDiscreetMode';

import type { RootStackScreenProps } from '../types/navigation';
import NativeHeaderScrollView from '../components/ui/NativeHeaderScrollView';

type SettingsScreenProps = RootStackScreenProps<'Profile'>;

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const onlineSession = useOnlineAccount((s) => s.session);
  const onlineAccountId = onlineSession?.user.id;
  useFocusEffect(
    useCallback(() => {
      if (onlineAccountId)
        void onlineRequest<OnlineAccount>('/account')
          .then(updateOnlineAccount)
          .catch(() => undefined);
    }, [onlineAccountId])
  );
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
    catSlate,
    catPink,
    catViolet,
    catCalories,
    catBlue,
    catAmber,
    catGreen,
    catTeal,
  ] = useCSSVariable([
    '--color-cat-slate',
    '--color-cat-pink',
    '--color-cat-violet',
    '--color-calories',
    '--color-cat-blue',
    '--color-cat-amber',
    '--color-cat-green',
    '--color-cat-teal',
  ]) as string[];
  // No two neighbouring icons on this screen share a colour, across group
  // edges and with optional rows hidden: AI coins amber · MarkAI violet;
  // Health sync pink · FitPass green; App slate · Calories · Cycle pink ·
  // Medications teal · Workout blue; What's new amber · Logs slate · About
  // teal · Share blue.

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

  // The header's share button hands the system sheet this person's profile
  // link. With no username there is no link yet, so it asks for one first.
  const profile = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
  }).data;
  const share = (message: string, what: string) => {
    Share.share({ message }).catch((error: unknown) => {
      void addLog(
        `[Profile] Could not open the share sheet for ${what}`,
        'WARNING',
        [error instanceof Error ? error.message : String(error)]
      );
    });
  };
  const shareProfile = () => {
    if (!profile?.username) {
      navigation.navigate('ProfileEdit', { field: 'username' });
      return;
    }
    share(profileLink(profile.username), 'the profile link');
  };

  const header = useScreenHeader({
    variant: 'transparent',
    title: t('profile.title', { defaultValue: 'Profile' }),
    nativeTitle: showHeaderTitle
      ? t('profile.title', { defaultValue: 'Profile' })
      : '',
    left: { kind: 'back' },
    right: {
      kind: 'icon',
      sfSymbol: 'square.and.arrow.up',
      ionicon: 'share-outline',
      accessibilityLabel: t('profile.shareProfile', {
        defaultValue: 'Share profile',
      }),
      identifier: 'profile-share',
      onPress: shareProfile,
    },
    borderless: true,
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <NativeHeaderScrollView
        showsVerticalScrollIndicator={false}
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
      >
        <View className={usesNativeHeader ? 'px-4' : 'flex-1 px-4 pt-4'}>
          <ProfileSummary enabled={isConnected} />
          <SettingsRowGroup
            title={t('profile.aiAssistant', { defaultValue: 'AI assistant' })}
          >
            <SettingsRow
              icon="ai-coin"
              iconColor={catAmber}
              title={t('online.coins', { defaultValue: 'AI coins' })}
              // Signed in, the balance; signed out, what an account brings.
              subtitle={
                onlineSession
                  ? t('online.balance', {
                      defaultValue: '{{amount}} AI coins',
                      amount: onlineSession.user.ai_coins,
                    })
                  : t('online.profileReward', {
                      defaultValue: '30 AI coins when you create your account',
                    })
              }
              onPress={() =>
                onlineSession
                  ? navigation.navigate('CoinPackages')
                  : navigation.navigate('OnlineAccount')
              }
            />
            <SettingsRow
              icon="sparkles"
              iconColor={catViolet}
              title={t('markai.title', { defaultValue: 'MarkAI' })}
              subtitle={t('markai.subtitle', {
                defaultValue: 'Macros, training help and free chat',
              })}
              onPress={() => navigation.navigate('MarkAI')}
            />
          </SettingsRowGroup>

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
                title={
                  Platform.OS === 'android'
                    ? t('settings.rows.healthConnectSync', {
                        defaultValue: 'Health Connect Data Sync',
                      })
                    : t('settings.rows.appleHealthSync', {
                        defaultValue: 'Apple Health Data Sync',
                      })
                }
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
                iconColor={catGreen}
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
                iconColor={catSlate}
              />
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
              {/* Both are stored on the device and synced with the account,
                  like the diary. */}
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
              <SettingsRow
                icon="medication"
                title={t('screens.library.medications', {
                  defaultValue: 'Medications',
                })}
                onPress={() => navigation.navigate('MedicationsList')}
                iconColor={catTeal}
              />

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
                iconColor={catAmber}
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
                iconColor={catTeal}
              />
              <SettingsRow
                icon="share"
                title={t('profile.shareApp', { defaultValue: 'Share app' })}
                subtitle={t('profile.shareAppSubtitle', {
                  defaultValue: 'Send qla.fit to a friend',
                })}
                onPress={() => share(APP_LINK, 'the app link')}
                iconColor={catBlue}
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
      </NativeHeaderScrollView>

      <FitPassConnectSheet ref={fitPassSheet} />
      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </View>
  );
};

export default SettingsScreen;
