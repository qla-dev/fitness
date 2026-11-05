import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import GoogleLogo from './GoogleLogo';
import Button from './ui/Button';
import LiquidGlassSurface from './LiquidGlassSurface';
import { useLiquidGlassActive } from '../services/nativeTabBarPreference';
import { fireSelectionHaptic } from '../services/haptics';

const GOOGLE_TEXT = '#1F1F1F';
const GOOGLE_WHITE = '#FFFFFF';

/**
 * Sign in with Google in Google's light style (white capsule, dark label),
 * labelled from the app's own translations for the same reason
 * AppleSignInButton is. Built like the Apple button above it: a white-tinted
 * Liquid Glass capsule where glass is on, a filled white one elsewhere, and
 * no outline either way.
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
  const usesGlass = useLiquidGlassActive();
  const button = (
    <Button
      variant={usesGlass ? 'ghost' : 'primary'}
      className="rounded-full"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={usesGlass ? undefined : { backgroundColor: GOOGLE_WHITE }}
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

  if (!usesGlass) return button;

  return (
    <LiquidGlassSurface
      isInteractive
      tintColor={GOOGLE_WHITE}
      style={{ borderRadius: 999, overflow: 'hidden' }}
    >
      {button}
    </LiquidGlassSurface>
  );
}
