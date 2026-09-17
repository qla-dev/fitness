import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import CustomModal, { type CustomModalRef } from './CustomModal';
import Button from './ui/Button';
import Switch from './ui/Switch';
import Icon from './Icon';
import SettingsRow, { SettingsRowGroup } from './SettingsRow';
import MenuItemIcon from './MenuItemIcon';
import { fireSelectionHaptic } from '../services/haptics';
import {
  clearFitPassCredentials,
  loadFitPassCredentials,
  loadFitPassSyncEnabled,
  saveFitPassCredentials,
  saveFitPassSyncEnabled,
} from '../services/storage';

export interface FitPassConnectSheetRef {
  present: () => void;
  dismiss: () => void;
}

/**
 * FitPass connector, as a bottom sheet rather than a pushed screen: connecting
 * an account is a short, self-contained task you finish and dismiss, the same
 * shape every other sheet in the app uses.
 *
 * Nothing is connected yet — there is no FitPass client, so signing in stores
 * the details on the device and switches the connector on without making a
 * request. Replacing `connect` is all a real service needs; the storage, the
 * toggle and the disconnect path are already correct.
 *
 * The fields are `BottomSheetTextInput`, not the app's `FormInput`: a plain
 * TextInput inside a bottom sheet does not tell the sheet to move out of the
 * keyboard's way, so the field it focuses ends up underneath it.
 */
const FitPassConnectSheet = forwardRef<FitPassConnectSheetRef>(
  (_props, ref) => {
    const { t } = useTranslation();
    const sheet = useRef<CustomModalRef>(null);
    const [accentColor, textPrimary, textMuted, raised] = useCSSVariable([
      '--color-accent-primary',
      '--color-text-primary',
      '--color-text-muted',
      '--color-raised',
    ]) as [string, string, string, string];

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);

    useImperativeHandle(ref, () => ({
      present: () => sheet.current?.present(),
      dismiss: () => sheet.current?.dismiss(),
    }));

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const [credentials, enabled] = await Promise.all([
          loadFitPassCredentials(),
          loadFitPassSyncEnabled(),
        ]);
        if (cancelled) return;
        setUsername(credentials.username);
        setPassword(credentials.password);
        setSyncEnabled(enabled);
        setConnected(Boolean(credentials.username && credentials.password));
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    const canConnect = username.trim().length > 0 && password.length > 0;

    const connect = async () => {
      if (!canConnect || busy) return;
      fireSelectionHaptic();
      setBusy(true);
      try {
        await saveFitPassCredentials({ username: username.trim(), password });
        await saveFitPassSyncEnabled(true);
        setSyncEnabled(true);
        setConnected(true);
        sheet.current?.dismiss();
        Toast.show({
          type: 'success',
          text1: t('fitPass.connected', { defaultValue: 'FitPass connected' }),
          text2: t('fitPass.connectedDetail', {
            defaultValue:
              'Your visits will sync once the service is available.',
          }),
        });
      } finally {
        setBusy(false);
      }
    };

    const disconnect = async () => {
      fireSelectionHaptic();
      await clearFitPassCredentials();
      setUsername('');
      setPassword('');
      setSyncEnabled(false);
      setConnected(false);
    };

    const fieldStyle = {
      backgroundColor: raised,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: textPrimary,
    };

    return (
      <CustomModal
        ref={sheet}
        title={t('fitPass.title', { defaultValue: 'FitPass' })}
      >
        <View className="px-4 pb-2">
          <View className="items-center mb-3">
            <MenuItemIcon size={64} backgroundColor={accentColor}>
              <Icon name="exercise-weights" size={32} color="#FFFFFF" />
            </MenuItemIcon>
          </View>
          <Text className="text-text-secondary text-base text-center mb-5">
            {t('fitPass.intro', {
              defaultValue:
                'Sign in to bring your gym visits into your diary automatically.',
            })}
          </Text>

          <Text className="text-text-secondary text-sm mb-1">
            {t('fitPass.username', { defaultValue: 'Username or email' })}
          </Text>
          <BottomSheetTextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!connected}
            placeholder={t('fitPass.usernamePlaceholder', {
              defaultValue: 'you@example.com',
            })}
            placeholderTextColor={textMuted}
            accessibilityLabel={t('fitPass.username', {
              defaultValue: 'Username or email',
            })}
            style={fieldStyle}
          />

          <Text className="text-text-secondary text-sm mb-1 mt-3">
            {t('fitPass.password', { defaultValue: 'Password' })}
          </Text>
          <BottomSheetTextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!connected}
            accessibilityLabel={t('fitPass.password', {
              defaultValue: 'Password',
            })}
            style={fieldStyle}
          />

          <View className="mt-4">
            <SettingsRowGroup>
              <SettingsRow
                icon="sync"
                iconColor={accentColor}
                title={t('fitPass.syncEnable', {
                  defaultValue: 'Sync FitPass',
                })}
                subtitle={t('fitPass.syncSubtitle', {
                  defaultValue: 'Bring new visits in with every health sync',
                })}
                subtitleNumberOfLines={0}
                rightAccessory={
                  <Switch
                    accessibilityLabel={t('fitPass.syncEnable', {
                      defaultValue: 'Sync FitPass',
                    })}
                    value={syncEnabled}
                    disabled={!connected}
                    onValueChange={(value) => {
                      setSyncEnabled(value);
                      void saveFitPassSyncEnabled(value);
                    }}
                  />
                }
              />
            </SettingsRowGroup>
          </View>

          {/* Said plainly rather than implied: the switch is real and the details
            are stored, but no FitPass service exists to call yet. */}
          <Text className="text-text-muted text-sm text-center mb-3 px-2">
            {t('fitPass.notLiveNotice', {
              defaultValue:
                'FitPass syncing is not live yet. Your details are saved on this device only.',
            })}
          </Text>

          {connected ? (
            <Button variant="secondary" onPress={() => void disconnect()}>
              {t('fitPass.disconnect', { defaultValue: 'Disconnect FitPass' })}
            </Button>
          ) : (
            <Button
              loading={busy}
              disabled={!canConnect}
              onPress={() => void connect()}
            >
              {t('fitPass.connect', { defaultValue: 'Connect' })}
            </Button>
          )}
        </View>
      </CustomModal>
    );
  }
);

FitPassConnectSheet.displayName = 'FitPassConnectSheet';
export default FitPassConnectSheet;
