import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import GoogleLogo from './GoogleLogo';
import Button from './ui/Button';
import { fireSelectionHaptic } from '../services/haptics';

const GOOGLE_TEXT = '#1F1F1F';
const GOOGLE_BORDER = '#747775';

/**
 * Sign in with Google, drawn in Google's light style (white capsule, grey
 * outline, dark label) under the Apple button, and labelled from the app's
 * own translations for the same reason AppleSignInButton is.
 */
export default function GoogleSignInButton({
  onPress,
  disabled = false,
  busy = false,
  variant = 'continue',
}: {
  onPress: () => void;
  disabled?: boolean;
  /** While Google's sheet opens, a spinner takes the logo's place. */
  busy?: boolean;
  /** "Sign in with Google" for returning users, "Continue with Google" to create. */
  variant?: 'continue' | 'signIn';
}) {
  const { t } = useTranslation();
  const label =
    variant === 'signIn'
      ? t('online.signInGoogle', { defaultValue: 'Sign in with Google' })
      : t('online.continueWithGoogle', {
          defaultValue: 'Continue with Google',
        });
  return (
    <Button
      variant="primary"
      className="rounded-full"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: GOOGLE_BORDER,
      }}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
    >
      <View className="flex-row items-center justify-center gap-1.5">
        {busy ? (
          <ActivityIndicator
            size="small"
            color={GOOGLE_TEXT}
            style={{ width: 17, height: 17 }}
          />
        ) : (
          <GoogleLogo size={17} />
        )}
        <Text
          className="text-base font-semibold"
          style={{ color: GOOGLE_TEXT }}
        >
          {label}
        </Text>
      </View>
    </Button>
  );
}
