import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import Button from './ui/Button';
import { resetWhatsNewBanner } from '../services/whatsNewBanner';
import { resetAnnouncementModal } from './AnnouncementModal';

const DevTools: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View className="bg-surface rounded-xl p-4 mb-4">
      <Text className="text-lg font-bold mb-3 text-text-primary">
        {t('devTools.title', { defaultValue: 'Dev Tools' })}
      </Text>
      <Text className="text-text-muted mb-3 text-[13px]">
        {t('devTools.description', {
          defaultValue: 'These tools are only visible in development builds.',
        })}
      </Text>

      <View className="mt-5">
        <Text className="text-sm text-text-primary">
          {t('devTools.whatsNew.title', { defaultValue: "What's New Banner" })}
        </Text>
        <Text className="text-text-muted mb-3 text-[13px]">
          {t('devTools.whatsNew.description', {
            defaultValue:
              'Clear the last-seen version so the banner re-appears above the tab bar.',
          })}
        </Text>
        <View className="flex-row gap-2 flex-wrap">
          <Button
            variant="primary"
            className="py-2 px-4 rounded-lg my-1 self-center min-w-30"
            onPress={async () => {
              await resetWhatsNewBanner();
              Toast.show({
                type: 'success',
                text1: t('devTools.toast.reset', { defaultValue: 'Reset' }),
                text2: t('devTools.toast.whatsNewReset', {
                  defaultValue: "What's New banner will re-appear.",
                }),
              });
            }}
          >
            <Text className="text-white text-base font-bold">
              {t('devTools.whatsNew.reset', { defaultValue: 'Reset Banner' })}
            </Text>
          </Button>
        </View>
      </View>

      <View className="mt-5">
        <Text className="text-sm text-text-primary">
          {t('devTools.announcement.title', {
            defaultValue: 'System Announcement',
          })}
        </Text>
        <Text className="text-text-muted mb-3 text-[13px]">
          {t('devTools.announcement.description', {
            defaultValue:
              'Clear the dismissed announcement flag so active system announcements re-appear.',
          })}
        </Text>
        <View className="flex-row gap-2 flex-wrap">
          <Button
            variant="primary"
            className="py-2 px-4 rounded-lg my-1 self-center min-w-30"
            onPress={async () => {
              try {
                await resetAnnouncementModal();
                Toast.show({
                  type: 'success',
                  text1: t('devTools.toast.reset', { defaultValue: 'Reset' }),
                  text2: t('devTools.toast.announcementReset', {
                    defaultValue: 'System announcement modal will re-appear.',
                  }),
                });
              } catch {
                Toast.show({
                  type: 'error',
                  text1: t('common.error', { defaultValue: 'Error' }),
                  text2: t('devTools.toast.announcementResetFailed', {
                    defaultValue: 'Could not reset announcement.',
                  }),
                });
              }
            }}
          >
            <Text className="text-white text-base font-bold">
              {t('devTools.announcement.reset', {
                defaultValue: 'Reset Announcement',
              })}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

export default DevTools;
