import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import LiquidGlassSurface from './LiquidGlassSurface';
import Button from './ui/Button';
import { canUseLiquidGlass } from '../utils/liquidGlass';
import { fireSelectionHaptic } from '../services/haptics';

const APPLE_BLACK = '#000000';

/**
 * Sign in with Apple, drawn as a black button rather than with
 * `AppleAuthenticationButton`. The native button labels itself in the phone's
 * language, so on a Bosnian phone running the app in English it read
 * "Nastavi koristeći Apple" under English copy. Apple's guidelines allow a
 * custom button with the logo and one of the approved titles; this one takes
 * the title from the app's own translations.
 *
 * Shaped and set like the glass footer action it sits above: the same capsule,
 * material and label size, tinted black instead of the accent. Where Liquid
 * Glass is unavailable it is a filled black capsule, as that footer falls back
 * to a filled button.
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
  const usesGlass = canUseLiquidGlass();

  const button = (
    <Button
      variant={usesGlass ? 'ghost' : 'primary'}
      className="rounded-full"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={usesGlass ? undefined : { backgroundColor: APPLE_BLACK }}
      onPress={() => {
        fireSelectionHaptic();
        onPress();
      }}
    >
      <View className="flex-row items-center justify-center gap-1.5">
        <Icon name="apple-logo" size={17} color="#FFFFFF" />
        <Text className="text-base font-semibold text-white">{label}</Text>
      </View>
    </Button>
  );

  if (!usesGlass) return button;

  return (
    <LiquidGlassSurface
      isInteractive
      tintColor={APPLE_BLACK}
      style={{ borderRadius: 999, overflow: 'hidden' }}
    >
      {button}
    </LiquidGlassSurface>
  );
}
