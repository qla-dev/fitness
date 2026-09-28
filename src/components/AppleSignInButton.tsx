import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { fireSelectionHaptic } from '../services/haptics';

/**
 * Sign in with Apple, drawn to Apple's black button spec rather than with
 * `AppleAuthenticationButton`. The native button labels itself in the phone's
 * language, so on a Bosnian phone running the app in English it read
 * "Nastavi koristeći Apple" under English copy. Apple's guidelines allow a
 * custom button with the logo and one of the approved titles; this one takes
 * the title from the app's own translations.
 */
export default function AppleSignInButton({
  onPress,
  disabled = false,
  variant = 'continue',
}: {
  onPress: () => void;
  disabled?: boolean;
  /** "Sign in with Apple" for returning users, "Continue with Apple" to create. */
  variant?: 'continue' | 'signIn';
}) {
  const { t } = useTranslation();
  const label =
    variant === 'signIn'
      ? t('online.signIn', { defaultValue: 'Sign in with Apple' })
      : t('online.continueWithApple', { defaultValue: 'Continue with Apple' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => ({
        height: 50,
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Icon name="apple-logo" size={19} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}
